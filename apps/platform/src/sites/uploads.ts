import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { sha256 } from '@a2aviary/site-core';
import { normalizeImage, SiteError } from '@a2aviary/generator';

import type { Drafts } from './drafts.ts';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function channels(this: Drafts, s: any) {
  return {
    sessionId: s.id,
    expiresAt: s.expires_at,
    human: {
      url: this.origin + '/u/' + s.short_id,
      qrUrl: this.origin + '/u/' + s.short_id + '/qr',
    },
    agent: {
      probe: {
        method: 'PUT',
        url: this.origin + '/api/site-uploads/' + s.id + '/probe',
        bodyBytes: 1,
        timeoutSeconds: 3,
      },
      uploadUrl:
        this.origin + '/api/site-uploads/' + s.id + '/files/{uploadId}',
      method: 'PUT',
      authorization: 'Bearer ' + this.capability(s.id),
      maxBytes: 20 * 1024 * 1024,
    },
    selectionRule:
      'Use the agent channel only if you can run HTTP and read the files. Confirm with the one-byte probe within three seconds. If unavailable or the probe fails, show the human link/QR in one sentence and wait. Both channels share progress.',
  };
}

export async function open(
  this: Drafts,
  actor: string,
  id: string,
  requestId: string,
) {
  return this.sites.store.siteAction(actor, 'site.upload.open', async (c) => {
    const { d, site } = await this.draft(c, actor, id, true),
      r = await this.receipt(c, actor, requestId, {
        op: 'upload.open',
        draftId: id,
      });
    this.currentPolicy(site);
    if (r.response) {
      const s = await this.session(c, actor, r.response.sessionId);
      return this.channels(s);
    }
    await c.query("SELECT pg_advisory_xact_lock(hashtext('upload-count'))");
    const counts = (
      await c.query(
        'SELECT count(*) FILTER(WHERE s.owner_id=$1)::int AS owned,count(*) FILTER(WHERE d.id=$2)::int AS draft FROM platform_upload_session u JOIN platform_site_draft d ON d.id=u.draft_id JOIN platform_site s ON s.id=d.site_id WHERE NOT u.revoked AND u.expires_at>now()',
        [site.owner_id, id],
      )
    ).rows[0];
    if (counts.owned >= 3 || counts.draft)
      throw new SiteError('upload_session_quota');
    const sid = randomUUID();
    const s = (
      await c.query(
        'INSERT INTO platform_upload_session(id,draft_id,short_id,capability_sha256,actor_id) VALUES($1,$2,$3,$4,$5) RETURNING *',
        [
          sid,
          id,
          randomBytes(16).toString('base64url'),
          sha256(this.capability(sid)),
          actor,
        ],
      )
    ).rows[0];
    await this.saveReceipt(c, actor, requestId, d.id, r.hash, {
      sessionId: sid,
    });
    return this.channels(s);
  });
}

export async function session(
  this: Drafts,
  c: PoolClient,
  actor: string,
  id: string,
) {
  const found = (
    await c.query('SELECT draft_id FROM platform_upload_session WHERE id=$1', [
      id,
    ])
  ).rows[0];
  if (!found) throw new SiteError('upload_session_invalid');
  const foundDraft = await this.draft(c, actor, found.draft_id, true);
  this.currentPolicy(foundDraft.site);
  const s = (
    await c.query(
      'SELECT * FROM platform_upload_session WHERE id=$1 FOR UPDATE',
      [id],
    )
  ).rows[0];
  if (s.revoked || new Date(s.expires_at).getTime() <= Date.now())
    throw new SiteError('upload_session_expired');
  return s;
}

export async function status(
  this: Drafts,
  actor: string,
  id: string,
  after = 0,
) {
  return this.sites.store.siteAction(actor, 'site.upload.status', async (c) => {
    const s = await this.session(c, actor, id),
      files = (
        await c.query(
          'SELECT upload_id AS "uploadId",asset_id AS "assetId",metadata,channel FROM platform_upload_file WHERE session_id=$1 ORDER BY position OFFSET $2 LIMIT 21',
          [id, after],
        )
      ).rows;
    const result = {
      sessionId: id,
      expiresAt: s.expires_at,
      probed: Boolean(s.probed_at),
      rawBytesRemaining: 100 * 1024 * 1024 - s.raw_bytes,
      files: files.slice(0, 20),
      nextAfter: files.length > 20 ? after + 20 : null,
    };
    while (
      Buffer.byteLength(JSON.stringify(result)) > 4096 &&
      result.files.length
    ) {
      result.files.pop();
      result.nextAfter = after + result.files.length;
    }
    return result;
  });
}

export async function revoke(this: Drafts, actor: string, id: string) {
  return this.sites.store.siteAction(actor, 'site.upload.revoke', async (c) => {
    await this.session(c, actor, id);
    await c.query(
      'UPDATE platform_upload_session SET revoked=true WHERE id=$1',
      [id],
    );
    return { sessionId: id, revoked: true };
  });
}

