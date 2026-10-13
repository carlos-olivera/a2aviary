import { seedTesters, tester } from '../admin/testers.ts';
import {
  revokeAdminEmail,
  inviteAdmin,
  revokeAdmin,
} from '../admin/administrators.ts';
import { adminResult, logs, auditList } from '../admin/logs.ts';
import { registerKey, listKeys, revokeKey } from './agent-keys.ts';

import { type JWK } from 'jose';
import type { Pool, PoolClient } from 'pg';
import type { Config } from '../config.ts';

import {
  AccessError,
  requireRole,
  type Principal,
  type Role,
} from './roles.ts';
export * from './roles.ts';
export { validatePublicKey } from './agent-keys.ts';
// Compatibility only: existing test/consumer imports; never a permission source.
export class Store {
  readonly pool: Pool;
  /** @internal Used by identity and administration operations. */
  readonly config: Config;
  constructor(pool: Pool, config: Config) {
    this.pool = pool;
    this.config = config;
  }
  async seedTesters() {
    return seedTesters.call(this);
  }
  async tester(
    actor: string,
    tool: 'testers.add' | 'testers.remove' | 'testers.list',
    email?: string,
    page: { after?: string; limit: number } = { limit: 100 },
  ) {
    return tester.call(this, actor, tool, email, page);
  }
  async revokeAdminEmail(actor: string, email: string, confirmation: string) {
    return revokeAdminEmail.call(this, actor, email, confirmation);
  }
  async adminResult(
    actor: string,
    tool: string,
    result: string,
    siteId?: string,
    test?: boolean,
  ) {
    return adminResult.call(this, actor, tool, result, siteId, test);
  }
  async logs(
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
    return logs.call(this, actor, input);
  }
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  /** @internal Shared by domain operations. */
  async audit(
    client: PoolClient,
    p: Principal,
    action: string,
    target: string,
    details: object = {},
  ) {
    await client.query(
      'INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,$5)',
      [p.id, action, target, JSON.stringify(details), p.testMode],
    );
  }
  /** @internal Shared by domain operations. */
  async resolve(client: PoolClient, id: string): Promise<Principal> {
    // Serialize bootstrap/invitation consumption and all actions for this human.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `platform-user:${id}`,
    ]);
    const user = (
      await client.query(
        'SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR SHARE',
        [id],
      )
    ).rows[0];
    if (!user?.emailVerified) throw new AccessError('verified_user_required');
    const email = String(user.email).toLowerCase();
    let role: Role = 'client';
    if (email === this.config.superadminEmail) role = 'superadmin';
    else if (
      (
        await client.query(
          'SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',
          [email],
        )
      ).rowCount
    )
      role = 'tester';
    else {
      const existing = (
        await client.query('SELECT role FROM platform_role WHERE user_id=$1', [
          id,
        ])
      ).rows[0];
      const invitation = (
        await client.query(
          'SELECT email FROM platform_invitation WHERE email=$1 AND expires_at > now() AND accepted_by IS NULL FOR UPDATE',
          [email],
        )
      ).rows[0];
      if (existing?.role === 'admin' || invitation) role = 'admin';
      if (invitation)
        await client.query(
          'UPDATE platform_invitation SET accepted_by=$1 WHERE email=$2',
          [id, email],
        );
    }
    const previous = (
      await client.query('SELECT role FROM platform_role WHERE user_id=$1', [
        id,
      ])
    ).rows[0];
    const p: Principal = { id, role, testMode: role === 'tester' };
    if (previous?.role !== role) {
      await client.query(
        'INSERT INTO platform_role(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,updated_at=now()',
        [id, role],
      );
      await this.audit(
        client,
        { ...p, testMode: p.testMode || previous?.role === 'tester' },
        'role.resolve',
        id,
        {
          previousRole: previous?.role ?? null,
          role,
        },
      );
    }
    return p;
  }
  admitRequest(id: string) {
    return this.transaction(async (c) => {
      const p = await this.resolve(c, id);
      const result = await c.query(
        `INSERT INTO platform_mcp_rate(user_id,window_start,request_count)
        VALUES($1,date_trunc('minute',now()),1) ON CONFLICT(user_id) DO UPDATE SET
        request_count=CASE WHEN platform_mcp_rate.window_start=date_trunc('minute',now()) THEN platform_mcp_rate.request_count+1 ELSE 1 END,
        window_start=date_trunc('minute',now()) RETURNING request_count`,
        [id],
      );
      if (result.rows[0].request_count > 60)
        throw new AccessError('request_rate_limited');
      return p;
    });
  }
  principal(id: string) {
    return this.transaction((c) => this.resolve(c, id));
  }
  // Read current verified identity/role without consuming invitations or taking
  // an actor lock. Worker site leases must not deadlock membership revocation.
  async currentPrincipal(c: PoolClient, id: string): Promise<Principal> {
    const u = (
      await c.query(
        'SELECT u.email,u."emailVerified",r.role FROM "user" u LEFT JOIN platform_role r ON r.user_id=u.id WHERE u.id=$1',
        [id],
      )
    ).rows[0];
    if (!u?.emailVerified) throw new AccessError('verified_user_required');
    const email = String(u.email).toLowerCase();
    const tester = Boolean(
      (
        await c.query(
          'SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',
          [email],
        )
      ).rowCount,
    );
    const role: Role =
      email === this.config.superadminEmail
        ? 'superadmin'
        : tester
          ? 'tester'
          : u.role === 'admin'
            ? 'admin'
            : 'client';
    return { id, role, testMode: role === 'tester' };
  }
  /** @internal Shared by domain operations. */
  action<T>(
    id: string,
    tool: string,
    fn: (c: PoolClient, p: Principal) => Promise<T>,
  ) {
    return this.transaction(async (c) => {
      const p = await this.resolve(c, id);
      requireRole(p, tool);
      return fn(c, p);
    });
  }
  recordToolCall(id: string, tool: string, siteId?: string, test?: boolean) {
    return this.action(id, tool, async (c, p) => {
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
      await this.audit(c, p, 'tool.call', tool, { tool, test: p.testMode });
    });
  }
  siteAction<T>(
    id: string,
    tool: string,
    fn: (c: PoolClient, p: Principal) => Promise<T>,
  ) {
    return this.action(id, tool, fn);
  }
  recordSiteResult(
    id: string,
    tool: string,
    specSha256: string | null,
    result: string,
    test?: boolean,
  ) {
    return this.transaction(async (c) => {
      const p = await this.resolve(c, id);
      if (test !== undefined) p.testMode = p.testMode || test;
      else if (specSha256)
        p.testMode =
          p.testMode ||
          Boolean(
            (
              await c.query(
                'SELECT 1 FROM platform_site_spec s JOIN platform_site t ON t.id=s.site_id WHERE s.spec_sha256=$1 AND t.owner_id=$2 AND t.test_mode',
                [specSha256, id],
              )
            ).rowCount,
          );
      await this.audit(c, p, 'site.tool.result', tool, {
        tool,
        specSha256,
        result,
        test: p.testMode,
      });
    });
  }
  async registerKey(
    id: string,
    key: { jwk: JWK; thumbprint: string },
    confirmation: string,
  ) {
    return registerKey.call(this, id, key, confirmation);
  }
  listKeys(id: string) {
    return listKeys.call(this, id);
  }
  async revokeKey(id: string, keyId: string, confirmation: string) {
    return revokeKey.call(this, id, keyId, confirmation);
  }
  async inviteAdmin(id: string, email: string, confirmation: string) {
    return inviteAdmin.call(this, id, email, confirmation);
  }
  async revokeAdmin(id: string, userId: string, confirmation: string) {
    return revokeAdmin.call(this, id, userId, confirmation);
  }
  async auditList(
    id: string,
    before: string | undefined,
    limit: number,
    confirmation: string,
  ) {
    return auditList.call(this, id, before, limit, confirmation);
  }
}
