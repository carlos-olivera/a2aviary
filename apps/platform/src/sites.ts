import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv
} from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  generateSite,
  validateSiteSpec,
  validateAssets,
  validatePreview,
  validateChangeRequest,
  specDigest,
  canonicalJson,
  defaultPolicy,
  assertVerified,
  SiteError,
  VerificationFailure,
  type SiteSpec,
  type ObjectStore,
  type BuildVerifier,
  type SiteDeployer,
  type SiteResources,
  type PreviewBundle,
  type VerifiedBuild
} from '@a2aviary/generator';
import {
  Store,
  AccessError,
  requireRole,
  requireConfirmation,
  type Principal
} from './store.ts';
import {
  SiteAdministration,
  siteAccess,
  type CatalogSite
} from './site-administration.ts';
export interface Submission {
  siteId?: string;
  slug?: string;
  spec: unknown;
  assets: Record<string, string>;
  preview: PreviewBundle;
}
type SpecRow = {
  id: string;
  site_id: string;
  spec: SiteSpec;
  spec_sha256: string;
  state: string;
  base_sha256: string | null;
  accounting: unknown;
  reserved: boolean;
  client_password_ciphertext: string | null;
  requested_domain: string | null;
};
type SiteRow = CatalogSite;
export class Sites {
  readonly store: Store;
  readonly objects: ObjectStore;
  readonly verifier: BuildVerifier;
  readonly deployer: SiteDeployer;
  private readonly key: Buffer;
  readonly administration: SiteAdministration;
  constructor(
    store: Store,
    objects: ObjectStore,
    verifier: BuildVerifier,
    deployer: SiteDeployer,
    key: string,
    administration = new SiteAdministration(store)
  ) {
    this.administration = administration;
    this.store = store;
    this.objects = objects;
    this.verifier = verifier;
    this.deployer = deployer;
    if (!/^[a-f0-9]{64}$/.test(key))
      throw new Error('Invalid site credential key');
    this.key = Buffer.from(key, 'hex');
  }
  private seal(password: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv),
      data = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  private open(value: string) {
    const b = Buffer.from(value, 'base64'),
      cipher = createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([
      cipher.update(b.subarray(28)),
      cipher.final()
    ]).toString();
  }
  private name(site: SiteRow) {
    return 'cli-' + String(site.number).padStart(3, '0') + '-' + site.slug;
  }
  private async owned(
    c: PoolClient,
    actor: string,
    siteId: string
  ): Promise<SiteRow> {
    return siteAccess(c, await this.store.currentPrincipal(c, actor), siteId);
  }
  private async row(c: PoolClient, actor: string, specId: string) {
    const siteId = (
      await c.query('SELECT site_id FROM platform_site_spec WHERE id=$1', [
        specId
      ])
    ).rows[0]?.site_id;
    if (!siteId) throw new SiteError('owned_spec_required');
    try {
      await this.owned(c, actor, siteId);
    } catch (error) {
      if (error instanceof SiteError && error.code === 'owned_site_required')
        throw new SiteError('owned_spec_required');
      throw error;
    }
    const row = (
      await c.query('SELECT * FROM platform_site_spec WHERE id=$1 FOR UPDATE', [
        specId
      ])
    ).rows[0] as SpecRow | undefined;
    if (!row) throw new SiteError('owned_spec_required');
    return row;
  }
  private async audit(
    c: PoolClient,
    p: Principal,
    tool: string,
    hash: string | null,
    result: string,
    jobId: string | null = null,
    siteId?: string
  ) {
    await c.query(
      'INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,$5)',
      [
        p.id,
        'site.tool.result',
        tool,
        JSON.stringify({ tool, specSha256: hash, result, test: p.testMode }),
        p.testMode
      ]
    );
    if (siteId) {
      const site = await this.owned(c, p.id, siteId);
      const specId = hash
        ? (
            await c.query(
              'SELECT id FROM platform_site_spec WHERE site_id=$1 AND spec_sha256=$2',
              [siteId, hash]
            )
          ).rows[0]?.id
        : null;
      await this.administration.event(c, p, site, tool, result, specId, jobId, {
        specSha256: hash
      });
    }
  }
  async submit(actor: string, input: Submission) {
    let hash: string | null = null;
    try {
      requireRole(await this.store.principal(actor), 'site.build');
      const spec = validateSiteSpec(input.spec);
      if (!spec.ok) throw new SiteError('invalid_spec', spec.errors);
      hash = specDigest(spec.value);
      const buffers = new Map<string, Uint8Array>();
      for (const [id, b64] of Object.entries(input.assets)) {
        const b = Buffer.from(b64, 'base64');
        if (b.toString('base64') !== b64)
          throw new SiteError('invalid_asset_encoding');
        buffers.set(id, b);
      }
      const assets = await validateAssets(spec.value.assets, buffers);
      if (!assets.ok) throw new SiteError('invalid_assets', assets.errors);
      validatePreview(spec.value, input.preview);
      const specId = randomUUID();
      return await this.store.siteAction(actor, 'site.build', async (c, p) => {
        let site: SiteRow;
        if (input.siteId) site = await this.owned(c, actor, input.siteId);
        else {
          await c.query(
            "SELECT pg_advisory_xact_lock(hashtext('a2aviary-first-client'))"
          );
          const pilot =
            !p.testMode &&
            !(
              await c.query(
                'SELECT 1 FROM platform_site WHERE first_client_pilot'
              )
            ).rowCount;
          if (!input.slug || !/^[a-z][a-z0-9-]{0,63}$/.test(input.slug))
            throw new SiteError('slug_required');
          site = (
            await c.query(
              'INSERT INTO platform_site(id,owner_id,slug,plan_id,policy_version,test_mode,first_client_pilot) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(owner_id,slug) DO UPDATE SET slug=excluded.slug RETURNING *',
              [
                randomUUID(),
                actor,
                input.slug,
                spec.value.planId,
                spec.value.policyVersion,
                p.testMode,
                pilot
              ]
            )
          ).rows[0];
        }
        if (site.lifecycle !== 'active')
          throw new SiteError('site_' + site.lifecycle);
        if (site.test_mode !== p.testMode)
          throw new SiteError('site_mode_mismatch');
        const existing = (
          await c.query(
            'SELECT id,state FROM platform_site_spec WHERE site_id=$1 AND spec_sha256=$2',
            [site.id, hash]
          )
        ).rows[0];
        if (existing) {
          await this.audit(
            c,
            p,
            'site.submit',
            hash,
            'duplicate',
            null,
            site.id
          );
          return {
            siteId: site.id,
            specId: existing.id,
            state: existing.state,
            test: site.test_mode
          };
        }
        // Immutable prepared bytes and previews are bucket objects, never Railway volumes.
        for (const [id, bytes] of buffers)
          await this.objects.put('specs/' + specId + '/assets/' + id, bytes);
        await this.objects.put(
          'specs/' + specId + '/preview.json',
          Buffer.from(canonicalJson(input.preview))
        );
        await c.query(
          'INSERT INTO platform_site_spec(id,site_id,spec,spec_sha256) VALUES($1,$2,$3,$4)',
          [specId, site.id, JSON.stringify(spec.value), hash]
        );
        await this.audit(c, p, 'site.submit', hash, 'accepted', null, site.id);
        return {
          siteId: site.id,
          specId,
          state: 'staged',
          test: site.test_mode,
          free:
            site.test_mode ||
            ['admin', 'superadmin'].includes(
              (await this.store.currentPrincipal(c, site.owner_id)).role
            )
        };
      });
    } catch (error) {
      await this.store.recordSiteResult(
        actor,
        'site.submit',
        hash,
        error instanceof SiteError ? error.code : 'submission_failed'
      );
      throw error;
    }
  }
  async build(actor: string, specId: string) {
    return this.store.siteAction(actor, 'site.build', async (c, p) => {
      const row = await this.row(c, actor, specId);
      const site = await this.owned(c, actor, row.site_id);
      p.testMode = site.test_mode;
      if (['deploying', 'unknown'].includes(row.state))
        throw new SiteError('spec_busy');
      if (['verified', 'live'].includes(row.state)) {
        await this.audit(
          c,
          p,
          'site.build',
          row.spec_sha256,
          'cached',
          null,
          site.id
        );
        return { specId, state: row.state, test: site.test_mode };
      }
      const job = (
        await c.query(
          "INSERT INTO platform_site_job(id,spec_id,actor_id,kind) VALUES($1,$2,$3,'build') ON CONFLICT(spec_id,kind) DO UPDATE SET state=CASE WHEN platform_site_job.state IN ('failed','done') THEN 'queued' ELSE platform_site_job.state END,actor_id=CASE WHEN platform_site_job.state IN ('failed','done') THEN excluded.actor_id ELSE platform_site_job.actor_id END,billing_snapshot=CASE WHEN platform_site_job.state IN ('failed','done') THEN excluded.billing_snapshot ELSE platform_site_job.billing_snapshot END RETURNING id,state",
          [randomUUID(), specId, actor]
        )
      ).rows[0];
      await this.audit(
        c,
        p,
        'site.build',
        row.spec_sha256,
        'queued',
        job.id,
        site.id
      );
      return { specId, jobId: job.id, state: job.state, test: site.test_mode };
    });
  }
  async change(
    actor: string,
    siteId: string,
    input: unknown,
    specId: string,
    confirmation: string
  ) {
    requireConfirmation(confirmation, 'APPLY_CHANGE:' + siteId);
    return this.store.siteAction(actor, 'change.request', async (c, p) => {
      const site = await this.owned(c, actor, siteId);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'site-allowance:' + site.owner_id
      ]);
      p.testMode = site.test_mode;
      if (!site.current_spec_id) throw new SiteError('live_site_required');
      const current = await this.row(c, actor, site.current_spec_id),
        candidate = await this.row(c, actor, specId);
      if (candidate.site_id !== siteId)
        throw new SiteError('candidate_site_mismatch');
      if (
        candidate.reserved &&
        candidate.accounting &&
        candidate.base_sha256 === current.spec_sha256
      ) {
        await this.audit(
          c,
          p,
          'change.request',
          candidate.spec_sha256,
          'cached',
          null,
          site.id
        );
        return {
          specId,
          state: candidate.state,
          accounting: candidate.accounting,
          test: site.test_mode
        };
      }
      const now = (await c.query('SELECT now() AS now')).rows[0].now as Date;
      const usage = await this.usage(c, site.owner_id);
      const checked = validateChangeRequest(input, current.spec, {
        now,
        month: now.toISOString().slice(0, 7),
        appliedRequests: usage
      });
      if (!checked.ok) throw new SiteError('invalid_change', checked.errors);
      if (specDigest(checked.value.spec) !== candidate.spec_sha256)
        throw new SiteError('candidate_digest_mismatch');
      const pending = (
        await c.query(
          'SELECT 1 FROM platform_site_spec WHERE site_id=$1 AND reserved AND id<>$2',
          [siteId, specId]
        )
      ).rowCount;
      if (pending) throw new SiteError('pending_change_required');
      await c.query(
        'UPDATE platform_site_spec SET base_sha256=$2,accounting=$3,reserved=true WHERE id=$1',
        [specId, current.spec_sha256, JSON.stringify(checked.value.accounting)]
      );
      await this.audit(
        c,
        p,
        'change.request',
        candidate.spec_sha256,
        'reserved',
        null,
        site.id
      );
      return {
        specId,
        accounting: checked.value.accounting,
        state: candidate.state,
        test: site.test_mode
      };
    });
  }
  private async usage(c: PoolClient, actor: string): Promise<number> {
    return Number(
      (
        await c.query(
          "SELECT count(*) AS count FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE s.owner_id=$1 AND p.accounting IS NOT NULL AND (p.reserved OR (p.applied_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND p.applied_at<(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'))",
          [actor]
        )
      ).rows[0].count
    );
  }
  async deploy(
    actor: string,
    siteId: string,
    specId: string,
    password: string,
    confirmation: string,
    domain?: string
  ) {
    requireConfirmation(
      confirmation,
      'DEPLOY_SITE:' + siteId + (domain ? ':' + domain : '')
    );
    if (password.length < 16 || password.length > 128)
      throw new SiteError('cms_password_length');
    return this.store.siteAction(actor, 'site.deploy', async (c, p) => {
      const site = await this.owned(c, actor, siteId);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'site-allowance:' + site.owner_id
      ]);
      const row = await this.row(c, actor, specId);
      p.testMode = site.test_mode;
      if (
        site.test_mode &&
        (domain || site.resources.customDomain || site.resources.customDomainId)
      )
        throw new SiteError('test_custom_domain_forbidden');
      if (row.site_id !== siteId)
        throw new SiteError('candidate_site_mismatch');
      if (
        site.current_spec_id &&
        domain &&
        site.resources.customDomain !== domain
      )
        throw new SiteError('domain_change_unsupported');
      if (row.state === 'live' && site.current_spec_id === specId) {
        await this.audit(
          c,
          p,
          'site.deploy',
          row.spec_sha256,
          'cached',
          null,
          site.id
        );
        return { siteId, state: 'live', test: site.test_mode };
      }
      if (row.state !== 'verified')
        throw new SiteError('verified_build_required');
      if (site.current_spec_id) {
        const current = await this.row(c, actor, site.current_spec_id);
        if (
          !row.reserved ||
          !row.accounting ||
          current.spec_sha256 !== row.base_sha256
        )
          throw new SiteError('approved_change_required');
      }
      const active = (
        await c.query(
          "SELECT 1 FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.kind='deploy' AND j.state IN ('queued','running','unknown')",
          [siteId]
        )
      ).rowCount;
      if (active) throw new SiteError('deployment_busy');
      const job = (
        await c.query(
          "INSERT INTO platform_site_job(id,spec_id,actor_id,kind) VALUES($1,$2,$3,'deploy') ON CONFLICT(spec_id,kind) DO UPDATE SET state='queued',actor_id=excluded.actor_id,billing_snapshot=excluded.billing_snapshot,started_at=NULL,finished_at=NULL RETURNING id",
          [randomUUID(), specId, actor]
        )
      ).rows[0];
      await c.query(
        'UPDATE platform_site_spec SET client_password_ciphertext=$2,requested_domain=$3 WHERE id=$1',
        [specId, this.seal(password), domain ?? null]
      );
      await this.audit(
        c,
        p,
        'site.deploy',
        row.spec_sha256,
        'queued',
        job.id,
        site.id
      );
      return {
        siteId,
        specId,
        jobId: job.id,
        state: 'queued',
        test: site.test_mode
      };
    });
  }
  async status(actor: string, siteId: string) {
    const snapshot = await this.store.siteAction(
      actor,
      'site.status',
      async (c, p) => {
        const site = await this.owned(c, actor, siteId);
        p.testMode = site.test_mode;
        const specs = (
          await c.query(
            'SELECT id AS "specId",state,spec_sha256 AS "specSha256",source_sha256 AS "sourceSha256",output_sha256 AS "outputSha256",error_code AS "error",test_mode AS test,accounting,applied_at AS "appliedAt" FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC LIMIT 20',
            [siteId]
          )
        ).rows;
        await this.audit(
          c,
          p,
          'site.status',
          specs[0]?.specSha256 ?? null,
          'read',
          null,
          site.id
        );
        return {
          siteId,
          test: site.test_mode,
          free:
            site.test_mode ||
            ['admin', 'superadmin'].includes(
              (await this.store.currentPrincipal(c, site.owner_id)).role
            ),
          firstClientPilot: site.first_client_pilot,
          currentSpecId: site.current_spec_id,
          policyVersion: site.policy_version,
          siteUrl: site.resources.domain
            ? 'https://' + site.resources.domain
            : null,
          cmsLogin: site.resources.domain
            ? 'https://' + site.resources.domain + '/api/cms/editor.html'
            : null,
          requestedDomain: site.resources.customDomain ?? null,
          specs,
          monthlyRequestsRemaining: Math.max(
            0,
            defaultPolicy.changes.perMonth.value -
              (await this.usage(c, site.owner_id))
          ),
          resources: site.resources,
          name: this.name(site)
        };
      }
    );
    const { resources, name, ...result } = snapshot;
    let domainStatus: unknown = null;
    if (resources.domain) {
      try {
        domainStatus = await this.deployer.status(resources, name, result.test);
      } catch {
        domainStatus = { error: 'railway_status_unavailable' };
      }
    }
    return {
      ...result,
      domainStatus,
      verificationArtifacts: result.specs
        .filter((s) => s.sourceSha256)
        .map((s) => ({
          specId: s.specId,
          reportPath: '/api/site-artifacts/' + s.specId + '/report.json',
          bundlePath: '/api/site-artifacts/' + s.specId + '/site.json'
        }))
    };
  }
  async artifact(actor: string, specId: string, name: string) {
    if (
      !/^(?:report\.json|site\.json|[a-f0-9]{12}-(?:390|1280)-(?:actual|approved|diff)\.png)$/.test(
        name
      )
    )
      throw new SiteError('artifact_not_found');
    const row = await this.store.siteAction(
      actor,
      'site.status',
      async (c, p) => {
        const row = await this.row(c, actor, specId);
        await this.owned(c, actor, row.site_id);
        await this.audit(
          c,
          p,
          'site.artifact',
          row.spec_sha256,
          'read',
          null,
          row.site_id
        );
        return row;
      }
    );
    const build = JSON.parse(
      Buffer.from(
        await this.objects.get('specs/' + row.id + '/build.json')
      ).toString()
    ) as VerifiedBuild;
    if (name === 'site.json')
      return Buffer.from(
        canonicalJson({
          files: build.files,
          outputSha256: build.report.outputSha256
        })
      );
    if (
      !(
        build as VerifiedBuild & { artifactNames?: string[] }
      ).artifactNames?.includes(name)
    )
      throw new SiteError('artifact_not_found');
    return Buffer.from(
      await this.objects.get('specs/' + row.id + '/artifacts/' + name)
    );
  }
  async failure(
    actor: string,
    tool: string,
    specId: string | undefined,
    code: string,
    siteId?: string
  ) {
    let hash: string | null = null;
    if (specId)
      hash =
        (
          await this.store.pool.query(
            'SELECT p.spec_sha256 FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.id=$1 AND s.owner_id=$2',
            [specId, actor]
          )
        ).rows[0]?.spec_sha256 ?? null;
    const test = siteId
      ? Boolean(
          (
            await this.store.pool.query(
              'SELECT test_mode FROM platform_site WHERE id=$1 AND owner_id=$2',
              [siteId, actor]
            )
          ).rows[0]?.test_mode
        )
      : undefined;
    await this.store.recordSiteResult(
      actor,
      tool,
      hash,
      code,
      test || undefined
    );
  }
  private async saveBuild(specId: string, build: VerifiedBuild) {
    const artifactNames = Object.keys(build.artifacts).filter(
      (name) => name !== 'site.json'
    );
    for (const name of artifactNames) {
      if (
        !/^(?:report\.json|[a-f0-9]{12}-(?:390|1280)-(?:actual|approved|diff)\.png)$/.test(
          name
        )
      )
        throw new SiteError('unsafe_verification_artifact');
      await this.objects.put(
        'specs/' + specId + '/artifacts/' + name,
        Buffer.from(build.artifacts[name], 'base64')
      );
    }
    await this.objects.put(
      'specs/' + specId + '/build.json',
      Buffer.from(canonicalJson({ ...build, artifacts: {}, artifactNames }))
    );
  }
  async processOne(): Promise<boolean> {
    const job = await this.store.transaction(async (c) => {
      const row = (
        await c.query(
          "SELECT * FROM platform_site_job WHERE state='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1"
        )
      ).rows[0];
      if (!row) return;
      await c.query(
        "UPDATE platform_site_job SET state='running',started_at=now() WHERE id=$1",
        [row.id]
      );
      return row;
    });
    if (!job) return false;
    if (job.kind === 'usage') {
      await this.administration.processUsage(job, this.deployer, (s) =>
        this.name(s)
      );
      return true;
    }
    let hash: string | null = null;
    let providerStarted = false;
    try {
      const p = await this.store.principal(job.actor_id);
      requireRole(p, job.kind === 'build' ? 'site.build' : 'site.deploy');
      const row = await this.store.transaction((c) =>
        this.row(c, p.id, job.spec_id)
      );
      const site = await this.store.transaction((c) =>
        this.owned(c, p.id, row.site_id)
      );
      p.testMode = site.test_mode;
      job.billing_snapshot = await this.store.transaction(async (c) => {
        const snapshot = await this.administration.billing(c, site);
        await c.query(
          'UPDATE platform_site_job SET billing_snapshot=$2 WHERE id=$1',
          [job.id, JSON.stringify(snapshot)]
        );
        await this.administration.event(
          c,
          p,
          site,
          'site.' + job.kind,
          'running',
          row.id,
          job.id,
          {},
          snapshot
        );
        return snapshot;
      });
      hash = row.spec_sha256;
      const validated = validateSiteSpec(row.spec);
      if (!validated.ok) throw new SiteError('invalid_spec', validated.errors);
      const assets = new Map<string, Uint8Array>();
      for (const a of row.spec.assets)
        assets.set(
          a.id,
          await this.objects.get('specs/' + row.id + '/assets/' + a.id)
        );
      const source = await generateSite(row.spec, assets);
      const preview = JSON.parse(
        Buffer.from(
          await this.objects.get('specs/' + row.id + '/preview.json')
        ).toString()
      ) as PreviewBundle;
      validatePreview(row.spec, preview);
      if (job.kind === 'build') {
        await this.store.pool.query(
          "UPDATE platform_site_spec SET state='building' WHERE id=$1",
          [row.id]
        );
        await this.store.siteAction(p.id, 'site.build', async (c) => {
          await this.owned(c, p.id, site.id);
        });
        const build = await this.verifier.verify(source, row.spec, preview, {
          test: site.test_mode
        });
        assertVerified(build, source, row.spec);
        await this.store.siteAction(p.id, 'site.build', async (c) => {
          await this.owned(c, p.id, site.id);
        });
        await this.saveBuild(row.id, build);
        await this.store.pool.query(
          "UPDATE platform_site_spec SET state='verified',source_sha256=$2,output_sha256=$3,error_code=NULL WHERE id=$1",
          [row.id, source.sourceSha256, build.report.outputSha256]
        );
      } else {
        const build = JSON.parse(
          Buffer.from(
            await this.objects.get('specs/' + row.id + '/build.json')
          ).toString()
        ) as VerifiedBuild;
        assertVerified(build, source, row.spec);
        // Recheck ownership, current base and permission immediately before a provider action.
        await this.store.siteAction(p.id, 'site.deploy', async (c) => {
          const s = await this.owned(c, p.id, site.id);
          if (s.current_spec_id) {
            const current = await this.row(c, p.id, s.current_spec_id);
            if (!row.reserved || current.spec_sha256 !== row.base_sha256)
              throw new SiteError('stale_change_base');
          }
          await c.query(
            "UPDATE platform_site_spec SET state='deploying' WHERE id=$1",
            [row.id]
          );
        });
        const email = (
          await this.store.pool.query('SELECT email FROM "user" WHERE id=$1', [
            site.owner_id
          ])
        ).rows[0].email;
        providerStarted = true;
        const resources = await this.deployer.deploy({
          test: site.test_mode,
          name: this.name(site),
          spec: row.spec,
          build,
          resources: site.resources,
          clientEmail: email,
          clientPassword: this.open(row.client_password_ciphertext!),
          domain: row.requested_domain ?? undefined,
          saveResources: async (value) => {
            await this.store.pool.query(
              'UPDATE platform_site SET resources=$2 WHERE id=$1',
              [site.id, JSON.stringify(value)]
            );
          }
        });
        await this.store.siteAction(p.id, 'site.deploy', async (c, current) => {
          await this.owned(c, p.id, site.id);
          await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            'site-allowance:' + site.owner_id
          ]);
          if (row.accounting && !row.reserved)
            throw new SiteError('change_reservation_required');
          await c.query(
            "UPDATE platform_site_spec SET state='live',reserved=false,applied_at=CASE WHEN accounting IS NOT NULL THEN now() ELSE NULL END,client_password_ciphertext=NULL,error_code=NULL WHERE id=$1",
            [row.id]
          );
          await c.query(
            'UPDATE platform_site SET current_spec_id=$2,resources=$3 WHERE id=$1',
            [site.id, row.id, JSON.stringify(resources)]
          );
          await this.audit(
            c,
            current,
            'site.deploy',
            hash,
            'applied',
            job.id,
            site.id
          );
        });
      }
      await this.store.pool.query(
        "UPDATE platform_site_job SET state='done',finished_at=now() WHERE id=$1",
        [job.id]
      );
      await this.store.recordSiteResult(
        job.actor_id,
        'site.' + job.kind,
        hash,
        'success',
        job.test_mode
      );
      await this.store.transaction(async (c) => {
        await this.administration.event(
          c,
          p,
          site,
          'site.' + job.kind,
          'success',
          row.id,
          job.id,
          {},
          job.billing_snapshot
        );
      });
    } catch (error) {
      if (error instanceof VerificationFailure) {
        try {
          await this.saveBuild(job.spec_id, error.build);
          await this.store.pool.query(
            'UPDATE platform_site_spec SET source_sha256=$2 WHERE id=$1',
            [job.spec_id, error.build.report.sourceSha256]
          );
        } catch {
          console.error(
            JSON.stringify({
              event: 'site.report.storage_failed',
              test: job.test_mode
            })
          );
        }
      }
      const code =
        error instanceof SiteError || error instanceof AccessError
          ? error.code
          : 'operation_failed';
      // An uncertain provider outcome is retained for manual reconciliation, never replayed or charged blindly.
      const unknown =
        job.kind === 'deploy' &&
        providerStarted &&
        code !== 'deployment_failed';
      await this.store.transaction(async (c) => {
        await c.query(
          'UPDATE platform_site_job SET state=$2,finished_at=now() WHERE id=$1',
          [job.id, unknown ? 'unknown' : 'failed']
        );
        await c.query(
          'UPDATE platform_site_spec SET state=$2,error_code=$3,reserved=CASE WHEN $4 THEN reserved ELSE false END,client_password_ciphertext=NULL WHERE id=$1',
          [job.spec_id, unknown ? 'unknown' : 'failed', code, unknown]
        );
      });
      try {
        await this.store.recordSiteResult(
          job.actor_id,
          'site.' + job.kind,
          hash,
          code,
          job.test_mode
        );
      } catch (auditError) {
        // A revoked identity cannot resolve, but its admitted job still gets an immutable outcome below.
        if (!(auditError instanceof AccessError)) throw auditError;
      }
      await this.store.transaction(async (c) => {
        const site = (
          await c.query(
            'SELECT s.* FROM platform_site s JOIN platform_site_spec p ON p.site_id=s.id WHERE p.id=$1',
            [job.spec_id]
          )
        ).rows[0];
        if (site)
          await this.administration.event(
            c,
            { id: job.actor_id, role: 'client', testMode: job.test_mode },
            site,
            'site.' + job.kind,
            code,
            job.spec_id,
            job.id,
            {},
            job.billing_snapshot
          );
      });
    }
    return true;
  }
  async list(
    actor: string,
    input: {
      test?: boolean;
      owner?: string;
      status?: string;
      limit: number;
      after?: string;
    }
  ) {
    return this.store.siteAction(actor, 'sites.list', async (c, p) => {
      const rows = (
        await c.query(
          `SELECT s.id AS "siteId",s.owner_id AS "ownerId",s.slug,s.test_mode AS test,s.lifecycle,s.policy_version AS "policyVersion",s.first_client_pilot AS "firstClientPilot", CASE WHEN s.lifecycle='active' THEN COALESCE(cur.state,v.state,'staged') ELSE s.lifecycle END AS status
        FROM platform_site s LEFT JOIN platform_site_spec cur ON cur.id=s.current_spec_id LEFT JOIN LATERAL (SELECT state FROM platform_site_spec WHERE site_id=s.id ORDER BY created_at DESC,id DESC LIMIT 1) v ON true
        WHERE ($1::boolean IS NULL OR s.test_mode=$1) AND ($2::text IS NULL OR s.owner_id=$2) AND ($3::text IS NULL OR CASE WHEN s.lifecycle='active' THEN COALESCE(cur.state,v.state,'staged') ELSE s.lifecycle END=$3) AND ($4::uuid IS NULL OR s.id>$4) ORDER BY s.id LIMIT $5`,
          [
            input.test ?? null,
            input.owner ?? null,
            input.status ?? null,
            input.after ?? null,
            input.limit
          ]
        )
      ).rows;
      p.testMode = input.test === true;
      await this.audit(c, p, 'sites.list', null, 'read');
      return {
        sites: rows,
        nextAfter: rows.length === input.limit ? rows.at(-1).siteId : null
      };
    });
  }
  async inspect(actor: string, siteId: string) {
    return this.store.siteAction(actor, 'site.inspect', async (c, p) => {
      const site = (
        await c.query('SELECT * FROM platform_site WHERE id=$1', [siteId])
      ).rows[0] as SiteRow | undefined;
      if (!site) throw new SiteError('site_not_found');
      const specs = (
        await c.query(
          'SELECT id AS "specId",state,spec_sha256 AS "specSha256",source_sha256 AS "sourceSha256",output_sha256 AS "outputSha256",accounting,applied_at AS "appliedAt",test_mode AS test,error_code AS error FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20',
          [siteId]
        )
      ).rows;
      const currentState = site.current_spec_id
        ? (
            await c.query('SELECT state FROM platform_site_spec WHERE id=$1', [
              site.current_spec_id
            ])
          ).rows[0]?.state
        : undefined;
      const lastDeploy =
        (
          await c.query(
            `SELECT j.id AS "jobId",j.state,j.finished_at AS "finishedAt" FROM platform_site_job j JOIN platform_site_spec p ON p.id=j.spec_id WHERE p.site_id=$1 AND j.kind='deploy' ORDER BY j.created_at DESC LIMIT 1`,
            [siteId]
          )
        ).rows[0] ?? null;
      p.testMode = site.test_mode;
      await this.audit(
        c,
        p,
        'site.inspect',
        specs[0]?.specSha256 ?? null,
        'read'
      );
      return {
        siteId,
        ownerId: site.owner_id,
        firstClientPilot: site.first_client_pilot,
        test: site.test_mode,
        free:
          site.test_mode ||
          ['admin', 'superadmin'].includes(
            (await this.store.currentPrincipal(c, site.owner_id)).role
          ),
        lifecycle: site.lifecycle,
        status:
          site.lifecycle === 'active'
            ? (currentState ?? specs[0]?.state ?? 'staged')
            : site.lifecycle,
        policyVersion: site.policy_version,
        currentSpecId: site.current_spec_id,
        lastDeploy,
        specs,
        monthlyRequestsUsed: await this.usage(c, site.owner_id),
        siteUrl: site.resources.domain
          ? 'https://' + site.resources.domain
          : null
      };
    });
  }
  async reset(actor: string, siteId: string, confirmation: string) {
    // This connection-level lock prevents concurrent provider cleanup attempts;
    // lifecycle remains resetting after errors/crashes for an explicit retry.
    requireRole(await this.store.principal(actor), 'tester.reset');
    requireConfirmation(confirmation, 'RESET ' + siteId);
    const lease = await this.store.pool.connect();
    const lock = 'tester-reset:' + siteId;
    let locked = false;
    try {
      locked = (
        await lease.query(
          'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
          [lock]
        )
      ).rows[0].locked;
      if (!locked) throw new SiteError('reset_busy');
      const snapshot = await this.store.siteAction(
        actor,
        'tester.reset',
        async (c, p) => {
          const site = (
            await c.query(
              'SELECT * FROM platform_site WHERE id=$1 FOR UPDATE',
              [siteId]
            )
          ).rows[0] as SiteRow | undefined;
          if (!site?.test_mode) throw new SiteError('test_site_required');
          const active = await c.query(
            `SELECT 1 FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.state IN ('queued','running')`,
            [siteId]
          );
          if (active.rowCount) throw new SiteError('site_busy');
          const specs = (
            await c.query(
              'SELECT id FROM platform_site_spec WHERE site_id=$1',
              [siteId]
            )
          ).rows.map((r) => r.id as string);
          await c.query(
            "UPDATE platform_site SET lifecycle='resetting' WHERE id=$1 AND lifecycle<>'archived'",
            [siteId]
          );
          await c.query(
            `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'tester.reset',$2,$3,true)`,
            [
              p.id,
              siteId,
              JSON.stringify({
                siteId,
                confirmation,
                result:
                  site.lifecycle === 'archived' ? 'already_reset' : 'started',
                test: true
              })
            ]
          );
          return { site, specs };
        }
      );
      if (snapshot.site.lifecycle === 'archived')
        return { siteId, test: true, state: 'archived', reset: true };
      await this.deployer.reset(
        snapshot.site.resources,
        this.name(snapshot.site),
        true
      );
      // Persist provider deletion before bucket deletion. A bucket failure retries
      // only remaining objects, without depending on provider not-found errors.
      await this.store.pool.query(
        "UPDATE platform_site SET resources='{}' WHERE id=$1",
        [siteId]
      );
      for (const specId of snapshot.specs)
        await this.objects.deletePrefix('specs/' + specId + '/');
      await this.store.siteAction(actor, 'tester.reset', async (c, p) => {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          'site-allowance:' + snapshot.site.owner_id
        ]);
        await c.query(
          'UPDATE platform_site SET current_spec_id=NULL WHERE id=$1',
          [siteId]
        );
        await c.query(
          'DELETE FROM platform_site_job WHERE spec_id IN (SELECT id FROM platform_site_spec WHERE site_id=$1)',
          [siteId]
        );
        await c.query('DELETE FROM platform_site_spec WHERE site_id=$1', [
          siteId
        ]);
        await c.query(
          "UPDATE platform_site SET lifecycle='archived' WHERE id=$1",
          [siteId]
        );
        await c.query(
          `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'tester.reset',$2,$3,true)`,
          [
            p.id,
            siteId,
            JSON.stringify({
              siteId,
              confirmation,
              result: 'success',
              test: true
            })
          ]
        );
      });
      return { siteId, test: true, state: 'archived', reset: true };
    } catch (error) {
      await this.store.transaction(async (c) => {
        await c.query(
          `INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'tester.reset',$2,$3,true)`,
          [
            actor,
            siteId,
            JSON.stringify({
              siteId,
              confirmation,
              result: error instanceof SiteError ? error.code : 'reset_failed',
              test: true
            })
          ]
        );
      });
      await this.store.adminResult(
        actor,
        'tester.reset',
        error instanceof SiteError ? error.code : 'reset_failed',
        siteId
      );
      throw error;
    } finally {
      if (locked)
        await lease.query('SELECT pg_advisory_unlock(hashtext($1))', [lock]);
      lease.release();
    }
  }
  async recoverInterrupted() {
    await this.store.transaction(async (c) => {
      const jobs = (
        await c.query(
          "UPDATE platform_site_job SET state=CASE WHEN kind='deploy' THEN 'unknown' ELSE 'failed' END,finished_at=now() WHERE state='running' RETURNING spec_id,kind,actor_id,test_mode"
        )
      ).rows;
      for (const job of jobs) {
        if (job.kind !== 'usage')
          await c.query(
            "UPDATE platform_site_spec SET state=$2,error_code='worker_interrupted',reserved=CASE WHEN $3 THEN reserved ELSE false END,client_password_ciphertext=NULL WHERE id=$1",
            [
              job.spec_id,
              job.kind === 'deploy' ? 'unknown' : 'failed',
              job.kind === 'deploy'
            ]
          );
        await c.query(
          "INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'site.worker.recovery',$2,$3,$4)",
          [
            job.actor_id,
            job.spec_id,
            JSON.stringify({
              result: 'worker_interrupted',
              kind: job.kind,
              test: job.test_mode
            }),
            job.test_mode
          ]
        );
      }
    });
  }
  async startWorker() {
    const lease = await this.store.pool.connect();
    const locked = (
      await lease.query(
        "SELECT pg_try_advisory_lock(hashtext('a2aviary-site-worker')) AS locked"
      )
    ).rows[0].locked;
    if (!locked) {
      lease.release();
      return async () => {};
    }
    let running = true;
    lease.on('error', () => {
      running = false;
    });
    await this.recoverInterrupted();
    let nextCollection = 0;
    const loop = (async () => {
      try {
        while (running) {
          try {
            if (Date.now() >= nextCollection) {
              nextCollection = Date.now() + 60000;
              await this.administration.collectDue();
            }
            if (!(await this.processOne()))
              await new Promise((r) => setTimeout(r, 1000));
          } catch {
            console.error(
              JSON.stringify({ event: 'site.worker.failed', test: false })
            );
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      } finally {
        try {
          await lease.query(
            "SELECT pg_advisory_unlock(hashtext('a2aviary-site-worker'))"
          );
        } finally {
          lease.release();
        }
      }
    })();
    return async () => {
      running = false;
      await loop;
    };
  }
}
