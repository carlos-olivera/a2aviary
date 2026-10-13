import { billing, event } from '../billing/eligibility.ts';
import {
  refresh,
  processUsage,
  collectDue,
  period as parsePeriod,
} from '../billing/costs.ts';
import { report, csv } from '../billing/reports.ts';

import type { PoolClient } from 'pg';
import { SUPPORTED_POLICY_VERSIONS } from '@a2aviary/site-core';
import {
  SiteError,
  type SiteResources,
  type SiteDeployer,
} from '@a2aviary/generator';

import { Store, type Principal } from '../identity/store.ts';

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
  history = false,
): Promise<CatalogSite> {
  const site = (
    await c.query(
      `SELECT s.* FROM platform_site s JOIN "user" u ON u.id=$2
 WHERE s.id=$1 AND u."emailVerified" AND (s.owner_id=$2 OR $3 OR
 EXISTS(SELECT 1 FROM platform_site_admin a WHERE a.site_id=s.id AND a.email=lower(u.email) AND a.enabled)) FOR UPDATE OF s`,
      [id, p.id, p.role === 'superadmin'],
    )
  ).rows[0];
  if (!site) throw new SiteError('owned_site_required');
  if (!history && site.lifecycle !== 'active')
    throw new SiteError('site_' + site.lifecycle);
  // Fixture identities cannot operate production sites, even if a stale grant exists.
  if (p.testMode !== site.test_mode && !(p.role === 'superadmin' && history))
    throw new SiteError('site_mode_mismatch');
  if (
    !SUPPORTED_POLICY_VERSIONS.includes(
      site.policy_version,
    )
  )
    throw new SiteError('policy_version_unsupported');
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
    return billing.call(this, c, site);
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
    snapshot?: unknown,
  ) {
    return event.call(
      this,
      c,
      p,
      site,
      kind,
      result,
      specId,
      jobId,
      details,
      snapshot,
    );
  }
  /** @internal Shared by domain operations. */
  async action<T>(
    actor: string,
    tool: string,
    fn: (c: PoolClient, p: Principal) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.store.siteAction(actor, tool, fn);
    } catch (error) {
      await this.store.recordSiteResult(
        actor,
        tool,
        null,
        error instanceof SiteError ? error.code : 'operation_failed',
      );
      throw error;
    }
  }
  async admins(
    actor: string,
    siteId: string,
    operation: 'assign' | 'remove' | 'list',
    emails: string[] = [],
  ) {
    return this.action(actor, 'site.admin.' + operation, async (c, p) => {
      const site = await this.access(c, p, siteId);
      const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()))];
      if (
        operation !== 'list' &&
        (!unique.length ||
          unique.length > 100 ||
          unique.some(
            (e) => e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e),
          ))
      )
        throw new SiteError('invalid_email');
      for (const email of unique) {
        if (
          (
            await c.query(
              'SELECT 1 FROM "user" WHERE id=$1 AND lower(email)=$2',
              [site.owner_id, email],
            )
          ).rowCount
        )
          throw new SiteError('site_owner_membership_reserved');
        if (
          operation === 'assign' &&
          (
            await c.query(
              'SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',
              [email],
            )
          ).rowCount
        )
          throw new SiteError('reserved_identity');
        await c.query(
          'INSERT INTO platform_site_admin(site_id,email,assigned_by,enabled) VALUES($1,$2,$3,$4) ON CONFLICT(site_id,email) DO UPDATE SET enabled=excluded.enabled,assigned_by=excluded.assigned_by,updated_at=now()',
          [siteId, email, p.id, operation === 'assign'],
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
        { count: unique.length },
      );
      return {
        siteId,
        admins: (
          await c.query(
            'SELECT a.email,a.enabled,a.created_at AS "createdAt",a.updated_at AS "updatedAt",EXISTS(SELECT 1 FROM "user" u WHERE lower(u.email)=a.email AND u."emailVerified") AS "verifiedIdentity" FROM platform_site_admin a WHERE a.site_id=$1 ORDER BY a.email',
            [siteId],
          )
        ).rows,
        delivery: 'no_message_sent',
      };
    });
  }
  async refresh(
    actor: string,
    siteId: string,
    period = new Date().toISOString().slice(0, 7),
  ) {
    return refresh.call(this, actor, siteId, period);
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
    name: (s: CatalogSite) => string,
  ) {
    return processUsage.call(this, job, deployer, name);
  }
  async collectDue() {
    return collectDue.call(this);
  }
  /** @internal Shared by domain operations. */
  period(period: string) {
    return parsePeriod.call(this, period);
  }
  async report(actor: string, siteId: string, period: string) {
    return report.call(this, actor, siteId, period);
  }
  async csv(actor: string, siteId: string, period: string) {
    return csv.call(this, actor, siteId, period);
  }
}
