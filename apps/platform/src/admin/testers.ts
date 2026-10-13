import { defaultPolicy } from '@a2aviary/site-core';

import type { Store } from '../identity/store.ts';
import { AccessError } from '../identity/roles.ts';

export async function seedTesters(this: Store) {
  await this.transaction(async (c) => {
    for (const email of this.config.testerEmails)
      await c.query(
        "INSERT INTO platform_tester(email,source) VALUES($1,'config') ON CONFLICT(email) DO NOTHING",
        [email],
      );
  });
}

export async function tester(
  this: Store,
  actor: string,
  tool: 'testers.add' | 'testers.remove' | 'testers.list',
  email?: string,
  page: { after?: string; limit: number } = { limit: 100 },
) {
  if (
    !['testers.add', 'testers.remove', 'testers.list'].includes(tool) ||
    (tool === 'testers.list' && email !== undefined)
  )
    throw new AccessError('invalid_tester_operation');
  return this.action(actor, tool, async (c, p) => {
    if (
      tool !== 'testers.list' &&
      (!email ||
        email.length > 254 ||
        email !== email.toLowerCase() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    )
      throw new AccessError('invalid_email');
    if (email) {
      if (email === this.config.superadminEmail)
        throw new AccessError('reserved_identity');
      if (tool === 'testers.add') {
        const admin = await c.query(
          `SELECT 1 FROM "user" u JOIN platform_role r ON r.user_id=u.id WHERE lower(u.email)=$1 AND r.role='admin' UNION ALL SELECT 1 FROM platform_invitation WHERE email=$1 AND expires_at>now() AND accepted_by IS NULL`,
          [email],
        );
        if (admin.rowCount) throw new AccessError('reserved_identity');
      }
      await c.query(
        "INSERT INTO platform_tester(email,enabled,source) VALUES($1,$2,'chat') ON CONFLICT(email) DO UPDATE SET enabled=excluded.enabled,updated_at=now()",
        [email, tool === 'testers.add'],
      );
    }
    p.testMode = true;
    await this.audit(c, p, tool, email ?? 'platform_tester', {
      result: email ? 'updated' : 'read',
      test: true,
    });
    if (email)
      return {
        email,
        enabled: tool === 'testers.add',
        planId: defaultPolicy.planId.value,
        policyVersion: defaultPolicy.version.value,
        free: true,
        test: true,
      };
    if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 100)
      throw new AccessError('invalid_tester_limit');
    const rows = (
      await c.query(
        'SELECT email,enabled,source,created_at AS "createdAt",updated_at AS "updatedAt" FROM platform_tester WHERE ($1::text IS NULL OR email>$1) ORDER BY email LIMIT $2',
        [page.after ?? null, page.limit],
      )
    ).rows;
    return {
      testers: rows,
      nextAfter: rows.length === page.limit ? rows.at(-1).email : null,
      test: true,
    };
  });
}