export async function authenticateUpload(
  this: Drafts,
  id: string,
  token: string,
) {
  if (!uuid.test(id) || !token || token.length > 128)
    throw new SiteError('upload_capability_invalid');
  const s = (
    await this.sites.store.pool.query(
      'SELECT * FROM platform_upload_session WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (
    !s ||
    !timingSafeEqual(
      Buffer.from(s.capability_sha256),
      Buffer.from(sha256(token)),
    )
  )
    throw new SiteError('upload_capability_invalid');
  await this.sites.store.transaction((c) => this.session(c, s.actor_id, id));
  return s.actor_id as string;
}

export async function sessionByShort(this: Drafts, short: string) {
  return (
    await this.sites.store.pool.query(
      'SELECT id,draft_id FROM platform_upload_session WHERE short_id=$1',
      [short],
    )
  ).rows[0];
}

export async function probe(
  this: Drafts,
  actor: string,
  id: string,
  body: Uint8Array,
) {
  if (body.length !== 1) throw new SiteError('probe_size');
  return this.sites.store.transaction(async (c) => {
    await this.session(c, actor, id);
    await c.query(
      'UPDATE platform_upload_session SET probed_at=now() WHERE id=$1',
      [id],
    );
    return { ok: true };
  });
}

export async function upload(
  this: Drafts,
  actor: string,
  id: string,
  uploadId: string,
  bytes: Uint8Array,
  channel: 'human' | 'agent',
) {
  if (!uuid.test(uploadId)) throw new SiteError('upload_id_required');
  if (!bytes.length || bytes.length > 20 * 1024 * 1024)
    throw new SiteError('raw_image_bytes');
  const rawHash = sha256(bytes);
  // A dedicated connection lock serializes raw admission/decoding across all instances.
  const lease = await this.sites.store.pool.connect();
  let locked = false;
  let testMode = false;
  try {
    locked = (
      await lease.query(
        "SELECT pg_try_advisory_lock(hashtext('image-decoder')) AS ok",
      )
    ).rows[0].ok;
    if (!locked) throw new SiteError('upload_busy');
    const admitted = await this.sites.store.transaction(async (c) => {
      const s = await this.session(c, actor, id),
        { d, site } = await this.draft(c, actor, s.draft_id, true);
      this.currentPolicy(site);
      testMode = site.test_mode;
      const existing = (
        await c.query(
          'SELECT * FROM platform_upload_file WHERE session_id=$1 AND upload_id=$2',
          [id, uploadId],
        )
      ).rows[0];
      if (existing) {
        if (existing.raw_sha256 !== rawHash)
          throw new SiteError('idempotency_conflict');
        return { existing };
      }
      if (
        s.attempts >= 100 ||
        Number(s.raw_bytes) + bytes.length > 100 * 1024 * 1024
      )
        throw new SiteError('upload_session_budget');
      await c.query("SELECT pg_advisory_xact_lock(hashtext('raw-quota'))");
      const q = (
        await c.query(
          "SELECT COALESCE(sum(amount),0)::bigint AS total,COALESCE(sum(amount) FILTER(WHERE owner_id=$1),0)::bigint AS owned FROM platform_site_quota WHERE kind='upload' AND created_at>now()-interval '24 hours'",
          [site.owner_id],
        )
      ).rows[0];
      if (
        Number(q.owned) + bytes.length > 200 * 1024 * 1024 ||
        Number(q.total) + bytes.length > 1024 * 1024 * 1024
      )
        throw new SiteError('upload_quota');
      await c.query(
        "INSERT INTO platform_site_quota(owner_id,kind,amount) VALUES($1,'upload',$2)",
        [site.owner_id, bytes.length],
      );
      await c.query(
        'UPDATE platform_upload_session SET attempts=attempts+1,raw_bytes=raw_bytes+$2 WHERE id=$1',
        [id, bytes.length],
      );
      return { draftId: d.id };
    });
    if (admitted.existing)
      return {
        assetId: admitted.existing.asset_id,
        ...admitted.existing.metadata,
        retried: true,
      };
    const normalized = await normalizeImage(bytes);
    return await this.sites.store.transaction(async (c) => {
      const s = await this.session(c, actor, id),
        { d } = await this.draft(c, actor, s.draft_id, true);
      const duplicate = d.content.assets.find(
          (a: any) => a.sha256 === normalized.metadata.sha256,
        ),
        assetId = duplicate?.id ?? 'asset-' + randomUUID(),
        metadata = { ...normalized.metadata };
      let updated = d;
      if (!duplicate) {
        if (
          d.content.assets.length >= 50 ||
          d.content.assets.reduce((n: number, a: any) => n + a.bytes, 0) +
            normalized.bytes.length >
            25 * 1024 * 1024
        )
          throw new SiteError('draft_image_budget');
        await this.trackPrefix('drafts/' + d.id + '/');
        await this.sites.store.pool.query(
          'INSERT INTO platform_asset_staging(key,draft_id,asset_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          ['drafts/' + d.id + '/assets/' + assetId, d.id, assetId],
        );
        await this.sites.objects.put(
          'drafts/' + d.id + '/assets/' + assetId,
          normalized.bytes,
        );
        const { normalizerVersion: _, ...asset } = metadata;
        updated = await this.edit(c, d, {
          ...d.content,
          assets: [...d.content.assets, { ...asset, id: assetId }],
        });
      }
      await c.query(
        'INSERT INTO platform_upload_file(session_id,upload_id,asset_id,raw_sha256,metadata,channel) VALUES($1,$2,$3,$4,$5,$6)',
        [id, uploadId, assetId, rawHash, JSON.stringify(metadata), channel],
      );
      await this.event(c, actor, d.site_id, 'site.upload', 'normalized');
      return { assetId, ...metadata, revision: updated.revision };
    });
  } catch (error) {
    if (error instanceof SiteError) throw error;
    console.error(
      JSON.stringify({
        event: 'site.upload.failed',
        test: testMode,
        code: 'upload_unavailable',
      }),
    );
    throw new SiteError('upload_unavailable');
  } finally {
    if (locked)
      await lease.query("SELECT pg_advisory_unlock(hashtext('image-decoder'))");
    lease.release();
  }
}
