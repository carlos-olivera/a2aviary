import { randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  canonicalJson,
  sha256,
  defaultPolicy,
  SUPPORTED_POLICY_VERSIONS,
  type SiteSpec,
} from '@a2aviary/site-core';
import {
  generateSite,
  GENERATOR_VERSION,
  SiteError,
} from '@a2aviary/generator';

import { blockers, identity } from './draft-content.ts';
import type { Drafts } from './drafts.ts';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export async function preview(
  this: Drafts,
  actor: string,
  id: string,
  revision: number,
) {
  return this.sites.store.siteAction(actor, 'site.preview', async (c, p) => {
    const { d, site } = await this.draft(c, actor, id, true);
    this.revision(d, revision);
    this.currentPolicy(site);
    const missing = blockers(d.content, { test: site.test_mode }, Boolean(site.starter_id));
    if (missing.length) throw new SiteError('draft_incomplete', missing);
    const spec = { ...identity(), ...d.content } as SiteSpec,
      assets = new Map<string, Uint8Array>();
    for (const a of spec.assets)
      assets.set(
        a.id,
        await this.asset(d, a.id),
      );
    const source = await generateSite(spec, assets, {
        serverNormalized: true,
        test: site.test_mode,
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
    const existing = (
      await c.query(
        "SELECT id,state FROM platform_site_spec WHERE draft_id=$1 AND draft_revision=$2 AND cache_key=$3 AND NOT artifacts_deleted AND expires_at>now() AND state IN ('queued','building','verified','approved') ORDER BY created_at DESC LIMIT 1",
        [id, revision, cacheKey],
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
    if (d.base_spec_id) {
      await c.query("UPDATE platform_site_spec SET base_sha256=(SELECT spec_sha256 FROM platform_site_spec WHERE id=$2),accounting='{\"kind\":\"edit\"}' WHERE id=$1", [specId, d.base_spec_id]);
    }
    if (pending && !cached)
      await c.query(
        'UPDATE platform_site_spec SET pending_source_id=$2 WHERE id=$1',
        [specId, pending.id],
      );
    if (cached) {
      const build = await this.sites.readVerifiedBuild(cached);
      await this.sites.copyBuild(cached.id, specId, build, c);
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

export async function approvalAccess(
  this: Drafts,
  c: PoolClient,
  actor: string,
  specId: string,
) {
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
  if (!SUPPORTED_POLICY_VERSIONS.includes(row.spec.policyVersion))
    throw new SiteError('policy_version_unsupported');
  return row;
}

export async function nonce(this: Drafts, sessionId: string, target: string) {
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

export async function consume(
  this: Drafts,
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

export async function approve(
  this: Drafts,
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

export async function assertApproval(this: Drafts, c: PoolClient, row: any) {
  const approval = (
    await c.query('SELECT * FROM platform_site_approval WHERE spec_id=$1', [
      row.id,
    ])
  ).rows[0];
  if (
    !approval ||
    !['approved', 'deploying', 'failed'].includes(row.state) ||
    row.artifacts_deleted ||
    new Date(row.expires_at).getTime() <= Date.now()
  )
    throw new SiteError('snapshot_approval_required');
  const { d, site } = await this.draft(c, approval.actor_id, row.draft_id);
  if (
    (d.base_spec_id ?? null) !== site.current_spec_id ||
    d.revision !== approval.revision ||
    row.draft_revision !== approval.revision ||
    row.spec_sha256 !== approval.spec_sha256 ||
    row.output_sha256 !== approval.output_sha256
  )
    throw new SiteError('snapshot_approval_stale');
}

export function signPreview(this: Drafts, specId: string) {
  const value = specId + '.' + Math.floor(Date.now() / 1000 + 900);
  return value + '.' + this.mac('preview-v1', value);
}

export async function previewRow(this: Drafts, token: string) {
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
  if (!SUPPORTED_POLICY_VERSIONS.includes(row.spec.policyVersion))
    throw new SiteError('policy_version_unsupported');
  return row;
}
