import { randomUUID } from 'node:crypto';

import {
  SiteError,
  type SiteUsage,
  type SiteDeployer,
} from '@a2aviary/generator';

import type { SiteAdministration } from '../admin/site-administration.ts';
import { type CatalogSite } from '../admin/site-administration.ts';

export async function refresh(
  this: SiteAdministration,
  actor: string,
  siteId: string,
  period = new Date().toISOString().slice(0, 7),
) {
  this.period(period);
  return this.action(actor, 'site.costs.refresh', async (c, p) => {
    const site = await this.access(c, p, siteId);
    const spec = (
      await c.query(
        'SELECT id FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',
        [siteId],
      )
    ).rows[0];
    if (!spec) throw new SiteError('site_spec_required');
    const busy = (
      await c.query(
        "SELECT j.id,j.state,j.cost_period FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.kind='usage' AND j.state IN ('queued','running')",
        [siteId],
      )
    ).rows[0];
    if (busy) {
      if (busy.cost_period !== period) throw new SiteError('cost_refresh_busy');
      return { siteId, jobId: busy.id, state: busy.state };
    }
    const cached = (
      await c.query(
        "SELECT 1 FROM platform_site_cost WHERE site_id=$1 AND period=$2 AND observed_date=(now() AT TIME ZONE 'UTC')::date",
        [siteId, period],
      )
    ).rowCount;
    if (cached) return { siteId, state: 'cached' };
    const job = (
      await c.query(
        `INSERT INTO platform_site_job(id,spec_id,actor_id,kind,cost_period) VALUES($1,$2,$3,'usage',$4)
        ON CONFLICT(spec_id,kind) DO UPDATE SET state='queued',actor_id=excluded.actor_id,cost_period=excluded.cost_period,billing_snapshot=excluded.billing_snapshot,started_at=NULL,finished_at=NULL RETURNING id,state`,
        [randomUUID(), spec.id, actor, period],
      )
    ).rows[0];
    await this.event(
      c,
      p,
      site,
      'site.costs.refresh',
      'queued',
      spec.id,
      job.id,
      { period },
    );
    return { siteId, jobId: job.id, state: job.state };
  });
}

export async function processUsage(
  this: SiteAdministration,
  job: {
    id: string;
    actor_id: string;
    spec_id: string;
    cost_period: string;
    billing_snapshot: unknown;
  },
  deployer: SiteDeployer,
  name: (s: CatalogSite) => string,
) {
  let site: CatalogSite | undefined;
  let snapshot = job.billing_snapshot;
  try {
    const admitted = await this.store.siteAction(
      job.actor_id,
      'site.costs.refresh',
      async (c, p) => {
        const id = (
          await c.query('SELECT site_id FROM platform_site_spec WHERE id=$1', [
            job.spec_id,
          ])
        ).rows[0]?.site_id;
        site = await this.access(c, p, id);
        snapshot = await this.billing(c, site);
        await c.query(
          'UPDATE platform_site_job SET billing_snapshot=$2 WHERE id=$1',
          [job.id, JSON.stringify(snapshot)],
        );
        await this.event(
          c,
          p,
          site,
          'site.costs.refresh',
          'running',
          job.spec_id,
          job.id,
          { period: job.cost_period },
          snapshot,
        );
        return { site, snapshot };
      },
    );
    const usage = admitted.site.resources.projectId
      ? await deployer.usage(
          admitted.site.resources,
          name(admitted.site),
          job.cost_period,
          admitted.site.test_mode,
        )
      : ({
          currency: 'USD',
          period: job.cost_period,
          status: 'unavailable',
          basis: 'unavailable',
          amount: null,
          reason: 'site_not_deployed',
          metrics: null,
          metricsStatus: 'unavailable',
        } satisfies SiteUsage);
    // Revocation during a provider read also prevents publishing the result.
    await this.store.siteAction(
      job.actor_id,
      'site.costs.refresh',
      async (c, p) => {
        const current = await this.access(c, p, admitted.site.id);
        if (
          JSON.stringify(current.resources) !==
          JSON.stringify(admitted.site.resources)
        )
          throw new SiteError('cost_resources_changed');
        await c.query(
          "INSERT INTO platform_site_cost(site_id,period,observed_date,data) VALUES($1,$2,(now() AT TIME ZONE 'UTC')::date,$3) ON CONFLICT(site_id,period,observed_date) DO NOTHING",
          [current.id, job.cost_period, JSON.stringify(usage)],
        );
        await c.query(
          "UPDATE platform_site_job SET state='done',finished_at=now() WHERE id=$1",
          [job.id],
        );
        await this.event(
          c,
          p,
          current,
          'site.costs.refresh',
          'success',
          job.spec_id,
          job.id,
          { period: job.cost_period },
          admitted.snapshot,
        );
      },
    );
  } catch (error) {
    const code =
      error instanceof SiteError ? error.code : 'cost_collection_failed';
    await this.store.transaction(async (c) => {
      await c.query(
        "UPDATE platform_site_job SET state='failed',finished_at=now() WHERE id=$1",
        [job.id],
      );
      const row =
        site ??
        (
          await c.query(
            'SELECT s.* FROM platform_site s JOIN platform_site_spec p ON p.site_id=s.id WHERE p.id=$1',
            [job.spec_id],
          )
        ).rows[0];
      if (row)
        await this.event(
          c,
          { id: job.actor_id, role: 'client', testMode: row.test_mode },
          row,
          'site.costs.refresh',
          code,
          job.spec_id,
          job.id,
          { period: job.cost_period },
          snapshot,
        );
    });
  }
}

export async function collectDue(this: SiteAdministration) {
  const rows = (
    await this.store.pool.query(`SELECT s.id,s.owner_id FROM platform_site s
      WHERE s.lifecycle='active' AND NOT s.test_mode AND s.current_spec_id IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM platform_site_job j JOIN platform_site_spec p ON p.id=j.spec_id WHERE p.site_id=s.id AND j.kind='usage' AND j.finished_at > now()-interval '1 hour')
      AND NOT EXISTS(SELECT 1 FROM platform_site_cost c WHERE c.site_id=s.id AND c.period=to_char(now() AT TIME ZONE 'UTC','YYYY-MM') AND c.observed_date=(now() AT TIME ZONE 'UTC')::date)`)
  ).rows;
  for (const s of rows) {
    try {
      await this.refresh(s.owner_id, s.id);
    } catch {
      /* Access and provider availability remain fail-closed. */
    }
  }
}

export function period(this: SiteAdministration, period: string) {
  if (
    !/^[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(period) ||
    period > new Date().toISOString().slice(0, 7)
  )
    throw new SiteError('invalid_report_period');
}
