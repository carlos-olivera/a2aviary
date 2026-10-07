import { randomUUID } from 'node:crypto';
import { calculateJwkThumbprint, importJWK, type JWK } from 'jose';
import type { Pool, PoolClient } from 'pg';
import type { Config } from './config.ts';
import { defaultPolicy } from '@a2aviary/generator';
import { redactedAudit } from './audit.ts';

export type Role = 'superadmin' | 'admin' | 'client' | 'tester';
export interface Principal {id: string; role: Role; testMode: boolean}
export class AccessError extends Error {
  readonly code: string;
  constructor(code: string) {super(code); this.code = code;}
}
export const ALL_ROLES: readonly Role[] = ['superadmin', 'admin', 'client', 'tester'];
export const TOOL_ROLES: Record<string, readonly Role[]> = {
  'capabilities.get': ALL_ROLES,
  'plans.list': ALL_ROLES,
  'plan.get_manifest': ALL_ROLES,
  'plan.get_schemas': ALL_ROLES,
  'policy.version': ALL_ROLES,
  'agent_keys.register': ALL_ROLES,
  'agent_keys.list': ALL_ROLES,
  'agent_keys.revoke': ALL_ROLES,
  'admin.invite': ['superadmin'],
  'admin.revoke': ['superadmin'],
  'admin.audit.list': ['superadmin'],
  'testers.add': ['superadmin'],
  'testers.remove': ['superadmin'],
  'testers.list': ['superadmin'],
  'sites.list': ['superadmin'],
  'site.inspect': ['superadmin'],
  'logs.query': ['superadmin'],
  'tester.reset': ['superadmin'],
  'site.build': ALL_ROLES,
  'site.status': ALL_ROLES,
  'site.deploy': ALL_ROLES,
  'change.request': ALL_ROLES,
  'site.import': ['superadmin'],
  'site.admin.assign': ['superadmin'],
  'site.admin.remove': ['superadmin'],
  'site.admin.list': ['superadmin'],
  'site.release.verify': ['superadmin','admin','client'],
  'site.release.deploy': ['superadmin','admin','client'],
  'site.release.rollback': ['superadmin','admin','client'],
  'site.report': ['superadmin','admin','client'],
  'site.costs.refresh': ['superadmin','admin','client'],
  'site.release.reconcile': ['superadmin'],
};
export function isAdminTool(tool: string) {
  return TOOL_ROLES[tool]?.length === 1 && TOOL_ROLES[tool][0] === 'superadmin';
}
export function requireRole(principal: Principal, tool: string) {
  if (
    !Object.hasOwn(TOOL_ROLES, tool) ||
    !TOOL_ROLES[tool].includes(principal.role)
  )
    throw new AccessError('forbidden');
}
export function requireConfirmation(value: string, expected: string) {
  if (value !== expected) throw new AccessError('confirmation_required');
}
export async function validatePublicKey(value: unknown): Promise<{jwk: JWK; thumbprint: string}> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AccessError('invalid_public_key');
  const jwk = value as JWK;
  if (Object.keys(jwk).some(k => !['kty', 'crv', 'x', 'y', 'alg', 'use', 'key_ops'].includes(k)) || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || (jwk.alg !== undefined && jwk.alg !== 'ES256') || (jwk.use !== undefined && jwk.use !== 'sig') || (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || jwk.key_ops.length !== 1 || jwk.key_ops[0] !== 'verify')) || !/^[A-Za-z0-9_-]{43}$/.test(jwk.x ?? '') || !/^[A-Za-z0-9_-]{43}$/.test(jwk.y ?? '')) throw new AccessError('invalid_public_key');
  const normalized: JWK = {kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, alg: 'ES256'};
  try {
    await importJWK(normalized, 'ES256');
    // WebCrypto rejects coordinates not on P-256; also require canonical base64url.
    if ([jwk.x!, jwk.y!].some(c => Buffer.from(c, 'base64url').toString('base64url') !== c)) throw new Error();
    return {jwk: normalized, thumbprint: await calculateJwkThumbprint(normalized)};
  } catch {throw new AccessError('invalid_public_key');}
}

