import { archivedEditHistory } from '../billing/edit-history.ts';
import { SiteError } from '@a2aviary/generator';

import type { SiteRow } from '../sites/deployments.ts';
import type { Sites } from '../sites/deployments.ts';

export async function list(
  this: Sites,
  actor: string,
  input: {
    test?: boolean;
    owner?: string;
    status?: string;
    limit: number;
    after?: string;
  },
) {
  return this.store.siteAction(actor, 'sites.list', async (c, p) => {
    const rows = (
      await c.query(
        `SELECT s.id AS "siteId",s.owner_id AS "ownerId",s.slug,s.test_mode AS test,s.lifecycle,s.policy_version AS "policyVersion",s.first_client_pilot AS "firstClientPilot",((SELECT count(*) FROM platform_site_spec h WHERE h.site_id=s.id AND h.accounting IS NOT NULL AND h.applied_at IS NOT NULL)+(SELECT count(*) FROM platform_site_operation o CROSS JOIN LATERAL jsonb_array_elements(o.details->'editHistory') e WHERE o.site_id=s.id AND o.kind='tester.reset.edits' AND e->>'applied_at' IS NOT NULL))::int AS "deployedEdits",(SELECT id FROM platform_site_draft d WHERE d.site_id=s.id AND d.state='active') AS "activeDraftId", CASE WHEN s.lifecycle='active' THEN COALESCE(cur.state,v.state,'staged') ELSE s.lifecycle END AS status
        FROM platform_site s LEFT JOIN platform_site_spec cur ON cur.id=s.current_spec_id LEFT JOIN LATERAL (SELECT state FROM platform_site_spec WHERE site_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1) v ON true
        WHERE ($1::boolean IS NULL OR s.test_mode=$1) AND ($2::text IS NULL OR s.owner_id=$2) AND ($3::text IS NULL OR CASE WHEN s.lifecycle='active' THEN COALESCE(cur.state,v.state,'staged') ELSE s.lifecycle END=$3) AND ($4::uuid IS NULL OR s.id>$4) ORDER BY s.id LIMIT $5`,
        [
          input.test ?? null,
          input.owner ?? null,
          input.status ?? null,
          input.after ?? null,
          input.limit,
        ],
      )
    ).rows;
    p.testMode = input.test === true;
    await this.audit(c, p, 'sites.list', null, 'read');
    return {
      sites: rows,
      nextAfter: rows.length === input.limit ? rows.at(-1).siteId : null,
    };
  });
}

export async function inspect(this: Sites, actor: string, siteId: string) {
  return this.store.siteAction(actor, 'site.inspect', async (c, p) => {
    const site = (
      await c.query('SELECT * FROM platform_site WHERE id=$1', [siteId])
    ).rows[0] as SiteRow | undefined;
    if (!site) throw new SiteError('site_not_found');
    const specs = (
      await c.query(
        'SELECT id AS "specId",state,spec_sha256 AS "specSha256",source_sha256 AS "sourceSha256",output_sha256 AS "outputSha256",draft_id AS "draftId",base_sha256 AS "baseSha256",reserved,accounting,applied_at AS "appliedAt",test_mode AS test,error_code AS error FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20',
        [siteId],
      )
    ).rows;
    const currentState = site.current_spec_id
      ? (
          await c.query('SELECT state FROM platform_site_spec WHERE id=$1', [
            site.current_spec_id,
          ])
        ).rows[0]?.state
      : undefined;
    const lastDeploy =
      (
        await c.query(
          `SELECT j.id AS "jobId",j.state,j.finished_at AS "finishedAt" FROM platform_site_job j JOIN platform_site_spec p ON p.id=j.spec_id WHERE p.site_id=$1 AND j.kind='deploy' ORDER BY j.created_at DESC LIMIT 1`,
          [siteId],
        )
      ).rows[0] ?? null;
    p.testMode = site.test_mode;
    await this.audit(
      c,
      p,
      'site.inspect',
      specs[0]?.specSha256 ?? null,
      'read',
    );
    return {
      siteId,
      ownerId: site.owner_id,
      firstClientPilot: site.first_client_pilot,
      test: site.test_mode,
      free:
        site.test_mode ||
        ['admin', 'superadmin'].includes(
          (await this.store.currentPrincipal(c, site.owner_id)).role,
        ),
      lifecycle: site.lifecycle,
      status:
        site.lifecycle === 'active'
          ? (currentState ?? specs[0]?.state ?? 'staged')
          : site.lifecycle,
      policyVersion: site.policy_version,
      currentSpecId: site.current_spec_id,
      lastDeploy,
      specs,
      archivedEdits: await archivedEditHistory(c, siteId),
      monthlyRequestsUsed: await this.successfulUsage(c, site.owner_id),
      monthlyCapacityHeld: await this.usage(c, site.owner_id),
      siteUrl: site.resources.domain
        ? 'https://' + site.resources.domain
        : null,
    };
  });
}
