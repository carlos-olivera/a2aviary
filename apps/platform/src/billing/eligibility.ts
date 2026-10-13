import type { PoolClient } from 'pg';

import { type Principal } from '../identity/store.ts';

import type { SiteAdministration } from '../admin/site-administration.ts';
import { type CatalogSite } from '../admin/site-administration.ts';

export async function billing(
  this: SiteAdministration,
  c: PoolClient,
  site: CatalogSite,
) {
  // Resolve the current owner independently of the acting site administrator.
  const owner = await this.store.currentPrincipal(c, site.owner_id);
  await c.query(
    'SELECT platform_record_billing(s,$2) FROM platform_site s WHERE s.id=$1',
    [site.id, owner.role],
  );
  const b = (
    await c.query(
      'SELECT id::text,owner_role AS "ownerRole",eligible,reason,effective_at AS "effectiveAt" FROM platform_site_billing WHERE site_id=$1 ORDER BY id DESC LIMIT 1',
      [site.id],
    )
  ).rows[0];
  return { ...b, chargesEnabled: false };
}

export async function event(
  this: SiteAdministration,
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
      JSON.stringify(details),
    ],
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
        test: site.test_mode,
      }),
      site.test_mode,
    ],
  );
}
