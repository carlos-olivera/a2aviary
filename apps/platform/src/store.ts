import { randomUUID } from 'node:crypto';
import { calculateJwkThumbprint, importJWK, type JWK } from 'jose';
import type { Pool, PoolClient } from 'pg';
import type { Config } from './config.ts';

export type Role = 'superadmin' | 'admin' | 'client' | 'tester';
export interface Principal {id: string; role: Role; testMode: boolean}
export class AccessError extends Error {
  readonly code: string;
  constructor(code: string) {super(code); this.code = code;}
}
export const ALL_ROLES: readonly Role[] = ['superadmin', 'admin', 'client', 'tester'];
export const TOOL_ROLES: Record<string, readonly Role[]> = {
  'capabilities.get': ALL_ROLES, 'plans.list': ALL_ROLES, 'plan.get_manifest': ALL_ROLES,
  'plan.get_schemas': ALL_ROLES, 'policy.version': ALL_ROLES,
  'agent_keys.register': ALL_ROLES, 'agent_keys.list': ALL_ROLES, 'agent_keys.revoke': ALL_ROLES,
  'admin.invite': ['superadmin'], 'admin.revoke': ['superadmin'], 'admin.audit.list': ['superadmin', 'admin']
};
export function requireRole(principal: Principal, tool: string) {
  if (!TOOL_ROLES[tool]?.includes(principal.role)) throw new AccessError('forbidden');
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
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`platform-user:${id}`]);
    const user = (await client.query('SELECT email,"emailVerified" FROM "user" WHERE id=$1 FOR SHARE', [id])).rows[0];
    if (!user?.emailVerified) throw new AccessError('verified_user_required');
    const email = String(user.email).toLowerCase();
    let role: Role = 'client';
    if (email === this.config.superadminEmail) role = 'superadmin';
    else if (this.config.testerEmails.has(email)) role = 'tester';
    else {
      const existing = (await client.query('SELECT role FROM platform_role WHERE user_id=$1', [id])).rows[0];
      const invitation = (await client.query('SELECT email FROM platform_invitation WHERE email=$1 AND expires_at > now() AND accepted_by IS NULL FOR UPDATE', [email])).rows[0];
      if (existing?.role === 'admin' || invitation) role = 'admin';
      if (invitation) await client.query('UPDATE platform_invitation SET accepted_by=$1 WHERE email=$2', [id, email]);
    }
    const previous = (await client.query('SELECT role FROM platform_role WHERE user_id=$1', [id])).rows[0];
    const p: Principal = {id, role, testMode: role === 'tester'};
    if (previous?.role !== role) {
      await client.query('INSERT INTO platform_role(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role,updated_at=now()', [id, role]);
      await this.audit(client, p, 'role.resolve', id, {previousRole: previous?.role ?? null, role});
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
  private action<T>(id: string, tool: string, fn: (c: PoolClient, p: Principal) => Promise<T>) {
    return this.transaction(async c => {const p = await this.resolve(c, id); requireRole(p, tool); return fn(c, p);});
  }
  recordToolCall(id: string, tool: string) {
    return this.action(id, tool, async (c, p) => {await this.audit(c, p, 'tool.call', tool);});
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
    if (email === this.config.superadminEmail || this.config.testerEmails.has(email)) throw new AccessError('reserved_identity');
    return this.action(id, 'admin.invite', async (c, p) => {
      await c.query("INSERT INTO platform_invitation(email,invited_by,expires_at) VALUES($1,$2,now()+interval '7 days') ON CONFLICT(email) DO UPDATE SET invited_by=excluded.invited_by,expires_at=excluded.expires_at,accepted_by=NULL", [email, p.id]);
      // Email is private DB data. No outbound invitation message is sent.
      await this.audit(c, p, 'admin.invite', email);
      return {invited: true, expiresInDays: 7, delivery: 'no_message_sent'};
    });
  }
  async revokeAdmin(id: string, userId: string, confirmation: string) {
    requireConfirmation(confirmation, `REVOKE_ADMIN:${userId}`);
    return this.action(id, 'admin.revoke', async (c, p) => {
      // Match resolve()'s lock, so an invitation cannot race this revocation.
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`platform-user:${userId}`]);
      const target = (await c.query('SELECT email FROM "user" WHERE id=$1', [userId])).rows[0];
      if (!target || String(target.email).toLowerCase() === this.config.superadminEmail) throw new AccessError('invited_admin_required');
      const changed = await c.query("UPDATE platform_role SET role='client',updated_at=now() WHERE user_id=$1 AND role='admin' RETURNING user_id", [userId]);
      if (!changed.rowCount) throw new AccessError('invited_admin_required');
      await c.query('DELETE FROM platform_invitation WHERE email=$1', [String(target.email).toLowerCase()]);
      await this.audit(c, p, 'admin.revoke', userId);
      return {userId, role: 'client'};
    });
  }
  async auditList(id: string, before: string | undefined, limit: number, confirmation: string) {
    requireConfirmation(confirmation, 'READ_PRIVATE_AUDIT_LOG');
    return this.action(id, 'admin.audit.list', async (c, p) => {
      const rows = (await c.query('SELECT id::text,actor_user_id AS "actorUserId",action,target,details,test_mode AS "testMode",created_at AS "createdAt" FROM platform_audit WHERE ($1::bigint IS NULL OR id<$1::bigint) ORDER BY id DESC LIMIT $2', [before ?? null, limit])).rows;
      await this.audit(c, p, 'audit.read', 'platform_audit', {limit, before: before ?? null});
      return {records: rows, nextBefore: rows.length === limit ? rows.at(-1).id : null};
    });
  }
}