export class Store {
  readonly pool: Pool;
  private readonly config: Config;
  constructor(pool: Pool, config: Config) {this.pool = pool; this.config = config;}
  async seedTesters() {
    await this.transaction(async (c) => {
      for (const email of this.config.testerEmails)
        await c.query(
          "INSERT INTO platform_tester(email,source) VALUES($1,'config') ON CONFLICT(email) DO NOTHING",
          [email]
        );
    });
  }
  async tester(
    actor: string,
    tool: 'testers.add' | 'testers.remove' | 'testers.list',
    email?: string,
    page: { after?: string; limit: number } = { limit: 100 }
  ) {
    if(!['testers.add','testers.remove','testers.list'].includes(tool) || (tool==='testers.list' && email!==undefined)) throw new AccessError('invalid_tester_operation');
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
            [email]
          );
          if (admin.rowCount) throw new AccessError('reserved_identity');
        }
        await c.query(
          "INSERT INTO platform_tester(email,enabled,source) VALUES($1,$2,'chat') ON CONFLICT(email) DO UPDATE SET enabled=excluded.enabled,updated_at=now()",
          [email, tool === 'testers.add']
        );
      }
      p.testMode = true;
      await this.audit(c, p, tool, email ?? 'platform_tester', {
        result: email ? 'updated' : 'read',
        test: true
      });
      if (email)
        return {
          email,
          enabled: tool === 'testers.add',
          planId: defaultPolicy.planId.value,
          policyVersion: defaultPolicy.version.value,
          free: true,
          test: true
        };
      if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 100)
        throw new AccessError('invalid_tester_limit');
      const rows = (
        await c.query(
          'SELECT email,enabled,source,created_at AS "createdAt",updated_at AS "updatedAt" FROM platform_tester WHERE ($1::text IS NULL OR email>$1) ORDER BY email LIMIT $2',
          [page.after ?? null, page.limit]
        )
      ).rows;
      return {
        testers: rows,
        nextAfter: rows.length === page.limit ? rows.at(-1).email : null,
        test: true
      };
    });
  }
  async revokeAdminEmail(actor: string, email: string, confirmation: string) {
    requireConfirmation(confirmation, 'REVOKE_ADMIN:' + email);
    return this.action(actor, 'admin.revoke', async (c, p) => {
      if (email === this.config.superadminEmail)
        throw new AccessError('invited_admin_required');
      const user = (
        await c.query('SELECT id FROM "user" WHERE lower(email)=$1', [email])
      ).rows[0];
      if (user) {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          'platform-user:' + user.id
        ]);
        await c.query(
          "UPDATE platform_role SET role='client',updated_at=now() WHERE user_id=$1 AND role='admin'",
          [user.id]
        );
      }
      await c.query('DELETE FROM platform_invitation WHERE email=$1', [email]);
      await this.audit(c, p, 'admin.revoke', email, {
        confirmation,
        result: 'revoked'
      });
      return { email, revoked: true };
    });
  }
  async adminResult(
    actor: string,
    tool: string,
    result: string,
    siteId?: string,
    test?: boolean
  ) {
    return this.transaction(async (c) => {
      const p = await this.resolve(c, actor);
      // A denied caller's chosen target must not reveal or probe another site.
      if (siteId)
        p.testMode = p.testMode || Boolean(
          (
            await c.query('SELECT test_mode FROM platform_site WHERE id=$1 AND (owner_id=$2 OR $3)', [
              siteId,p.id,p.role==='superadmin'
            ])
          ).rows[0]?.test_mode
        );
      if (tool.startsWith('testers.') || test === true) p.testMode = true;
      await this.audit(c, p, 'admin.tool.result', tool, {
        tool,
        result,
        ...(siteId ? { siteId } : {}),
        test: p.testMode
      });
    });
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
    }
  ) {
    return this.action(actor, 'logs.query', async (c, p) => {
      if (
        !Number.isInteger(input.limit) ||
        input.limit < 1 ||
        input.limit > 100
      )
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
            input.limit
          ]
        )
      ).rows;
      p.testMode = input.test === true;
      await this.audit(c, p, 'logs.query', 'platform_audit', {
        limit: input.limit,
        result: 'read',
        test: p.testMode
      });
      return {
        records: rows.map((r) => redactedAudit(r, TOOL_ROLES)),
        nextBefore: rows.length === input.limit ? rows.at(-1).id : null
      };
    });
  }
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result;}
    catch (error) {await client.query('ROLLBACK'); throw error;}
    finally {client.release();}
  }
  private async audit(client: PoolClient, p: Principal, action: string, target: string, details: object = {}) {
    await client.query('INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,$5)', [p.id, action, target, JSON.stringify(details), p.testMode]);
  }
  private async resolve(client: PoolClient, id: string): Promise<Principal> {
    // Serialize bootstrap/invitation consumption and all actions for this human.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `platform-user:${id}`
    ]);
    const user = (
      await client.query(
        'SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR SHARE',
        [id]
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
          [email]
        )
      ).rowCount
    )
      role = 'tester';
    else {
      const existing = (
        await client.query('SELECT role FROM platform_role WHERE user_id=$1', [
          id
        ])
      ).rows[0];
      const invitation = (
        await client.query(
          'SELECT email FROM platform_invitation WHERE email=$1 AND expires_at > now() AND accepted_by IS NULL FOR UPDATE',
          [email]
        )
      ).rows[0];
      if (existing?.role === 'admin' || invitation) role = 'admin';
      if (invitation)
        await client.query(
          'UPDATE platform_invitation SET accepted_by=$1 WHERE email=$2',
          [id, email]
        );
    }
    const previous = (
      await client.query('SELECT role FROM platform_role WHERE user_id=$1', [
        id
      ])
    ).rows[0];
    const p: Principal = { id, role, testMode: role === 'tester' };
    if (previous?.role !== role) {
      await client.query(
        'INSERT INTO platform_role(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,updated_at=now()',
        [id, role]
      );
      await this.audit(client, {...p,testMode:p.testMode || previous?.role==='tester'}, 'role.resolve', id, {
        previousRole: previous?.role ?? null,
        role
      });
    }
    return p;
  }
  admitRequest(id: string) {
    return this.transaction(async c => {
      const p = await this.resolve(c, id);
      const result = await c.query(`INSERT INTO platform_mcp_rate(user_id,window_start,request_count)
        VALUES($1,date_trunc('minute',now()),1) ON CONFLICT(user_id) DO UPDATE SET
        request_count=CASE WHEN platform_mcp_rate.window_start=date_trunc('minute',now()) THEN platform_mcp_rate.request_count+1 ELSE 1 END,
        window_start=date_trunc('minute',now()) RETURNING request_count`, [id]);
      if (result.rows[0].request_count > 60) throw new AccessError('request_rate_limited');
      return p;
    });
  }
  principal(id: string) {return this.transaction(c => this.resolve(c, id));}
  // Read current verified identity/role without consuming invitations or taking
  // an actor lock. Worker site leases must not deadlock membership revocation.
  async currentPrincipal(c: PoolClient, id: string): Promise<Principal> {
    const u=(await c.query('SELECT u.email,u."emailVerified",r.role FROM "user" u LEFT JOIN platform_role r ON r.user_id=u.id WHERE u.id=$1',[id])).rows[0];
    if(!u?.emailVerified)throw new AccessError('verified_user_required');
    const email=String(u.email).toLowerCase();
    const tester=Boolean((await c.query('SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',[email])).rowCount);
    const role:Role=email===this.config.superadminEmail?'superadmin':tester?'tester':u.role==='admin'?'admin':'client';
    return {id,role,testMode:role==='tester'};
  }
  private action<T>(id: string, tool: string, fn: (c: PoolClient, p: Principal) => Promise<T>) {
    return this.transaction(async c => {const p = await this.resolve(c, id); requireRole(p, tool); return fn(c, p);});
  }
  recordToolCall(id: string, tool: string, siteId?: string, test?: boolean) {
    return this.action(id, tool, async (c, p) => {
      if (siteId)
        p.testMode = p.testMode || Boolean(
          (
            await c.query('SELECT test_mode FROM platform_site WHERE id=$1 AND (owner_id=$2 OR $3)', [
              siteId,p.id,p.role==='superadmin'
            ])
          ).rows[0]?.test_mode
        );
      if (tool.startsWith('testers.') || test === true) p.testMode = true;
      await this.audit(c, p, 'tool.call', tool, { tool, test: p.testMode });
    });
  }
  siteAction<T>(
    id: string,
    tool: string,
    fn: (c: PoolClient, p: Principal) => Promise<T>
  ) {
    return this.action(id, tool, fn);
  }
  recordSiteResult(
    id: string,
    tool: string,
    specSha256: string | null,
    result: string,
    test?: boolean
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
                [specSha256, id]
              )
            ).rowCount
          );
      await this.audit(c, p, 'site.tool.result', tool, {
        tool,
        specSha256,
        result,
        test: p.testMode
      });
    });
  }
  async registerKey(id: string, key: {jwk: JWK; thumbprint: string}, confirmation: string) {
    requireConfirmation(confirmation, 'REGISTER_MY_AGENT_KEY');
    return this.action(id, 'agent_keys.register', async (c, p) => {
      const keyId = `platform-${randomUUID()}`;
      try {await c.query('INSERT INTO platform_agent_key(id,user_id,thumbprint,public_jwk) VALUES($1,$2,$3,$4)', [keyId, p.id, key.thumbprint, JSON.stringify(key.jwk)]);}
      catch (error) {if ((error as {code?: string}).code === '23505') throw new AccessError('key_already_registered'); throw error;}
      await this.audit(c, p, 'agent_key.register', keyId, {thumbprint: key.thumbprint});
      return {keyId, thumbprint: key.thumbprint, transportStatus: 'pending_owner_email_enrollment'};
    });
  }
  listKeys(id: string) {
    return this.action(id, 'agent_keys.list', async (c, p) => {
      const keys = (await c.query('SELECT id AS "keyId",thumbprint,public_jwk AS "publicJwk",created_at AS "createdAt",revoked_at AS "revokedAt" FROM platform_agent_key WHERE user_id=$1 ORDER BY created_at,id', [p.id])).rows;
      return {keys, transportStatus: 'email_registry_separate'};
    });
  }
  async revokeKey(id: string, keyId: string, confirmation: string) {
    requireConfirmation(confirmation, `REVOKE_MY_AGENT_KEY:${keyId}`);
    return this.action(id, 'agent_keys.revoke', async (c, p) => {
      const key = (await c.query('UPDATE platform_agent_key SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id', [keyId, p.id])).rows[0];
      if (!key) throw new AccessError('active_owned_key_required');
      await this.audit(c, p, 'agent_key.revoke', keyId);
      return {keyId, revoked: true, emailRegistryRevocationRequired: true};
    });
  }
  async inviteAdmin(id: string, email: string, confirmation: string) {
    requireConfirmation(confirmation, `INVITE_ADMIN:${email}`);
    return this.action(id, 'admin.invite', async (c, p) => {
      if (
        email === this.config.superadminEmail ||
        (
          await c.query(
            'SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',
            [email]
          )
        ).rowCount
      )
        throw new AccessError('reserved_identity');
      await c.query(
        "INSERT INTO platform_invitation(email,invited_by,expires_at) VALUES($1,$2,now()+interval '7 days') ON CONFLICT(email) DO UPDATE SET invited_by=excluded.invited_by,expires_at=excluded.expires_at,accepted_by=NULL",
        [email, p.id]
      );
      // Email is private DB data. No outbound invitation message is sent.
      await this.audit(c, p, 'admin.invite', email);
      return { invited: true, expiresInDays: 7, delivery: 'no_message_sent' };
    });
  }
  async revokeAdmin(id: string, userId: string, confirmation: string) {
    requireConfirmation(confirmation, `REVOKE_ADMIN:${userId}`);
    return this.action(id, 'admin.revoke', async (c, p) => {
      // Match resolve()'s lock, so an invitation cannot race this revocation.
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `platform-user:${userId}`
      ]);
      const target = (
        await c.query('SELECT email FROM "user" WHERE id=$1', [userId])
      ).rows[0];
      if (
        !target ||
        String(target.email).toLowerCase() === this.config.superadminEmail
      )
        throw new AccessError('invited_admin_required');
      const changed = await c.query(
        "UPDATE platform_role SET role='client',updated_at=now() WHERE user_id=$1 AND role='admin' RETURNING user_id",
        [userId]
      );
      // Revocation is idempotent for an existing non-owner account.
      await c.query('DELETE FROM platform_invitation WHERE email=$1', [
        String(target.email).toLowerCase()
      ]);
      await this.audit(c, p, 'admin.revoke', userId, {
        confirmation,
        result: changed.rowCount ? 'revoked' : 'already_revoked'
      });
      return { userId, role: 'client' };
    });
  }
  async auditList(
    id: string,
    before: string | undefined,
    limit: number,
    confirmation: string
  ) {
    requireConfirmation(confirmation, 'READ_PRIVATE_AUDIT_LOG');
    return this.action(id, 'admin.audit.list', async (c, p) => {
      const rows = (
        await c.query(
          'SELECT id::text,actor_user_id AS "actorUserId",action,target,details,test_mode AS "testMode",created_at AS "createdAt" FROM platform_audit WHERE ($1::bigint IS NULL OR id<$1::bigint) ORDER BY id DESC LIMIT $2',
          [before ?? null, limit]
        )
      ).rows;
      await this.audit(c, p, 'audit.read', 'platform_audit', {
        limit,
        before: before ?? null
      });
      return {
        records: rows.map((r) => redactedAudit(r, TOOL_ROLES)),
        nextBefore: rows.length === limit ? rows.at(-1).id : null
      };
    });
  }
}
