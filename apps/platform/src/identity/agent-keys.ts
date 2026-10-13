import { randomUUID } from 'node:crypto';
import { calculateJwkThumbprint, importJWK, type JWK } from 'jose';

import type { Store } from './store.ts';
import { AccessError, requireConfirmation } from './roles.ts';

export async function registerKey(
  this: Store,
  id: string,
  key: { jwk: JWK; thumbprint: string },
  confirmation: string,
) {
  requireConfirmation(confirmation, 'REGISTER_MY_AGENT_KEY');
  return this.action(id, 'agent_keys.register', async (c, p) => {
    const keyId = `platform-${randomUUID()}`;
    try {
      await c.query(
        'INSERT INTO platform_agent_key(id,user_id,thumbprint,public_jwk) VALUES($1,$2,$3,$4)',
        [keyId, p.id, key.thumbprint, JSON.stringify(key.jwk)],
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505')
        throw new AccessError('key_already_registered');
      throw error;
    }
    await this.audit(c, p, 'agent_key.register', keyId, {
      thumbprint: key.thumbprint,
    });
    return {
      keyId,
      thumbprint: key.thumbprint,
      transportStatus: 'pending_owner_email_enrollment',
    };
  });
}

export function listKeys(this: Store, id: string) {
  return this.action(id, 'agent_keys.list', async (c, p) => {
    const keys = (
      await c.query(
        'SELECT id AS "keyId",thumbprint,public_jwk AS "publicJwk",created_at AS "createdAt",revoked_at AS "revokedAt" FROM platform_agent_key WHERE user_id=$1 ORDER BY created_at,id',
        [p.id],
      )
    ).rows;
    return { keys, transportStatus: 'email_registry_separate' };
  });
}

export async function revokeKey(
  this: Store,
  id: string,
  keyId: string,
  confirmation: string,
) {
  requireConfirmation(confirmation, `REVOKE_MY_AGENT_KEY:${keyId}`);
  return this.action(id, 'agent_keys.revoke', async (c, p) => {
    const key = (
      await c.query(
        'UPDATE platform_agent_key SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id',
        [keyId, p.id],
      )
    ).rows[0];
    if (!key) throw new AccessError('active_owned_key_required');
    await this.audit(c, p, 'agent_key.revoke', keyId);
    return { keyId, revoked: true, emailRegistryRevocationRequired: true };
  });
}

export async function validatePublicKey(
  value: unknown,
): Promise<{ jwk: JWK; thumbprint: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new AccessError('invalid_public_key');
  const jwk = value as JWK;
  if (
    Object.keys(jwk).some(
      (k) => !['kty', 'crv', 'x', 'y', 'alg', 'use', 'key_ops'].includes(k),
    ) ||
    jwk.kty !== 'EC' ||
    jwk.crv !== 'P-256' ||
    (jwk.alg !== undefined && jwk.alg !== 'ES256') ||
    (jwk.use !== undefined && jwk.use !== 'sig') ||
    (jwk.key_ops !== undefined &&
      (!Array.isArray(jwk.key_ops) ||
        jwk.key_ops.length !== 1 ||
        jwk.key_ops[0] !== 'verify')) ||
    !/^[A-Za-z0-9_-]{43}$/.test(jwk.x ?? '') ||
    !/^[A-Za-z0-9_-]{43}$/.test(jwk.y ?? '')
  )
    throw new AccessError('invalid_public_key');
  const normalized: JWK = {
    kty: 'EC',
    crv: 'P-256',
    x: jwk.x,
    y: jwk.y,
    alg: 'ES256',
  };
  try {
    await importJWK(normalized, 'ES256');
    // WebCrypto rejects coordinates not on P-256; also require canonical base64url.
    if (
      [jwk.x!, jwk.y!].some(
        (c) => Buffer.from(c, 'base64url').toString('base64url') !== c,
      )
    )
      throw new Error();
    return {
      jwk: normalized,
      thumbprint: await calculateJwkThumbprint(normalized),
    };
  } catch {
    throw new AccessError('invalid_public_key');
  }
}
