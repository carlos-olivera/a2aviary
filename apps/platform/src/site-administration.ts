import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  SiteError,
  defaultPolicy,
  type SiteResources,
  type SiteUsage,
  type SiteDeployer
} from '@a2aviary/generator';
import { Store, type Principal } from './store.ts';

export interface CatalogSite {
  id: string;
  owner_id: string;
  number: string;
  slug: string;
  current_spec_id: string | null;
  resources: SiteResources;
  policy_version: string;
  test_mode: boolean;
  lifecycle: string;
  first_client_pilot: boolean;
}
export async function siteAccess(
  c: PoolClient,
  p: Principal,
  id: string,
  history = false
): Promise<CatalogSite> {
  const site = (
    await c.query(
      `SELECT s.* FROM platform_site s JOIN "user" u ON u.id=$2
 WHERE s.id=$1 AND u."emailVerified" AND (s.owner_id=$2 OR $3 OR
 EXISTS(SELECT 1 FROM platform_site_admin a WHERE a.site_id=s.id AND a.email=lower(u.email) AND a.enabled)) FOR UPDATE OF s`,
      [id, p.id, p.role === 'superadmin']
    )
  ).rows[0];
  if (!site) throw new SiteError('owned_site_required');
  if (!history && site.lifecycle !== 'active')
    throw new SiteError('site_' + site.lifecycle);
  // Fixture identities cannot operate production sites, even if a stale grant exists.
  if (p.testMode !== site.test_mode && !(p.role === 'superadmin' && history))
    throw new SiteError('site_mode_mismatch');
  if (site.policy_version !== defaultPolicy.version.value)
    throw new SiteError('unsupported_pinned_policy');
  return site;
}
export class SiteAdministration {
  readonly store: Store;
  constructor(store: Store) {
    this.store = store;
  }
  async access(c: PoolClient, p: Principal, id: string, history = false) {
    return siteAccess(c, p, id, history);
  }
  async billing(c: PoolClient, site: CatalogSite) {
    // Resolve the current owner independently of the acting site administrator.
    const owner = await this.store.currentPrincipal(c, site.owner_id);
    await c.query(
      'SELECT platform_record_billing(s,$2) FROM platform_site s WHERE s.id=$1',
      [site.id, owner.role]
    );
    const b = (
      await c.query(
        'SELECT id::text,owner_role AS "ownerRole",eligible,reason,effective_at AS "effectiveAt" FROM platform_site_billing WHERE site_id=$1 ORDER BY id DESC LIMIT 1',
        [site.id]
      )
    ).rows[0];
    return { ...b, chargesEnabled: false };
  }
  async event(
    c: PoolClient,
    p: Principal,
    site: CatalogSite,
    kind: string,
    result: string,
    specId: string | null = null,
    jobId: string | null = null,
    details: object = {},
    snapshot?: unknown
  ) {
    const billing = snapshot ?? (await this.billing(c, site));
    await c.query(
      'INSERT INTO platform_site_operation(site_id,actor_id,kind,result,spec_id,job_id,billing_snapshot,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        site.id,
        p.id,
        kind,
        result,
        specId,
        jobId,
        JSON.stringify(billing),
        JSON.stringify(details)
      ]
    );
    await c.query(
      'INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,$5)',
      [
        p.id,
        kind,
        site.id,
        JSON.stringify({
          tool: kind,
          result,
          siteId: site.id,
          ...(specId ? { specId } : {}),
          test: site.test_mode
        }),
        site.test_mode
      ]
    );
  }
  private async action<T>(
    actor: string,
    tool: string,
    fn: (c: PoolClient, p: Principal) => Promise<T>
  ): Promise<T> {
    try {
      return await this.store.siteAction(actor, tool, fn);
    } catch (error) {
      await this.store.recordSiteResult(
        actor,
        tool,
        null,
        error instanceof SiteError ? error.code : 'operation_failed'
      );
      throw error;
    }
  }
  async admins(
    actor: string,
    siteId: string,
    operation: 'assign' | 'remove' | 'list',
    emails: string[] = []
  ) {
    return this.action(actor, 'site.admin.' + operation, async (c, p) => {
      const site = await this.access(c, p, siteId);
      const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
      if (
        operation !== 'list' &&
        (!unique.length ||
          unique.length > 100 ||
          unique.some(
            (e) => e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
          ))
      )
        throw new SiteError('invalid_email');
      for (const email of unique) {
        if (
          (
            await c.query(
              'SELECT 1 FROM "user" WHERE id=$1 AND lower(email)=$2',
              [site.owner_id, email]
            )
          ).rowCount
        )
          throw new SiteError('site_owner_membership_reserved');
        if (
          operation === 'assign' &&
          (
            await c.query(
              'SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',
              [email]
            )
          ).rowCount
        )
          throw new SiteError('reserved_identity');
        await c.query(
          'INSERT INTO platform_site_admin(site_id,email,assigned_by,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(site_id,email) DO UPDATE SET enabled=excluded.enabled,assigned_by=excluded.assigned_by,updated_at=now()',
          [siteId, email, p.id, operation === 'assign']
        );
      }
      await this.event(
        c,
        p,
        site,
        'site.admin.' + operation,
        operation === 'list' ? 'read' : 'updated',
        null,
        null,
        { count: unique.length }
      );
      return {
        siteId,
        admins: (
          await c.query(
            'SELECT a.email,a.enabled,a.created_at AS "createdAt",a.updated_at AS "updatedAt",EXISTS(SELECT 1 FROM "user" u WHERE lower(u.email)=a.email AND u."emailVerified") AS "verifiedIdentity" FROM platform_site_admin a WHERE a.site_id=$1 ORDER BY a.email',
            [siteId]
          )
        ).rows,
        delivery: 'no_message_sent'
      };
    });
  }
  async refresh(
    actor: string,
    siteId: string,
    period = new Date().toISOString().slice(0, 7)
  ) {
    this.period(period);
    return this.action(actor, 'site.costs.refresh', async (c, p) => {
      const site = await this.access(c, p, siteId);
      const spec = (
        await c.query(
          'SELECT id FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',
          [siteId]
        )
      ).rows[0];
      if (!spec) throw new SiteError('site_spec_required');
      const busy = (
        await c.query(
          "SELECT j.id,j.state,j.cost_period FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.kind='usage' AND j.state IN ('queued','running')",
          [siteId]
        )
      ).rows[0];
      if (busy) {
        if (busy.cost_period !== period)
          throw new SiteError('cost_refresh_busy');
        return { siteId, jobId: busy.id, state: busy.state };
      }
      const cached = (
        await c.query(
          "SELECT 1 FROM platform_site_cost WHERE site_id=$1 AND period=$2 AND observed_date=(now() AT TIME ZONE 'UTC')::date",
          [siteId, period]
        )
      ).rowCount;
      if (cached) return { siteId, state: 'cached' };
      const job = (
        await c.query(
          `INSERT INTO platform_site_job(id,spec_id,actor_id,kind,cost_period) VALUES($1,$2,$3,'usage',$4)
        ON CONFLICT(spec_id,kind) DO UPDATE SET state='queued',actor_id=excluded.actor_id,cost_period=excluded.cost_period,billing_snapshot=excluded.billing_snapshot,started_at=NULL,finished_at=NULL RETURNING id,state`,
          [randomUUID(), spec.id, actor, period]
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
        { period }
      );
      return { siteId, jobId: job.id, state: job.state };
    });
  }
  async processUsage(
    job: {
      id: string;
      actor_id: string;
      spec_id: string;
      cost_period: string;
      billing_snapshot: unknown;
    },
    deployer: SiteDeployer,
    name: (s: CatalogSite) => string
  ) {
    let site: CatalogSite | undefined;
    let snapshot = job.billing_snapshot;
    try {
      const admitted = await this.store.siteAction(
        job.actor_id,
        'site.costs.refresh',
        async (c, p) => {
          const id = (
            await c.query(
              'SELECT site_id FROM platform_site_spec WHERE id=$1',
              [job.spec_id]
            )
          ).rows[0]?.site_id;
          site = await this.access(c, p, id);
          snapshot = await this.billing(c, site);
          await c.query(
            'UPDATE platform_site_job SET billing_snapshot=$2 WHERE id=$1',
            [job.id, JSON.stringify(snapshot)]
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
            snapshot
          );
          return { site, snapshot };
        }
      );
      const usage = admitted.site.resources.projectId
        ? await deployer.usage(
            admitted.site.resources,
            name(admitted.site),
            job.cost_period,
            admitted.site.test_mode
          )
        : ({
            currency: 'USD',
            period: job.cost_period,
            status: 'unavailable',
            basis: 'unavailable',
            amount: null,
            reason: 'site_not_deployed',
            metrics: null,
            metricsStatus: 'unavailable'
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
            [current.id, job.cost_period, JSON.stringify(usage)]
          );
          await c.query(
            "UPDATE platform_site_job SET state='done',finished_at=now() WHERE id=$1",
            [job.id]
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
            admitted.snapshot
          );
        }
      );
    } catch (error) {
      const code =
        error instanceof SiteError ? error.code : 'cost_collection_failed';
      await this.store.transaction(async (c) => {
        await c.query(
          "UPDATE platform_site_job SET state='failed',finished_at=now() WHERE id=$1",
          [job.id]
        );
        const row =
          site ??
          (
            await c.query(
              'SELECT s.* FROM platform_site s JOIN platform_site_spec p ON p.site_id=s.id WHERE p.id=$1',
              [job.spec_id]
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
            snapshot
          );
      });
    }
  }
  async collectDue() {
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
  private period(period: string) {
    if (
      !/^[0-9]{4}-(?:0[1-9]|1[0-2])$/.test(period) ||
      period > new Date().toISOString().slice(0, 7)
    )
      throw new SiteError('invalid_report_period');
  }
  async report(actor: string, siteId: string, period: string) {
    this.period(period);
    return this.action(actor, 'site.report', async (c, p) => {
      const site = await this.access(c, p, siteId, true);
      const from = period + '-01T00:00:00Z',
        to = new Date(
          Date.UTC(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 1)
        ).toISOString();
      const operations = (
        await c.query(
          'SELECT id::text,actor_id AS "actorId",kind,result,spec_id AS "specId",job_id AS "jobId",billing_snapshot AS billing,details,created_at AS "createdAt" FROM platform_site_operation WHERE site_id=$1 AND created_at>=$2 AND created_at<$3 ORDER BY id DESC LIMIT 1000',
          [siteId, from, to]
        )
      ).rows;
      const summary = (
        await c.query(
          'SELECT kind,result,count(*)::int AS count FROM platform_site_operation WHERE site_id=$1 AND created_at>=$2 AND created_at<$3 GROUP BY kind,result',
          [siteId, from, to]
        )
      ).rows;
      const costs =
        (
          await c.query(
            'SELECT data,collected_at AS "collectedAt" FROM platform_site_cost WHERE site_id=$1 AND period=$2 ORDER BY observed_date DESC LIMIT 1',
            [siteId, period]
          )
        ).rows[0] ?? null;
      const eligibility = (
        await c.query(
          'SELECT id::text,eligible,owner_role AS "ownerRole",reason,effective_at AS "effectiveAt" FROM platform_site_billing WHERE site_id=$1 AND effective_at<$3 AND (effective_at>=$2 OR id=(SELECT max(id) FROM platform_site_billing WHERE site_id=$1 AND effective_at<$2)) ORDER BY id',
          [siteId, from, to]
        )
      ).rows;
      const legacy = (
        await c.query(
          'SELECT j.kind,j.state,count(*)::int AS count FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.created_at>=$2 AND j.created_at<$3 GROUP BY j.kind,j.state',
          [siteId, from, to]
        )
      ).rows;
      const changes = (
        await c.query(
          'SELECT count(*)::int AS count FROM platform_site_spec WHERE site_id=$1 AND accounting IS NOT NULL AND applied_at>=$2 AND applied_at<$3',
          [siteId, from, to]
        )
      ).rows[0].count;
      const billing = await this.billing(c, site);
      await this.event(c, p, site, 'site.report', 'read');
      return {
        siteId,
        period,
        currency: 'USD',
        billing,
        eligibility,
        summary,
        operations,
        operationsTruncated: operations.length === 1000,
        catalogJobs: legacy,
        appliedChanges: changes,
        costs: costs ?? {
          data: {
            status: 'unavailable',
            basis: 'unavailable',
            amount: null,
            reason: 'not_collected'
          },
          collectedAt: null
        },
        verificationCost: {
          status: 'unavailable',
          amount: null,
          reason: 'provider_verification_cost_not_reported'
        },
        storageCost: {
          status: 'unavailable',
          amount: null,
          reason: 'shared_bucket_not_allocated'
        },
        sharedPlatformOverhead: { status: 'unallocated', amount: null },
        csvUrl: '/api/site-reports/' + siteId + '/' + period + '.csv'
      };
    });
  }
  async csv(actor: string, siteId: string, period: string) {
    const r = await this.report(actor, siteId, period);
    const escape = (v: unknown) => {
      let s = v === null || v === undefined ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const rows: unknown[][] = [
      [
        'record',
        'site_id',
        'period',
        'time',
        'kind',
        'result',
        'actor_id',
        'spec_id',
        'billing_eligible',
        'cost_usd',
        'basis'
      ],
      [
        'cost',
        siteId,
        period,
        r.costs.collectedAt,
        'railway',
        r.costs.data.status,
        '',
        '',
        r.billing.eligible,
        r.costs.data.amount,
        r.costs.data.basis
      ],
      [
        'cost',
        siteId,
        period,
        '',
        'verification',
        'unavailable',
        '',
        '',
        '',
        null,
        'unavailable'
      ],
      [
        'cost',
        siteId,
        period,
        '',
        'storage',
        'unavailable',
        '',
        '',
        '',
        null,
        'unavailable'
      ],
      [
        'cost',
        siteId,
        period,
        '',
        'shared-platform',
        'unallocated',
        '',
        '',
        '',
        null,
        'unallocated'
      ]
    ];
    for (const [kind, amount] of Object.entries(r.costs.data.breakdown ?? {}))
      rows.push([
        'provider-cost-component',
        siteId,
        period,
        r.costs.collectedAt,
        kind,
        r.costs.data.status,
        '',
        '',
        '',
        amount,
        r.costs.data.basis
      ]);
    for (const [kind, data] of Object.entries(r.costs.data.metrics ?? {}))
      rows.push([
        'resource-usage',
        siteId,
        period,
        r.costs.collectedAt,
        kind,
        r.costs.data.metricsStatus,
        '',
        '',
        '',
        '',
        JSON.stringify(data)
      ]);
    if (r.costs.data.providerBillingPeriod)
      rows.push([
        'provider-period',
        siteId,
        period,
        r.costs.collectedAt,
        'billing-period',
        r.costs.data.status,
        '',
        '',
        '',
        '',
        JSON.stringify(r.costs.data.providerBillingPeriod)
      ]);
    for (const j of r.catalogJobs)
      rows.push([
        'catalog-jobs',
        siteId,
        period,
        '',
        j.kind,
        j.state,
        '',
        '',
        '',
        '',
        String(j.count)
      ]);
    rows.push([
      'applied-changes',
      siteId,
      period,
      '',
      'changes',
      'applied',
      '',
      '',
      '',
      '',
      String(r.appliedChanges)
    ]);
    for (const o of r.operations)
      rows.push([
        'operation',
        siteId,
        period,
        o.createdAt,
        o.kind,
        o.result,
        o.actorId,
        o.specId,
        o.billing.eligible,
        '',
        ''
      ]);
    for (const e of r.eligibility)
      rows.push([
        'eligibility',
        siteId,
        period,
        e.effectiveAt,
        e.ownerRole,
        e.reason,
        '',
        '',
        e.eligible,
        '',
        ''
      ]);
    return rows.map((row) => row.map(escape).join(',')).join('\r\n') + '\r\n';
  }
}
