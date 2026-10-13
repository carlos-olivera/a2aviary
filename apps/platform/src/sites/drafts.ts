import { summary } from './draft-summary.ts';
import {
  channels,
  open,
  session,
  status,
  revoke,
  authenticateUpload,
  sessionByShort,
  probe,
  upload,
} from './uploads.ts';
import {
  preview,
  approvalAccess,
  nonce,
  consume,
  approve,
  assertApproval,
  signPreview,
  previewRow,
} from './snapshots.ts';
import { cleanup } from './cleanup.ts';
import { randomUUID, createHmac } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  contentErrors,
  catalog,
  canonicalJson,
  sha256,
  defaultPolicy,
  SiteError,
} from '@a2aviary/generator';
import type { Sites } from './deployments.ts';
import { siteAccess } from '../admin/site-administration.ts';
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
  /** @internal Shared by domain operations. */
  mac(purpose: string, value: string) {
    return createHmac('sha256', this.secret)
      .update(purpose + '\0' + value)
      .digest('base64url');
  }
  /** @internal Shared by domain operations. */
  capability(id: string) {
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
    d.test_mode = site.test_mode;
    d.policy_version = site.policy_version;
    return { d, site };
  }
  /** @internal Shared by domain operations. */
  revision(d: any, expected: number) {
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
  /** @internal Shared by domain operations. */
  currentPolicy(site: any) {
    if (site.policy_version !== defaultPolicy.version.value)
      throw new SiteError('draft_policy_retired', [
        {
          path: '/policyVersion',
          rule: 'policy.retired',
          limit: defaultPolicy.version.value,
          actual: site.policy_version,
          suggestion:
            'Read or discard this historical draft; create a new 2.2 draft to edit or preview.',
        },
      ]);
  }
  /** @internal Shared by domain operations. */
  summary(d: any) {
    return summary.call(this, d);
  }
  /** @internal Shared by domain operations. */
  async receipt(
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
  /** @internal Shared by domain operations. */
  async saveReceipt(
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
  /** @internal Shared by domain operations. */
  async event(
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
      const { d, site } = await this.draft(c, actor, input.draftId, true);
      this.currentPolicy(site);
      this.revision(d, input.expectedRevision);
      const content = applyContent(d.content, input.operations, {
        test: site.test_mode,
      });
      const updated =
        canonicalJson(d.content) === canonicalJson(content)
          ? d
          : await this.edit(c, d, content);
      const result = this.summary({
        ...updated,
        test_mode: site.test_mode,
        policy_version: site.policy_version,
      });
      await this.saveReceipt(c, actor, input.requestId, d.id, r.hash, result);
      await this.event(c, actor, d.site_id, 'site.draft.apply', 'updated');
      return result;
    });
  }
  /** @internal Shared by domain operations. */
  async edit(c: PoolClient, d: any, content: DraftContent) {
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
  /** @internal Shared by domain operations. */
  channels(s: any) {
    return channels.call(this, s);
  }
  async open(actor: string, id: string, requestId: string) {
    return open.call(this, actor, id, requestId);
  }
  /** @internal Shared by domain operations. */
  async session(c: PoolClient, actor: string, id: string) {
    return session.call(this, c, actor, id);
  }
  async status(actor: string, id: string, after = 0) {
    return status.call(this, actor, id, after);
  }
  async revoke(actor: string, id: string) {
    return revoke.call(this, actor, id);
  }
  // This read is used before HTTP body buffering; the transactional recheck is authoritative.
  async authenticateUpload(id: string, token: string) {
    return authenticateUpload.call(this, id, token);
  }
  async sessionByShort(short: string) {
    return sessionByShort.call(this, short);
  }
  async probe(actor: string, id: string, body: Uint8Array) {
    return probe.call(this, actor, id, body);
  }
  async upload(
    actor: string,
    id: string,
    uploadId: string,
    bytes: Uint8Array,
    channel: 'human' | 'agent',
  ) {
    return upload.call(this, actor, id, uploadId, bytes, channel);
  }
  async preview(actor: string, id: string, revision: number) {
    return preview.call(this, actor, id, revision);
  }
  async approvalAccess(c: PoolClient, actor: string, specId: string) {
    return approvalAccess.call(this, c, actor, specId);
  }
  async nonce(sessionId: string, target: string) {
    return nonce.call(this, sessionId, target);
  }
  async consume(
    c: PoolClient,
    sessionId: string,
    target: string,
    token: string,
  ) {
    return consume.call(this, c, sessionId, target, token);
  }
  async approve(
    actor: string,
    sessionId: string,
    specId: string,
    token: string,
  ) {
    return approve.call(this, actor, sessionId, specId, token);
  }
  async assertApproval(c: PoolClient, row: any) {
    return assertApproval.call(this, c, row);
  }
  signPreview(specId: string) {
    return signPreview.call(this, specId);
  }
  async previewRow(token: string) {
    return previewRow.call(this, token);
  }
  async cleanup() {
    return cleanup.call(this);
  }
}
