import { redactedAudit } from '../identity/audit.ts';

import type { Store } from '../identity/store.ts';
import { AccessError, requireConfirmation } from '../identity/roles.ts';
import { toolIndex } from '../tool-registry.ts';

export async function adminResult(
  this: Store,
  actor: string,
  tool: string,
  result: string,
  siteId?: string,
  test?: boolean,
) {
  return this.transaction(async (c) => {
    const p = await this.resolve(c, actor);
    // A denied caller's chosen target must not reveal or probe another site.
    if (siteId)
      p.testMode =
        p.testMode ||
        Boolean(
          (
            await c.query(
              'SELECT test_mode FROM platform_site WHERE id=$1 AND (owner_id=$2 OR $3)',
              [siteId, p.id, p.role === 'superadmin'],
            )
          ).rows[0]?.test_mode,
        );
    if (tool.startsWith('testers.') || test === true) p.testMode = true;
    await this.audit(c, p, 'admin.tool.result', tool, {
      tool,
      result,
      ...(siteId ? { siteId } : {}),
      test: p.testMode,
    });
  });
}

export async function logs(
  this: Store,
  actor: string,
  input: {
    from?: string;
    to?: string;
    actor?: string;
    tool?: string;
    test?: boolean;
    before?: string;
    limit: number;
  },
) {
  return this.action(actor, 'logs.query', async (c, p) => {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100)
      throw new AccessError('invalid_log_limit');
    const to = input.to ? new Date(input.to) : new Date(),
      from = input.from
        ? new Date(input.from)
        : new Date(to.getTime() - 86400000);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from > to ||
      to.getTime() - from.getTime() > 31 * 86400000
    )
      throw new AccessError('invalid_log_range');
    const rows = (
      await c.query(
        `SELECT id::text,actor_user_id AS "actorUserId",action,target,details,test_mode AS "testMode",created_at AS "createdAt" FROM platform_audit
        WHERE created_at>=$1 AND created_at<=$2 AND ($3::text IS NULL OR actor_user_id=$3) AND ($4::text IS NULL OR action=$4 OR details->>'tool'=$4 OR (action='tool.call' AND target=$4)) AND ($5::boolean IS NULL OR test_mode=$5) AND ($6::bigint IS NULL OR id<$6) ORDER BY id DESC LIMIT $7`,
        [
          from,
          to,
          input.actor ?? null,
          input.tool ?? null,
          input.test ?? null,
          input.before ?? null,
          input.limit,
        ],
      )
    ).rows;
    p.testMode = input.test === true;
    await this.audit(c, p, 'logs.query', 'platform_audit', {
      limit: input.limit,
      result: 'read',
      test: p.testMode,
    });
    return {
      records: rows.map((r) => redactedAudit(r, toolIndex)),
      nextBefore: rows.length === input.limit ? rows.at(-1).id : null,
    };
  });
}

export async function auditList(
  this: Store,
  id: string,
  before: string | undefined,
  limit: number,
  confirmation: string,
) {
  requireConfirmation(confirmation, 'READ_PRIVATE_AUDIT_LOG');
  return this.action(id, 'admin.audit.list', async (c, p) => {
    const rows = (
      await c.query(
        'SELECT id::text,actor_user_id AS "actorUserId",action,target,details,test_mode AS "testMode",created_at AS "createdAt" FROM platform_audit WHERE ($1::bigint IS NULL OR id<$1::bigint) ORDER BY id DESC LIMIT $2',
        [before ?? null, limit],
      )
    ).rows;
    await this.audit(c, p, 'audit.read', 'platform_audit', {
      limit,
      before: before ?? null,
    });
    return {
      records: rows.map((r) => redactedAudit(r, toolIndex)),
      nextBefore: rows.length === limit ? rows.at(-1).id : null,
    };
  });
}
