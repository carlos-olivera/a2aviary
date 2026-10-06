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
  requireRole,
  requireConfirmation,
  type Principal
} from './store.ts';
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
type SiteRow = {
  id: string;
  owner_id: string;
  number: string;
  slug: string;
  current_spec_id: string | null;
  resources: SiteResources;
  policy_version: string;
};
export class Sites {
  readonly store: Store;
  readonly objects: ObjectStore;
  readonly verifier: BuildVerifier;
  readonly deployer: SiteDeployer;
  private readonly key: Buffer;
  constructor(
    store: Store,
    objects: ObjectStore,
    verifier: BuildVerifier,
    deployer: SiteDeployer,
    key: string
  ) {
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
    const site = (
      await c.query(
        'SELECT * FROM platform_site WHERE id=$1 AND owner_id=$2 FOR UPDATE',
        [siteId, actor]
      )
    ).rows[0];
    if (!site) throw new SiteError('owned_site_required');
    if (site.policy_version !== defaultPolicy.version.value)
      throw new SiteError('unsupported_pinned_policy');
    return site;
  }
  private async row(c: PoolClient, actor: string, specId: string) {
    const row = (
      await c.query(
        'SELECT p.* FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.id=$1 AND s.owner_id=$2 FOR UPDATE OF p',
        [specId, actor]
      )
    ).rows[0] as SpecRow | undefined;
    if (!row) throw new SiteError('owned_spec_required');
    return row;
  }
  private async audit(
    c: PoolClient,
    p: Principal,
    tool: string,
    hash: string | null,
    result: string
  ) {
    await c.query(
      'INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,$5)',
      [
        p.id,
        'site.tool.result',
        tool,
        JSON.stringify({ tool, specSha256: hash, result }),
        p.testMode
      ]
    );
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
      // Immutable prepared bytes and previews are bucket objects, never Railway volumes.
      for (const [id, bytes] of buffers)
        await this.objects.put('specs/' + specId + '/assets/' + id, bytes);
      await this.objects.put(
        'specs/' + specId + '/preview.json',
        Buffer.from(canonicalJson(input.preview))
      );
      return await this.store.siteAction(actor, 'site.build', async (c, p) => {
        let site: SiteRow;
        if (input.siteId) site = await this.owned(c, actor, input.siteId);
        else {
          if (!input.slug || !/^[a-z][a-z0-9-]{0,63}$/.test(input.slug))
            throw new SiteError('slug_required');
          site = (
            await c.query(
              'INSERT INTO platform_site(id,owner_id,slug,plan_id,policy_version) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,slug) DO UPDATE SET slug=excluded.slug RETURNING *',
              [
                randomUUID(),
                actor,
                input.slug,
                spec.value.planId,
                spec.value.policyVersion
              ]
            )
          ).rows[0];
        }
        const existing = (
          await c.query(
            'SELECT id,state FROM platform_site_spec WHERE site_id=$1 AND spec_sha256=$2',
            [site.id, hash]
          )
        ).rows[0];
        if (existing) {
          await this.audit(c, p, 'site.submit', hash, 'duplicate');
          return {
            siteId: site.id,
            specId: existing.id,
            state: existing.state
          };
        }
        await c.query(
          'INSERT INTO platform_site_spec(id,site_id,spec,spec_sha256) VALUES($1,$2,$3,$4)',
          [specId, site.id, JSON.stringify(spec.value), hash]
        );
        await this.audit(c, p, 'site.submit', hash, 'accepted');
        return { siteId: site.id, specId, state: 'staged' };
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
      await this.owned(c, actor, row.site_id);
      if (['deploying', 'unknown'].includes(row.state))
        throw new SiteError('spec_busy');
      if (['verified', 'live'].includes(row.state)) {
        await this.audit(c, p, 'site.build', row.spec_sha256, 'cached');
        return { specId, state: row.state };
      }
      const job = (
        await c.query(
          "INSERT INTO platform_site_job(id,spec_id,actor_id,kind) VALUES($1,$2,$3,'build') ON CONFLICT(spec_id,kind) DO UPDATE SET state=CASE WHEN platform_site_job.state='failed' THEN 'queued' ELSE platform_site_job.state END RETURNING id,state",
          [randomUUID(), specId, actor]
        )
      ).rows[0];
      await this.audit(c, p, 'site.build', row.spec_sha256, 'queued');
      return { specId, jobId: job.id, state: job.state };
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
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'site-allowance:' + actor
      ]);
      const site = await this.owned(c, actor, siteId);
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
          'cached'
        );
        return {
          specId,
          state: candidate.state,
          accounting: candidate.accounting
        };
      }
      const now = (await c.query('SELECT now() AS now')).rows[0].now as Date;
      const usage = await this.usage(c, actor);
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
        'reserved'
      );
      return {
        specId,
        accounting: checked.value.accounting,
        state: candidate.state
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
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'site-allowance:' + actor
      ]);
      const site = await this.owned(c, actor, siteId),
        row = await this.row(c, actor, specId);
      if (row.site_id !== siteId)
        throw new SiteError('candidate_site_mismatch');
      if (
        site.current_spec_id &&
        domain &&
        site.resources.customDomain !== domain
      )
        throw new SiteError('domain_change_unsupported');
      if (row.state === 'live' && site.current_spec_id === specId) {
        await this.audit(c, p, 'site.deploy', row.spec_sha256, 'cached');
        return { siteId, state: 'live' };
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
          "INSERT INTO platform_site_job(id,spec_id,actor_id,kind) VALUES($1,$2,$3,'deploy') ON CONFLICT(spec_id,kind) DO UPDATE SET state='queued',started_at=NULL,finished_at=NULL RETURNING id",
          [randomUUID(), specId, actor]
        )
      ).rows[0];
      await c.query(
        'UPDATE platform_site_spec SET client_password_ciphertext=$2,requested_domain=$3 WHERE id=$1',
        [specId, this.seal(password), domain ?? null]
      );
      await this.audit(c, p, 'site.deploy', row.spec_sha256, 'queued');
      return { siteId, specId, jobId: job.id, state: 'queued' };
    });
  }
  async status(actor: string, siteId: string) {
    const snapshot = await this.store.siteAction(
      actor,
      'site.status',
      async (c, p) => {
        const site = await this.owned(c, actor, siteId);
        const specs = (
          await c.query(
            'SELECT id AS "specId",state,spec_sha256 AS "specSha256",source_sha256 AS "sourceSha256",output_sha256 AS "outputSha256",error_code AS "error",accounting,applied_at AS "appliedAt" FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC LIMIT 20',
            [siteId]
          )
        ).rows;
        await this.audit(
          c,
          p,
          'site.status',
          specs[0]?.specSha256 ?? null,
          'read'
        );
        return {
          siteId,
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
            defaultPolicy.changes.perMonth.value - (await this.usage(c, actor))
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
        domainStatus = await this.deployer.status(resources, name);
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
        await this.audit(c, p, 'site.artifact', row.spec_sha256, 'read');
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
    code: string
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
    await this.store.recordSiteResult(actor, tool, hash, code);
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
    let hash: string | null = null;
    try {
      const p = await this.store.principal(job.actor_id);
      requireRole(p, job.kind === 'build' ? 'site.build' : 'site.deploy');
      const row = await this.store.transaction((c) =>
        this.row(c, p.id, job.spec_id)
      );
      const site = await this.store.transaction((c) =>
        this.owned(c, p.id, row.site_id)
      );
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
        const build = await this.verifier.verify(source, row.spec, preview);
        assertVerified(build, source, row.spec);
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
            p.id
          ])
        ).rows[0].email;
        const resources = await this.deployer.deploy({
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
          await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
            'site-allowance:' + p.id
          ]);
          await this.owned(c, p.id, site.id);
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
          await this.audit(c, current, 'site.deploy', hash, 'applied');
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
        'success'
      );
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
            JSON.stringify({ event: 'site.report.storage_failed' })
          );
        }
      }
      const code = error instanceof SiteError ? error.code : 'operation_failed';
      // An uncertain provider outcome is retained for manual reconciliation, never replayed or charged blindly.
      const unknown = job.kind === 'deploy' && code !== 'deployment_failed';
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
      await this.store.recordSiteResult(
        job.actor_id,
        'site.' + job.kind,
        hash,
        code
      );
    }
    return true;
  }
  async recoverInterrupted() {
    await this.store.transaction(async (c) => {
      const jobs = (
        await c.query(
          "UPDATE platform_site_job SET state=CASE WHEN kind='deploy' THEN 'unknown' ELSE 'failed' END,finished_at=now() WHERE state='running' RETURNING spec_id,kind,actor_id"
        )
      ).rows;
      for (const job of jobs) {
        await c.query(
          "UPDATE platform_site_spec SET state=$2,error_code='worker_interrupted',reserved=CASE WHEN $3 THEN reserved ELSE false END,client_password_ciphertext=NULL WHERE id=$1",
          [
            job.spec_id,
            job.kind === 'deploy' ? 'unknown' : 'failed',
            job.kind === 'deploy'
          ]
        );
        await c.query(
          "INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'site.worker.recovery',$2,$3,false)",
          [
            job.actor_id,
            job.spec_id,
            JSON.stringify({ result: 'worker_interrupted', kind: job.kind })
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
    const loop = (async () => {
      try {
        while (running) {
          try {
            if (!(await this.processOne()))
              await new Promise((r) => setTimeout(r, 1000));
          } catch {
            console.error(JSON.stringify({ event: 'site.worker.failed' }));
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
