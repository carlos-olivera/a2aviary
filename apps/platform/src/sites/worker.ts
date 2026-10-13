import {
  validateSiteSpec,
  SUPPORTED_POLICY_VERSIONS,
  sha256,
  defaultPolicy,
} from '@a2aviary/site-core';
import {
  generateSite,
  assertVerified,
  SiteError,
  VerificationFailure,
} from '@a2aviary/generator';

import { AccessError, requireRole } from '../identity/store.ts';

import type { Sites } from './deployments.ts';

export async function processOne(this: Sites): Promise<boolean> {
  const lease = await this.store.pool.connect();
  let locked = false;
  try {
    locked = (
      await lease.query(
        "SELECT pg_try_advisory_lock(hashtext('site-job-execution')) AS ok",
      )
    ).rows[0].ok;
    return locked ? await this.processAdmittedJob() : false;
  } finally {
    if (locked)
      await lease.query(
        "SELECT pg_advisory_unlock(hashtext('site-job-execution'))",
      );
    lease.release();
  }
}

export async function processAdmittedJob(this: Sites): Promise<boolean> {
  const job = await this.store.transaction(async (c) => {
    const row = (
      await c.query(
        "SELECT * FROM platform_site_job WHERE state='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!row) return;
    await c.query(
      "UPDATE platform_site_job SET state='running',started_at=now() WHERE id=$1",
      [row.id],
    );
    return row;
  });
  if (!job) return false;
  if (job.kind === 'usage') {
    await this.administration.processUsage(job, this.deployer, (s) =>
      this.name(s),
    );
    return true;
  }
  let hash: string | null = null;
  let providerStarted = false;
  try {
    const p = await this.store.principal(job.actor_id);
    requireRole(p, job.kind === 'build' ? 'site.preview' : 'site.deploy');
    const row = await this.store.transaction((c) =>
      this.row(c, p.id, job.spec_id),
    );
    const site = await this.store.transaction((c) =>
      this.owned(c, p.id, row.site_id),
    );
    p.testMode = site.test_mode;
    job.billing_snapshot = await this.store.transaction(async (c) => {
      const snapshot = await this.administration.billing(c, site);
      await c.query(
        'UPDATE platform_site_job SET billing_snapshot=$2 WHERE id=$1',
        [job.id, JSON.stringify(snapshot)],
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
        snapshot,
      );
      return snapshot;
    });
    hash = row.spec_sha256;
    if (!SUPPORTED_POLICY_VERSIONS.includes(row.spec.policyVersion))
      throw new SiteError('policy_version_unsupported');
    const validated = validateSiteSpec(
      row.spec,
      defaultPolicy,
      { test: site.test_mode },
    );
    if (!validated.ok) throw new SiteError('invalid_spec', validated.errors);
    const assets = new Map<string, Uint8Array>();
    for (const a of row.spec.assets)
      assets.set(
        a.id,
        await this.objects.get('specs/' + row.id + '/assets/' + a.id),
      );
    if (job.kind === 'build') {
      if (new Date(row.expires_at).getTime() <= Date.now())
        throw new SiteError('snapshot_expired');
      if (row.state === 'superseded')
        throw new SiteError('snapshot_superseded');
      if (row.pending_source_id) {
        const parent = (
          await this.store.pool.query(
            'SELECT * FROM platform_site_spec WHERE id=$1',
            [row.pending_source_id],
          )
        ).rows[0];
        if (!parent || !parent.output_sha256 || parent.artifacts_deleted)
          throw new SiteError('cached_verification_failed');
        const reused = await this.readVerifiedBuild(parent);
        await this.copyBuild(parent.id, row.id, reused);
        await this.store.pool.query(
          "UPDATE platform_site_spec SET state='verified',source_sha256=$2,output_sha256=$3 WHERE id=$1 AND state='queued'",
          [row.id, parent.source_sha256, parent.output_sha256],
        );
      } else {
        if (!row.verification_admitted)
          throw new SiteError('cached_verification_failed');
        const source = await generateSite(row.spec, assets, {
          serverNormalized: true,
          test: site.test_mode,
        });
        if (
          row.source_sha256 !== source.sourceSha256 ||
          row.checker_sha256 !== sha256(source.files['verify.mjs'])
        )
          throw new SiteError('snapshot_provenance_changed');
        const admitted = await this.store.pool.query(
          "UPDATE platform_site_spec SET state='building' WHERE id=$1 AND state='queued'",
          [row.id],
        );
        if (!admitted.rowCount) throw new SiteError('snapshot_superseded');
        await this.store.siteAction(p.id, 'site.preview', async (c) => {
          await this.owned(c, p.id, site.id);
        });
        const build = await this.verifier.verify(source, row.spec, {
          test: site.test_mode,
        });
        assertVerified(build, source, row.spec);
        await this.store.siteAction(p.id, 'site.preview', async (c) => {
          await this.owned(c, p.id, site.id);
        });
        await this.saveBuild(row.id, build);
        await this.store.pool.query(
          "UPDATE platform_site_spec SET state=CASE WHEN state='building' THEN 'verified' ELSE state END,source_sha256=$2,output_sha256=$3,error_code=NULL WHERE id=$1",
          [row.id, source.sourceSha256, build.report.outputSha256],
        );
      }
    } else {
      const build = await this.readVerifiedBuild(row);
      // Recheck ownership, current base and permission immediately before a provider action.
      await this.store.siteAction(p.id, 'site.deploy', async (c) => {
        const s = await this.owned(c, p.id, site.id);
        if (s.current_spec_id) throw new SiteError('initial_site_only');
        await this.drafts.assertApproval(c, await this.row(c, p.id, row.id));
        await c.query(
          "UPDATE platform_site_spec SET state='deploying' WHERE id=$1",
          [row.id],
        );
      });
      const email = (
        await this.store.pool.query('SELECT email FROM "user" WHERE id=$1', [
          site.owner_id,
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
            [site.id, JSON.stringify(value)],
          );
        },
      });
      await this.store.siteAction(p.id, 'site.deploy', async (c, current) => {
        await this.owned(c, p.id, site.id);
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          'site-allowance:' + site.owner_id,
        ]);
        if (row.accounting && !row.reserved)
          throw new SiteError('change_reservation_required');
        await c.query(
          "UPDATE platform_site_spec SET state='live',reserved=false,applied_at=CASE WHEN accounting IS NOT NULL THEN now() ELSE NULL END,client_password_ciphertext=NULL,error_code=NULL WHERE id=$1",
          [row.id],
        );
        await c.query(
          'UPDATE platform_site SET current_spec_id=$2,resources=$3 WHERE id=$1',
          [site.id, row.id, JSON.stringify(resources)],
        );
        await this.audit(
          c,
          current,
          'site.deploy',
          hash,
          'applied',
          job.id,
          site.id,
        );
      });
    }
    await this.store.pool.query(
      "UPDATE platform_site_job SET state='done',finished_at=now() WHERE id=$1",
      [job.id],
    );
    await this.store.recordSiteResult(
      job.actor_id,
      'site.' + job.kind,
      hash,
      'success',
      job.test_mode,
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
        job.billing_snapshot,
      );
    });
  } catch (error) {
    if (error instanceof VerificationFailure) {
      try {
        await this.saveBuild(job.spec_id, error.build);
        await this.store.pool.query(
          'UPDATE platform_site_spec SET source_sha256=$2 WHERE id=$1',
          [job.spec_id, error.build.report.sourceSha256],
        );
      } catch {
        console.error(
          JSON.stringify({
            event: 'site.report.storage_failed',
            test: job.test_mode,
          }),
        );
      }
    }
    const code =
      error instanceof SiteError || error instanceof AccessError
        ? error.code
        : 'operation_failed';
    // An uncertain provider outcome is retained for manual reconciliation, never replayed or charged blindly.
    const unknown =
      job.kind === 'deploy' && providerStarted && code !== 'deployment_failed';
    await this.store.transaction(async (c) => {
      await c.query(
        'UPDATE platform_site_job SET state=$2,finished_at=now() WHERE id=$1',
        [job.id, unknown ? 'unknown' : 'failed'],
      );
      await c.query(
        "UPDATE platform_site_spec SET state=CASE WHEN state='superseded' THEN state ELSE $2 END,error_code=$3,reserved=CASE WHEN $4 THEN reserved ELSE false END,client_password_ciphertext=NULL WHERE id=$1",
        [job.spec_id, unknown ? 'unknown' : 'failed', code, unknown],
      );
    });
    try {
      await this.store.recordSiteResult(
        job.actor_id,
        'site.' + job.kind,
        hash,
        code,
        job.test_mode,
      );
    } catch (auditError) {
      // A revoked identity cannot resolve, but its admitted job still gets an immutable outcome below.
      if (!(auditError instanceof AccessError)) throw auditError;
    }
    await this.store.transaction(async (c) => {
      const site = (
        await c.query(
          'SELECT s.* FROM platform_site s JOIN platform_site_spec p ON p.site_id=s.id WHERE p.id=$1',
          [job.spec_id],
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
          job.billing_snapshot,
        );
    });
  }
  return true;
}

