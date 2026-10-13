import type { Store } from '../identity/store.ts';
import { AccessError, requireConfirmation } from '../identity/roles.ts';

export async function revokeAdminEmail(
  this: Store,
  actor: string,
  email: string,
  confirmation: string,
) {
  requireConfirmation(confirmation, 'REVOKE_ADMIN:' + email);
  return this.action(actor, 'admin.revoke', async (c, p) => {
    if (email === this.config.superadminEmail)
      throw new AccessError('invited_admin_required');
    const user = (
      await c.query('SELECT id FROM "user" WHERE lower(email)=$1', [email])
    ).rows[0];
    if (user) {
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'platform-user:' + user.id,
      ]);
      await c.query(
        "UPDATE platform_role SET role='client',updated_at=now() WHERE user_id=$1 AND role='admin'",
        [user.id],
      );
    }
    await c.query('DELETE FROM platform_invitation WHERE email=$1', [email]);
    await this.audit(c, p, 'admin.revoke', email, {
      confirmation,
      result: 'revoked',
    });
    return { email, revoked: true };
  });
}

export async function inviteAdmin(
  this: Store,
  id: string,
  email: string,
  confirmation: string,
) {
  requireConfirmation(confirmation, `INVITE_ADMIN:${email}`);
  return this.action(id, 'admin.invite', async (c, p) => {
    if (
      email === this.config.superadminEmail ||
      (
        await c.query(
          'SELECT 1 FROM platform_tester WHERE email=$1 AND enabled',
          [email],
        )
      ).rowCount
    )
      throw new AccessError('reserved_identity');
    await c.query(
      "INSERT INTO platform_invitation(email,invited_by,expires_at) VALUES($1,$2,now()+interval '7 days') ON CONFLICT(email) DO UPDATE SET invited_by=excluded.invited_by,expires_at=excluded.expires_at,accepted_by=NULL",
      [email, p.id],
    );
    // Email is private DB data. No outbound invitation message is sent.
    await this.audit(c, p, 'admin.invite', email);
    return { invited: true, expiresInDays: 7, delivery: 'no_message_sent' };
  });
}

export async function revokeAdmin(
  this: Store,
  id: string,
  userId: string,
  confirmation: string,
) {
  requireConfirmation(confirmation, `REVOKE_ADMIN:${userId}`);
  return this.action(id, 'admin.revoke', async (c, p) => {
    // Match resolve()'s lock, so an invitation cannot race this revocation.
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `platform-user:${userId}`,
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
      [userId],
    );
    // Revocation is idempotent for an existing non-owner account.
    await c.query('DELETE FROM platform_invitation WHERE email=$1', [
      String(target.email).toLowerCase(),
    ]);
    await this.audit(c, p, 'admin.revoke', userId, {
      confirmation,
      result: changed.rowCount ? 'revoked' : 'already_revoked',
    });
    return { userId, role: 'client' };
  });
}
