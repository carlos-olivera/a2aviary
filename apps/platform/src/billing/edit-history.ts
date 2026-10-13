import type { PoolClient } from 'pg';

/** Redacted snapshot history survives the intentional deletion of tester specs. */
export async function archivedEditHistory(c: PoolClient, siteId: string) {
  return (
    await c.query(
      `SELECT e->>'id' AS "specId",e->>'draft_id' AS "draftId",e->>'state' AS state,
       e->>'base_sha256' AS "baseSha256",e->>'spec_sha256' AS "specSha256",
       (e->>'created_at')::timestamptz AS "createdAt",(e->>'applied_at')::timestamptz AS "appliedAt",
       false AS reserved,true AS archived
       FROM platform_site_operation o CROSS JOIN LATERAL jsonb_array_elements(o.details->'editHistory') e
       WHERE o.site_id=$1 AND o.kind='tester.reset.edits' ORDER BY o.id DESC`,
      [siteId],
    )
  ).rows;
}
