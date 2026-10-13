import { sha256, canonicalJson, defaultPolicy } from '@a2aviary/site-core';
import { SiteError, type VerifiedBuild } from '@a2aviary/generator';

import type { Sites } from './deployments.ts';

export async function status(this: Sites, actor: string, siteId: string) {
  const snapshot = await this.store.siteAction(
    actor,
    'site.status',
    async (c, p) => {
      const site = await this.owned(c, actor, siteId);
      p.testMode = site.test_mode;
      const specs = (
        await c.query(
          'SELECT id AS "specId",state,spec_sha256 AS "specSha256",source_sha256 AS "sourceSha256",output_sha256 AS "outputSha256",error_code AS "error",draft_revision AS revision,expires_at AS "expiresAt", EXISTS(SELECT 1 FROM platform_site_approval a WHERE a.spec_id=platform_site_spec.id) AS approved,test_mode AS test,accounting,applied_at AS "appliedAt" FROM platform_site_spec WHERE site_id=$1 ORDER BY created_at DESC LIMIT 3',
          [siteId],
        )
      ).rows;
      await this.audit(
        c,
        p,
        'site.status',
        specs[0]?.specSha256 ?? null,
        'read',
        null,
        site.id,
      );
      return {
        siteId,
        test: site.test_mode,
        free:
          site.test_mode ||
          ['admin', 'superadmin'].includes(
            (await this.store.currentPrincipal(c, site.owner_id)).role,
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
        monthlyRequestsUsed: await this.successfulUsage(c, site.owner_id),
        monthlyCapacityHeld: await this.usage(c, site.owner_id),
        monthlyRequestsRemaining: Math.max(
          0,
          defaultPolicy.changes.perMonth.value -
            (await this.usage(c, site.owner_id)),
        ),
        resources: site.resources,
        name: this.name(site),
      };
    },
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
        bundlePath: '/api/site-artifacts/' + s.specId + '/site.json',
      })),
  };
}

export async function artifact(
  this: Sites,
  actor: string,
  specId: string,
  name: string,
) {
  if (
    !/^(?:report\.json|site\.json|[a-f0-9]{12}-(?:390|1280)-actual\.png)$/.test(
      name,
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
        row.site_id,
      );
      return row;
    },
  );
  const build = JSON.parse(
    Buffer.from(
      await this.objects.get('specs/' + row.id + '/build.json'),
    ).toString(),
  ) as VerifiedBuild;
  if (name === 'site.json')
    return Buffer.from(
      canonicalJson({
        files: build.files,
        outputSha256: build.report.outputSha256,
      }),
    );
  if (
    !(
      build as VerifiedBuild & { artifactNames?: string[] }
    ).artifactNames?.includes(name)
  )
    throw new SiteError('artifact_not_found');
  const bytes = await this.objects.get(
    'specs/' + row.id + '/artifacts/' + name,
  );
  if (sha256(bytes) !== (build.artifactHashes ?? {})[name])
    throw new SiteError('artifact_integrity');
  return Buffer.from(bytes);
}

export async function failure(
  this: Sites,
  actor: string,
  tool: string,
  specId: string | undefined,
  code: string,
  siteId?: string,
) {
  let hash: string | null = null;
  if (specId)
    hash =
      (
        await this.store.pool.query(
          'SELECT p.spec_sha256 FROM platform_site_spec p JOIN platform_site s ON s.id=p.site_id WHERE p.id=$1 AND s.owner_id=$2',
          [specId, actor],
        )
      ).rows[0]?.spec_sha256 ?? null;
  const test = siteId
    ? Boolean(
        (
          await this.store.pool.query(
            'SELECT test_mode FROM platform_site WHERE id=$1 AND owner_id=$2',
            [siteId, actor],
          )
        ).rows[0]?.test_mode,
      )
    : undefined;
  await this.store.recordSiteResult(actor, tool, hash, code, test || undefined);
}