export async function recoverInterrupted(this: Sites) {
  await this.store.transaction(async (c) => {
    const jobs = (
      await c.query(
        "UPDATE platform_site_job SET state=CASE WHEN kind='deploy' THEN 'unknown' ELSE 'failed' END,finished_at=now() WHERE state='running' RETURNING spec_id,kind,actor_id,test_mode",
      )
    ).rows;
    for (const job of jobs) {
      if (job.kind !== 'usage')
        await c.query(
          "UPDATE platform_site_spec SET state=$2,error_code='worker_interrupted',reserved=CASE WHEN $3 THEN reserved ELSE false END,client_password_ciphertext=NULL WHERE id=$1",
          [
            job.spec_id,
            job.kind === 'deploy' ? 'unknown' : 'failed',
            job.kind === 'deploy',
          ],
        );
      await c.query(
        "INSERT INTO platform_audit(actor_user_id,action,target,details,test_mode) VALUES($1,'site.worker.recovery',$2,$3,$4)",
        [
          job.actor_id,
          job.spec_id,
          JSON.stringify({
            result: 'worker_interrupted',
            kind: job.kind,
            test: job.test_mode,
          }),
          job.test_mode,
        ],
      );
    }
  });
}

export async function startWorker(this: Sites) {
  const lease = await this.store.pool.connect();
  const locked = (
    await lease.query(
      "SELECT pg_try_advisory_lock(hashtext('a2aviary-site-worker')) AS locked",
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
            await this.drafts.cleanup();
          }
          if (!(await this.processOne()))
            await new Promise((r) => setTimeout(r, 1000));
        } catch {
          console.error(
            JSON.stringify({ event: 'site.worker.failed', test: false }),
          );
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    } finally {
      try {
        await lease.query(
          "SELECT pg_advisory_unlock(hashtext('a2aviary-site-worker'))",
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
