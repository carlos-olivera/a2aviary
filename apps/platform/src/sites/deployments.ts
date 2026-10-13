import { status, artifact, failure } from './status.ts';
import { readVerifiedBuild, saveBuild, copyBuild } from './artifacts.ts';
import {
  processOne,
  processAdmittedJob,
  recoverInterrupted,
  startWorker,
} from './worker.ts';
import { list, inspect } from '../admin/inventory.ts';
import { reset } from '../admin/reset.ts';
import {
  randomUUID,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import type { PoolClient } from 'pg';
import { type SiteSpec } from '@a2aviary/site-core';
import {
  SiteError,
  type ObjectStore,
  type BuildVerifier,
  type SiteDeployer,
  type VerifiedBuild,
} from '@a2aviary/generator';

import {
  Store,
  requireConfirmation,
  type Principal,
} from '../identity/store.ts';
import {
  SiteAdministration,
  siteAccess,
  type CatalogSite,
} from '../admin/site-administration.ts';
export type SpecRow = {
  expires_at: string;
  output_sha256: string | null;
  source_sha256: string | null;
  artifact_hashes: Record<string, string>;
  pending_source_id: string | null;
  verification_admitted: boolean;
  checker_sha256: string;
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
export type SiteRow = CatalogSite;
export class Sites {
  readonly store: Store;
  readonly objects: ObjectStore;
  readonly verifier: BuildVerifier;
  readonly deployer: SiteDeployer;
  private readonly key: Buffer;
  readonly administration: SiteAdministration;
  drafts!: import('./drafts.ts').Drafts;
  constructor(
    store: Store,
    objects: ObjectStore,
    verifier: BuildVerifier,
    deployer: SiteDeployer,
    key: string,
    administration = new SiteAdministration(store),
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
  /** @internal Shared by domain operations. */
  seal(password: string) {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.key, iv),
      data = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  /** @internal Shared by domain operations. */
  open(value: string) {
    const b = Buffer.from(value, 'base64'),
      cipher = createDecipheriv('aes-256-gcm', this.key, b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([
      cipher.update(b.subarray(28)),
      cipher.final(),
    ]).toString();
  }
  /** @internal Shared by domain operations. */
  name(site: SiteRow) {
    return 'cli-' + String(site.number).padStart(3, '0') + '-' + site.slug;
  }
  /** @internal Shared by domain operations. */
  async owned(c: PoolClient, actor: string, siteId: string): Promise<SiteRow> {
    return siteAccess(c, await this.store.currentPrincipal(c, actor), siteId);
  }
  /** @internal Shared by domain operations. */
  async row(c: PoolClient, actor: string, specId: string) {
    const siteId = (
      await c.query('SELECT site_id FROM platform_site_spec WHERE id=$1', [
        specId,
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
        specId,
      ])
    ).rows[0] as SpecRow | undefined;
    if (!row) throw new SiteError('owned_spec_required');
    return row;
  }
  /** @internal Shared by domain operations. */
  async audit(
    c: PoolClient,
    p: Principal,
    tool: string,
    hash: string | null,
    result: string,
    jobId: string | null = null,
    siteId?: string,
  ) {
    await c.query(
      'INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,$2,$3,$4,$5)',
      [
        p.id,
        'site.tool.result',
        tool,
        JSON.stringify({ tool, specSha256: hash, result, test: p.testMode }),
        p.testMode,
      ],
    );
    if (siteId) {
      const site = await this.owned(c, p.id, siteId);
      const specId = hash
        ? (
            await c.query(
              'SELECT id FROM platform_site_spec WHERE site_id=$1 AND spec_sha256=$2',
              [siteId, hash],
            )
          ).rows[0]?.id
        : null;
      await this.administration.event(c, p, site, tool, result, specId, jobId, {
        specSha256: hash,
      });
    }
  }

  /** @internal Shared by domain operations. */
  async usage(c: PoolClient, actor: string): Promise<number> {
    return Number(
      (
        await c.query(
          "SELECT count(*) AS count FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE s.owner_id=$1 AND p.accounting IS NOT NULL AND (p.reserved OR (p.applied_at>=date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AND p.applied_at<(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'))",
          [actor],
        )
      ).rows[0].count,
    );
  }
  async deploy(
    actor: string,
    siteId: string,
    specId: string,
    password: string,
    confirmation: string,
    domain?: string,
  ) {
    requireConfirmation(
      confirmation,
      'DEPLOY_SITE:' + siteId + (domain ? ':' + domain : ''),
    );
    if (password.length < 16 || password.length > 128)
      throw new SiteError('cms_password_length');
    return this.store.siteAction(actor, 'site.deploy', async (c, p) => {
      const site = await this.owned(c, actor, siteId);
      await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        'site-allowance:' + site.owner_id,
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
      if (site.current_spec_id) throw new SiteError('initial_site_only');
      await this.drafts.assertApproval(c, row);
      await this.readVerifiedBuild(row);
      const active = (
        await c.query(
          "SELECT 1 FROM platform_site_job j JOIN platform_site_spec s ON s.id=j.spec_id WHERE s.site_id=$1 AND j.kind='deploy' AND j.state IN ('queued','running','unknown')",
          [siteId],
        )
      ).rowCount;
      if (active) throw new SiteError('deployment_busy');
      const job = (
        await c.query(
          "INSERT INTO platform_site_job(id,spec_id,actor_id,kind) VALUES($1,$2,$3,'deploy') ON CONFLICT(spec_id,kind) DO UPDATE SET state='queued',actor_id=excluded.actor_id,billing_snapshot=excluded.billing_snapshot,started_at=NULL,finished_at=NULL RETURNING id",
          [randomUUID(), specId, actor],
        )
      ).rows[0];
      await c.query(
        'UPDATE platform_site_spec SET client_password_ciphertext=$2,requested_domain=$3 WHERE id=$1',
        [specId, this.seal(password), domain ?? null],
      );
      await this.audit(
        c,
        p,
        'site.deploy',
        row.spec_sha256,
        'queued',
        job.id,
        site.id,
      );
      return {
        siteId,
        specId,
        jobId: job.id,
        state: 'queued',
        test: site.test_mode,
      };
    });
  }
  async status(actor: string, siteId: string) {
    return status.call(this, actor, siteId);
  }
  async artifact(actor: string, specId: string, name: string) {
    return artifact.call(this, actor, specId, name);
  }
  async failure(
    actor: string,
    tool: string,
    specId: string | undefined,
    code: string,
    siteId?: string,
  ) {
    return failure.call(this, actor, tool, specId, code, siteId);
  }
  async readVerifiedBuild(row: SpecRow) {
    return readVerifiedBuild.call(this, row);
  }
  async saveBuild(specId: string, build: VerifiedBuild) {
    return saveBuild.call(this, specId, build);
  }
  async copyBuild(fromId: string, toId: string, build: VerifiedBuild) {
    return copyBuild.call(this, fromId, toId, build);
  }
  async processOne(): Promise<boolean> {
    return processOne.call(this);
  }
  /** @internal Shared by domain operations. */
  async processAdmittedJob(): Promise<boolean> {
    return processAdmittedJob.call(this);
  }
  async list(
    actor: string,
    input: {
      test?: boolean;
      owner?: string;
      status?: string;
      limit: number;
      after?: string;
    },
  ) {
    return list.call(this, actor, input);
  }
  async inspect(actor: string, siteId: string) {
    return inspect.call(this, actor, siteId);
  }
  async reset(actor: string, siteId: string, confirmation: string) {
    return reset.call(this, actor, siteId, confirmation);
  }
  async recoverInterrupted() {
    return recoverInterrupted.call(this);
  }
  async startWorker() {
    return startWorker.call(this);
  }
}
