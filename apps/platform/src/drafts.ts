import {
  randomUUID,
  randomBytes,
  createHmac,
  timingSafeEqual,
} from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  generateSite,
  canonicalJson,
  sha256,
  defaultPolicy,
  GENERATOR_VERSION,
  normalizeImage,
  SiteError,
  type VerifiedBuild,
  type SiteSpec,
} from '@a2aviary/generator';
import type { Sites } from './sites.ts';
import { siteAccess } from './site-administration.ts';
import {
  applyContent,
  blockers,
  identity,
  type DraftContent,
} from './draft-content.ts';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export class Drafts {
  readonly sites: Sites;
  readonly origin: string;
  private readonly secret: string;
  constructor(sites: Sites, origin: string, secret: string) {
    this.sites = sites;
    this.origin = origin;
    this.secret = secret;
  }
  private mac(purpose: string, value: string) {
    return createHmac('sha256', this.secret)
      .update(purpose + '\0' + value)
      .digest('base64url');
  }
  private capability(id: string) {
    return this.mac('upload-capability-v1', id);
  }
  async access(c: PoolClient, actor: string, siteId: string) {
    const p = await this.sites.store.currentPrincipal(c, actor);
    const s = await siteAccess(c, p, siteId);
    if (s.owner_id !== actor) {
      const u = (await c.query('SELECT email FROM "user" WHERE id=$1', [actor]))
        .rows[0];
      if (
        !(
          await c.query(
            'SELECT 1 FROM platform_site_admin WHERE site_id=$1 AND email=lower($2) AND enabled',
            [siteId, u.email],
          )
        ).rowCount
      )
        throw new SiteError('site_membership_required');
    }
    return s;
  }
  async draft(c: PoolClient, actor: string, id: string, mutable = false) {
    const found = (
      await c.query('SELECT site_id FROM platform_site_draft WHERE id=$1', [id])
    ).rows[0];
    if (!found) throw new SiteError('draft_not_found');
    const site = await this.access(c, actor, found.site_id);
    const d = (
      await c.query(
        'SELECT * FROM platform_site_draft WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (
      d.state !== 'active' ||
      new Date(d.expires_at).getTime() <= Date.now() ||
      Date.now() - new Date(d.created_at).getTime() >= 30 * 86400000
    )
      throw new SiteError('draft_expired');
    if (mutable) {
      if (site.current_spec_id) throw new SiteError('initial_site_only');
      if (
        (
          await c.query(
            "SELECT 1 FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.kind='deploy' AND j.state IN ('queued','running','unknown')",
            [site.id],
          )
        ).rowCount
      )
        throw new SiteError('deployment_busy');
    }
    return { d, site };
  }
  private revision(d: any, expected: number) {
    if (d.revision !== expected)
      throw new SiteError('revision_conflict', [
        {
          path: '/expectedRevision',
          rule: 'revision',
          limit: d.revision,
          actual: expected,
          suggestion: 'Reload the draft and rebase this batch.',
        },
      ]);
  }
  private summary(d: any) {
    const result = {
      draftId: d.id,
      siteId: d.site_id,
      revision: d.revision,
      state: d.state,
      pages: d.content.pages.length,
      assets: d.content.assets.length,
      missing: blockers(d.content),
      budget: {
        jsonBytesRemaining:
          262144 -
          Buffer.byteLength(canonicalJson({ ...identity(), ...d.content })),
        imagesRemaining: 50 - d.content.assets.length,
        imageBytesRemaining:
          25 * 1024 * 1024 -
          d.content.assets.reduce((n: number, a: any) => n + a.bytes, 0),
      },
      expiresAt: d.expires_at,
    };
    while (
      Buffer.byteLength(JSON.stringify(result)) > 4096 &&
      result.missing.length
    )
      result.missing.pop();
    return result;
  }
  private async receipt(
    c: PoolClient,
    actor: string,
    requestId: string,
    input: unknown,
  ) {
    if (!uuid.test(requestId)) throw new SiteError('request_id_required');
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      actor + ':' + requestId,
    ]);
    const hash = sha256(canonicalJson(input)),
      r = (
        await c.query(
          'SELECT * FROM platform_draft_receipt WHERE actor_id=$1 AND request_id=$2',
          [actor, requestId],
        )
      ).rows[0];
    if (r && r.request_sha256 !== hash)
      throw new SiteError('idempotency_conflict');
    return { hash, response: r?.response };
  }
  private async saveReceipt(
    c: PoolClient,
    actor: string,
    id: string,
    draftId: string,
    hash: string,
    response: unknown,
  ) {
    await c.query(
      'INSERT INTO platform_draft_receipt(actor_id,request_id,draft_id,request_sha256,response) VALUES($1,$2,$3,$4,$5)',
      [actor, id, draftId, hash, JSON.stringify(response)],
    );
  }
  async trackPrefix(prefix: string) {
    await this.sites.store.pool.query(
      'INSERT INTO platform_artifact_prefix(prefix) VALUES($1) ON CONFLICT DO NOTHING',
      [prefix],
    );
  }
  async create(actor: string, slug: string, requestId: string) {
    return this.sites.store.siteAction(
      actor,
      'site.draft.create',
      async (c, p) => {
        const r = await this.receipt(c, actor, requestId, {
          op: 'create',
          slug,
        });
        if (r.response) {
          const d = (
            await c.query(
              'SELECT site_id FROM platform_site_draft WHERE id=$1',
              [r.response.draftId],
            )
          ).rows[0];
          if (!d) throw new SiteError('draft_not_found');
          await this.access(c, actor, d.site_id);
          return r.response;
        }
        if (!/^[a-z][a-z0-9-]{0,63}$/.test(slug))
          throw new SiteError('slug_required');
        await c.query("SELECT pg_advisory_xact_lock(hashtext('draft-count'))");
        const counts = (
          await c.query(
            "SELECT count(*)::int AS total,count(*) FILTER(WHERE s.owner_id=$1)::int AS owned FROM platform_site_draft d JOIN platform_site s ON s.id=d.site_id WHERE d.state='active' AND d.expires_at>now() AND d.created_at>now()-interval '30 days'",
            [actor],
          )
        ).rows[0];
        if (counts.owned >= 3 || counts.total >= 50)
          throw new SiteError('draft_quota');
        if (
          (
            await c.query(
              'SELECT 1 FROM platform_site WHERE owner_id=$1 AND slug=$2',
              [actor, slug],
            )
          ).rowCount
        )
          throw new SiteError('slug_exists');
        await c.query(
          "SELECT pg_advisory_xact_lock(hashtext('a2aviary-first-client'))",
        );
        const pilot =
          !p.testMode &&
          !(
            await c.query(
              'SELECT 1 FROM platform_site WHERE first_client_pilot',
            )
          ).rowCount;
        const siteId = randomUUID(),
          id = randomUUID();
        await c.query(
          'INSERT INTO platform_site(id,owner_id,slug,plan_id,policy_version,test_mode,first_client_pilot) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [
            siteId,
            actor,
            slug,
            defaultPolicy.planId.value,
            defaultPolicy.version.value,
            p.testMode,
            pilot,
          ],
        );
        const d = (
          await c.query(
            'INSERT INTO platform_site_draft(id,site_id,content) VALUES($1,$2,$3) RETURNING *',
            [id, siteId, JSON.stringify({ pages: [], assets: [] })],
          )
        ).rows[0];
        const result = this.summary(d);
        await this.saveReceipt(c, actor, requestId, id, r.hash, result);
        await this.event(c, actor, siteId, 'site.draft.create', 'created');
        return result;
      },
    );
  }
  private async event(
    c: PoolClient,
    actor: string,
    siteId: string,
    kind: string,
    result: string,
  ) {
    const p = await this.sites.store.currentPrincipal(c, actor),
      site = await this.access(c, actor, siteId);
    await this.sites.administration.event(c, p, site, kind, result);
  }
  async apply(
    actor: string,
    input: {
      draftId: string;
      expectedRevision: number;
      requestId: string;
      operations: any[];
    },
  ) {
    return this.sites.store.siteAction(actor, 'site.draft.apply', async (c) => {
      const r = await this.receipt(c, actor, input.requestId, {
        op: 'apply',
        ...input,
      });
      if (r.response) {
        const saved = (
          await c.query('SELECT site_id FROM platform_site_draft WHERE id=$1', [
            input.draftId,
          ])
        ).rows[0];
        if (!saved) throw new SiteError('draft_not_found');
        await this.access(c, actor, saved.site_id);
        return r.response;
      }
      const { d } = await this.draft(c, actor, input.draftId, true);
      this.revision(d, input.expectedRevision);
      const content = applyContent(d.content, input.operations);
      const updated =
        canonicalJson(d.content) === canonicalJson(content)
          ? d
          : await this.edit(c, d, content);
      const result = this.summary(updated);
      await this.saveReceipt(c, actor, input.requestId, d.id, r.hash, result);
      await this.event(c, actor, d.site_id, 'site.draft.apply', 'updated');
      return result;
    });
  }
  private async edit(c: PoolClient, d: any, content: DraftContent) {
    const retained = new Set(content.assets.map((a) => a.id));
    for (const asset of d.content.assets)
      if (!retained.has(asset.id))
        await c.query(
          'UPDATE platform_asset_staging SET discarded=true WHERE draft_id=$1 AND asset_id=$2',
          [d.id, asset.id],
        );
    await c.query(
      "UPDATE platform_site_spec SET state='superseded' WHERE draft_id=$1 AND state IN ('queued','building','verified','approved','failed')",
      [d.id],
    );
    await c.query(
      "UPDATE platform_site_job SET state='failed',finished_at=now() WHERE spec_id IN (SELECT id FROM platform_site_spec WHERE draft_id=$1 AND state='superseded') AND state='queued'",
      [d.id],
    );
    return (
      await c.query(
        "UPDATE platform_site_draft SET content=$2,revision=revision+1,updated_at=now(),expires_at=LEAST(now()+interval '7 days',created_at+interval '30 days') WHERE id=$1 RETURNING *",
        [d.id, JSON.stringify(content)],
      )
    ).rows[0];
  }
  async get(actor: string, id: string, detail?: string, after = 0) {
    return this.sites.store.siteAction(actor, 'site.draft.get', async (c) => {
      const { d } = await this.draft(c, actor, id);
      if (detail === 'full') return { ...this.summary(d), content: d.content };
      if (detail === 'assets')
        return {
          draftId: id,
          revision: d.revision,
          assets: d.content.assets.slice(after, after + 20),
          nextAfter: d.content.assets.length > after + 20 ? after + 20 : null,
        };
      if (detail) {
        const page = d.content.pages.find((p: any) => p.id === detail);
        if (!page) throw new SiteError('draft_target');
        return { draftId: id, revision: d.revision, page };
      }
      return this.summary(d);
    });
  }
  async discard(actor: string, id: string, revision: number) {
    return this.sites.store.siteAction(
      actor,
      'site.draft.discard',
      async (c) => {
        const { d } = await this.draft(c, actor, id, true);
        this.revision(d, revision);
        await this.edit(c, d, d.content);
        await c.query(
          "UPDATE platform_site_draft SET state='discarded' WHERE id=$1",
          [id],
        );
        await c.query(
          'UPDATE platform_upload_session SET revoked=true WHERE draft_id=$1',
          [id],
        );
        return { draftId: id, state: 'discarded' };
      },
    );
  }
  private channels(s: any) {
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
  async open(actor: string, id: string, requestId: string) {
    return this.sites.store.siteAction(actor, 'site.upload.open', async (c) => {
      const { d, site } = await this.draft(c, actor, id, true),
        r = await this.receipt(c, actor, requestId, {
          op: 'upload.open',
          draftId: id,
        });
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
  private async session(c: PoolClient, actor: string, id: string) {
    const found = (
      await c.query(
        'SELECT draft_id FROM platform_upload_session WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!found) throw new SiteError('upload_session_invalid');
    await this.draft(c, actor, found.draft_id, true);
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
  async status(actor: string, id: string, after = 0) {
    return this.sites.store.siteAction(
      actor,
      'site.upload.status',
      async (c) => {
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
      },
    );
  }
  async revoke(actor: string, id: string) {
    return this.sites.store.siteAction(
      actor,
      'site.upload.revoke',
      async (c) => {
        await this.session(c, actor, id);
        await c.query(
          'UPDATE platform_upload_session SET revoked=true WHERE id=$1',
          [id],
        );
        return { sessionId: id, revoked: true };
      },
    );
  }
  // This read is used before HTTP body buffering; the transactional recheck is authoritative.
  async authenticateUpload(id: string, token: string) {
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
  async sessionByShort(short: string) {
    return (
      await this.sites.store.pool.query(
        'SELECT id,draft_id FROM platform_upload_session WHERE short_id=$1',
        [short],
      )
    ).rows[0];
  }
  async probe(actor: string, id: string, body: Uint8Array) {
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
  async upload(
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
      console.error(JSON.stringify({ event: 'site.upload.failed', test: testMode, code: 'upload_unavailable' }));
      throw new SiteError('upload_unavailable');
    } finally {
      if (locked)
        await lease.query(
          "SELECT pg_advisory_unlock(hashtext('image-decoder'))",
        );
      lease.release();
    }
  }
  async preview(actor: string, id: string, revision: number) {
    return this.sites.store.siteAction(actor, 'site.preview', async (c, p) => {
      const { d, site } = await this.draft(c, actor, id, true);
      this.revision(d, revision);
      const missing = blockers(d.content);
      if (missing.length) throw new SiteError('draft_incomplete', missing);
      const existing = (
        await c.query(
          "SELECT id,state FROM platform_site_spec WHERE draft_id=$1 AND draft_revision=$2 AND NOT artifacts_deleted AND expires_at>now() AND state IN ('queued','building','verified','approved') ORDER BY created_at DESC LIMIT 1",
          [id, revision],
        )
      ).rows[0];
      if (existing)
        return {
          siteId: site.id,
          specId: existing.id,
          state: existing.state,
          approvalUrl: this.origin + '/sites/approve/' + existing.id,
          cached: true,
        };
      if (
        (
          await c.query(
            'SELECT count(*)::int AS n FROM platform_site_spec WHERE draft_id=$1 AND NOT artifacts_deleted',
            [id],
          )
        ).rows[0].n >= 3
      )
        throw new SiteError('snapshot_quota');
      const spec = { ...identity(), ...d.content } as SiteSpec,
        assets = new Map<string, Uint8Array>();
      for (const a of spec.assets)
        assets.set(
          a.id,
          await this.sites.objects.get('drafts/' + id + '/assets/' + a.id),
        );
      const source = await generateSite(spec, assets, {
          serverNormalized: true,
        }),
        checker = sha256(source.files['verify.mjs']),
        cacheKey = sha256(
          canonicalJson({
            owner: site.owner_id,
            test: site.test_mode,
            spec: source.specSha256,
            generator: GENERATOR_VERSION,
            source: source.sourceSha256,
            checker,
            policy: sha256(canonicalJson(defaultPolicy)),
          }),
        );
      const cached = (
        await c.query(
          "SELECT p.* FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE s.owner_id=$1 AND s.test_mode=$2 AND p.cache_key=$3 AND p.state IN ('verified','approved','live','superseded') AND p.output_sha256 IS NOT NULL AND p.expires_at>now() AND NOT p.artifacts_deleted ORDER BY p.created_at DESC LIMIT 1",
          [site.owner_id, site.test_mode, cacheKey],
        )
      ).rows[0];
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [cacheKey]);
      const pending = (
        await c.query(
          "SELECT id FROM platform_site_spec WHERE cache_key=$1 AND (state IN ('queued','building') OR EXISTS(SELECT 1 FROM platform_site_job j WHERE j.spec_id=platform_site_spec.id AND j.kind='build' AND j.state='running')) AND NOT artifacts_deleted AND expires_at>now() ORDER BY created_at LIMIT 1",
          [cacheKey],
        )
      ).rows[0];
      await c.query("SELECT pg_advisory_xact_lock(hashtext('preview-quota'))");
      if (!cached && !pending) {
        const count = (
          await c.query(
            "SELECT count(*)::int AS total,count(*) FILTER(WHERE owner_id=$1)::int AS owned FROM platform_site_quota WHERE kind='preview' AND created_at>now()-interval '24 hours'",
            [site.owner_id],
          )
        ).rows[0];
        if (count.owned >= 5 || count.total >= 25)
          throw new SiteError('preview_quota');
        await c.query(
          "INSERT INTO platform_site_quota(owner_id,kind,amount) VALUES($1,'preview',1)",
          [site.owner_id],
        );
      }
      const specId = randomUUID();
      await this.trackPrefix('specs/' + specId + '/');
      for (const a of spec.assets)
        await this.sites.objects.put(
          'specs/' + specId + '/assets/' + a.id,
          assets.get(a.id)!,
        );
      await c.query(
        'INSERT INTO platform_site_spec(id,site_id,spec,spec_sha256,state,draft_id,draft_revision,cache_key,generator_version,checker_sha256,source_sha256,verification_admitted) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [
          specId,
          site.id,
          JSON.stringify(spec),
          source.specSha256,
          cached ? 'verified' : 'queued',
          id,
          revision,
          cacheKey,
          GENERATOR_VERSION,
          checker,
          source.sourceSha256,
          !cached && !pending,
        ],
      );
      if (pending && !cached)
        await c.query(
          'UPDATE platform_site_spec SET pending_source_id=$2 WHERE id=$1',
          [specId, pending.id],
        );
      if (cached) {
        const build = await this.sites.readVerifiedBuild(cached);
        await this.sites.copyBuild(cached.id, specId, build);
        await c.query(
          'UPDATE platform_site_spec SET source_sha256=$2,output_sha256=$3 WHERE id=$1',
          [specId, build.report.sourceSha256, build.report.outputSha256],
        );
      } else
        await c.query(
          "INSERT INTO platform_site_job(id,spec_id,actor_id,kind) VALUES($1,$2,$3,'build')",
          [randomUUID(), specId, actor],
        );
      p.testMode = site.test_mode;
      await this.event(
        c,
        actor,
        site.id,
        'site.preview',
        cached ? 'cached' : 'queued',
      );
      return {
        siteId: site.id,
        specId,
        state: cached ? 'verified' : 'queued',
        cached: Boolean(cached || pending),
        approvalUrl: this.origin + '/sites/approve/' + specId,
      };
    });
  }
  async approvalAccess(c: PoolClient, actor: string, specId: string) {
    const r = (
      await c.query('SELECT site_id FROM platform_site_spec WHERE id=$1', [
        specId,
      ])
    ).rows[0];
    if (!r) throw new SiteError('snapshot_not_found');
    await this.access(c, actor, r.site_id);
    const row = (
      await c.query('SELECT * FROM platform_site_spec WHERE id=$1 FOR UPDATE', [
        specId,
      ])
    ).rows[0];
    return row;
  }
  async nonce(sessionId: string, target: string) {
    await this.sites.store.pool.query(
      'DELETE FROM platform_browser_nonce WHERE session_id=$1 AND target=$2',
      [sessionId, target],
    );
    const token = randomBytes(32).toString('base64url');
    await this.sites.store.pool.query(
      'INSERT INTO platform_browser_nonce(hash,session_id,target) VALUES($1,$2,$3)',
      [sha256(token), sessionId, target],
    );
    return token;
  }
  async consume(
    c: PoolClient,
    sessionId: string,
    target: string,
    token: string,
  ) {
    if (
      !(
        await c.query(
          'DELETE FROM platform_browser_nonce WHERE hash=$1 AND session_id=$2 AND target=$3 AND expires_at>now() RETURNING hash',
          [sha256(token), sessionId, target],
        )
      ).rowCount
    )
      throw new SiteError('csrf_invalid');
  }
  async approve(
    actor: string,
    sessionId: string,
    specId: string,
    token: string,
  ) {
    return this.sites.store.transaction(async (c) => {
      const row = await this.approvalAccess(c, actor, specId),
        { d } = await this.draft(c, actor, row.draft_id, true);
      await this.consume(c, sessionId, 'approve:' + specId, token);
      if (
        row.state !== 'verified' ||
        row.draft_revision !== d.revision ||
        row.artifacts_deleted ||
        new Date(row.expires_at).getTime() <= Date.now()
      )
        throw new SiteError('snapshot_not_approvable');
      await this.sites.readVerifiedBuild(row);
      await c.query(
        'INSERT INTO platform_site_approval(spec_id,draft_id,actor_id,revision,spec_sha256,output_sha256) VALUES($1,$2,$3,$4,$5,$6)',
        [specId, d.id, actor, d.revision, row.spec_sha256, row.output_sha256],
      );
      await c.query(
        "UPDATE platform_site_spec SET state='approved',expires_at=now()+interval '7 days' WHERE id=$1",
        [specId],
      );
      await this.event(c, actor, row.site_id, 'site.approve', 'approved');
      return { specId, state: 'approved' };
    });
  }
  async assertApproval(c: PoolClient, row: any) {
    const approval = (
      await c.query('SELECT * FROM platform_site_approval WHERE spec_id=$1', [
        row.id,
      ])
    ).rows[0];
    if (
      !approval ||
      !['approved', 'deploying'].includes(row.state) ||
      row.artifacts_deleted ||
      new Date(row.expires_at).getTime() <= Date.now()
    )
      throw new SiteError('snapshot_approval_required');
    const { d, site } = await this.draft(c, approval.actor_id, row.draft_id);
    if (
      site.current_spec_id ||
      d.revision !== approval.revision ||
      row.draft_revision !== approval.revision ||
      row.spec_sha256 !== approval.spec_sha256 ||
      row.output_sha256 !== approval.output_sha256
    )
      throw new SiteError('snapshot_approval_stale');
  }
  signPreview(specId: string) {
    const value = specId + '.' + Math.floor(Date.now() / 1000 + 900);
    return value + '.' + this.mac('preview-v1', value);
  }
  async previewRow(token: string) {
    const parts = token.split('.');
    if (
      parts.length !== 3 ||
      !uuid.test(parts[0]) ||
      !/^\d{10}$/.test(parts[1]) ||
      parts[2].length !== 43 ||
      !timingSafeEqual(
        Buffer.from(parts[2]),
        Buffer.from(this.mac('preview-v1', parts[0] + '.' + parts[1])),
      ) ||
      Number(parts[1]) <= Date.now() / 1000
    )
      throw new SiteError('preview_access_expired');
    const row = (
      await this.sites.store.pool.query(
        'SELECT * FROM platform_site_spec WHERE id=$1',
        [parts[0]],
      )
    ).rows[0];
    if (
      !row ||
      row.artifacts_deleted ||
      new Date(row.expires_at).getTime() <= Date.now()
    )
      throw new SiteError('preview_access_expired');
    return row;
  }
  async cleanup() {
    const pool = this.sites.store.pool;
    const expired = (
      await pool.query(
        "UPDATE platform_site_draft SET state='expired' WHERE id IN (SELECT d.id FROM platform_site_draft d WHERE state='active' AND (expires_at<=now() OR created_at<=now()-interval '30 days') AND NOT EXISTS(SELECT 1 FROM platform_site_job j JOIN platform_site_spec p ON p.id=j.spec_id WHERE p.draft_id=d.id AND j.state IN ('running','queued','unknown')) LIMIT 100) RETURNING id",
      )
    ).rows;
    for (const d of expired)
      await pool.query(
        'UPDATE platform_upload_session SET revoked=true WHERE draft_id=$1',
        [d.id],
      );
    const snapshots = (
      await pool.query(
        "SELECT p.id,p.site_id FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.expires_at<=now() AND NOT p.artifacts_deleted AND p.state NOT IN ('live','deploying','unknown') AND s.current_spec_id IS DISTINCT FROM p.id AND NOT EXISTS(SELECT 1 FROM platform_site_job j WHERE j.spec_id=p.id AND j.state IN ('queued','running','unknown')) ORDER BY p.expires_at LIMIT 20",
      )
    ).rows;
    for (const p of snapshots)
      await this.sites.store.transaction(async (c) => {
        if (
          !(
            await c.query(
              'SELECT id FROM platform_site WHERE id=$1 FOR UPDATE SKIP LOCKED',
              [p.site_id],
            )
          ).rowCount
        )
          return;
        const eligible = await c.query(
          "SELECT p.id FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.id=$1 AND p.expires_at<=now() AND NOT p.artifacts_deleted AND p.state NOT IN ('live','deploying','unknown') AND s.current_spec_id IS DISTINCT FROM p.id AND NOT EXISTS(SELECT 1 FROM platform_site_job j WHERE j.spec_id=p.id AND j.state IN ('queued','running','unknown')) FOR UPDATE OF p SKIP LOCKED",
          [p.id],
        );
        if (!eligible.rowCount) return;
        await this.sites.objects.deletePrefix('specs/' + p.id + '/');
        await c.query(
          "UPDATE platform_site_spec SET artifacts_deleted=true,state=CASE WHEN state='failed' THEN state ELSE 'superseded' END WHERE id=$1",
          [p.id],
        );
      });
    const drafts = (
      await pool.query(
        "SELECT id FROM platform_site_draft WHERE state IN ('expired','discarded') AND NOT artifacts_deleted ORDER BY expires_at LIMIT 20",
      )
    ).rows;
    for (const d of drafts) {
      await this.sites.objects.deletePrefix('drafts/' + d.id + '/');
      await pool.query(
        'UPDATE platform_site_draft SET artifacts_deleted=true WHERE id=$1',
        [d.id],
      );
      await pool.query(
        'UPDATE platform_asset_staging SET cleaned_at=now() WHERE draft_id=$1 AND cleaned_at IS NULL',
        [d.id],
      );
    }
    const orphaned = (
      await pool.query(
        "SELECT a.prefix FROM platform_artifact_prefix a WHERE a.cleaned_at IS NULL AND a.created_at<now()-interval '24 hours' AND NOT EXISTS(SELECT 1 FROM platform_site_spec p WHERE a.prefix='specs/'||p.id||'/') AND NOT EXISTS(SELECT 1 FROM platform_site_draft d WHERE a.prefix='drafts/'||d.id||'/') ORDER BY created_at LIMIT 20",
      )
    ).rows;
    for (const a of orphaned) {
      await this.sites.objects.deletePrefix(a.prefix);
      await pool.query(
        'UPDATE platform_artifact_prefix SET cleaned_at=now() WHERE prefix=$1',
        [a.prefix],
      );
    }
    const staged = (
      await pool.query(
        "SELECT * FROM platform_asset_staging a WHERE cleaned_at IS NULL AND (discarded OR created_at<now()-interval '24 hours') AND NOT EXISTS(SELECT 1 FROM platform_site_draft d WHERE d.id=a.draft_id AND d.state='active' AND d.content->'assets' @>jsonb_build_array(jsonb_build_object('id',a.asset_id))) ORDER BY created_at LIMIT 20",
      )
    ).rows;
    for (const asset of staged)
      await this.sites.store.transaction(async (c) => {
        const draft = (
          await c.query('SELECT site_id FROM platform_site_draft WHERE id=$1', [
            asset.draft_id,
          ])
        ).rows[0];
        if (
          draft &&
          !(
            await c.query(
              'SELECT id FROM platform_site WHERE id=$1 FOR UPDATE SKIP LOCKED',
              [draft.site_id],
            )
          ).rowCount
        )
          return;
        if (
          (
            await c.query(
              "SELECT 1 FROM platform_site_draft WHERE id=$1 AND state='active' AND content->'assets' @>jsonb_build_array(jsonb_build_object('id',$2::text))",
              [asset.draft_id, asset.asset_id],
            )
          ).rowCount
        )
          return;
        await this.sites.objects.deletePrefix(asset.key);
        await c.query(
          'UPDATE platform_asset_staging SET cleaned_at=now() WHERE key=$1',
          [asset.key],
        );
      });
    await pool.query(
      'DELETE FROM platform_upload_session WHERE id IN (SELECT id FROM platform_upload_session WHERE revoked OR expires_at<=now() ORDER BY created_at LIMIT 100)',
    );
    await pool.query(
      'DELETE FROM platform_browser_nonce WHERE hash IN (SELECT hash FROM platform_browser_nonce WHERE expires_at<=now() LIMIT 500)',
    );
    await pool.query(
      "DELETE FROM platform_site_quota WHERE id IN (SELECT id FROM platform_site_quota WHERE created_at<=now()-interval '31 days' LIMIT 1000)",
    );
  }
}
