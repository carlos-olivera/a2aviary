import { sha256, canonicalJson } from '@a2aviary/site-core';
import {
  assertVerified,
  SiteError,
  type VerifiedBuild,
} from '@a2aviary/generator';

import type { SpecRow } from './deployments.ts';
import type { Sites } from './deployments.ts';

export async function readVerifiedBuild(this: Sites, row: SpecRow) {
  const build = JSON.parse(
    Buffer.from(
      await this.objects.get('specs/' + row.id + '/build.json'),
    ).toString(),
  ) as VerifiedBuild;
  assertVerified(
    build,
    {
      sourceSha256: row.source_sha256,
      specSha256: row.spec_sha256,
    } as import('@a2aviary/generator').SourceBundle,
    row.spec,
  );
  if (
    build.report.outputSha256 !== row.output_sha256 ||
    canonicalJson(build.artifactHashes) !== canonicalJson(row.artifact_hashes)
  )
    throw new SiteError('artifact_integrity');
  for (const [name, hash] of Object.entries(row.artifact_hashes))
    if (
      sha256(
        await this.objects.get('specs/' + row.id + '/artifacts/' + name),
      ) !== hash
    )
      throw new SiteError('artifact_integrity');
  return build;
}

export async function saveBuild(
  this: Sites,
  specId: string,
  build: VerifiedBuild,
) {
  const artifactNames = Object.keys(build.artifacts).filter(
    (name) => name !== 'site.json',
  );
  const artifactHashes: Record<string, string> = {};
  for (const name of artifactNames) {
    artifactHashes[name] = sha256(Buffer.from(build.artifacts[name], 'base64'));
    if (!/^(?:report\.json|[a-f0-9]{12}-(?:390|1280)-actual\.png)$/.test(name))
      throw new SiteError('unsafe_verification_artifact');
    await this.objects.put(
      'specs/' + specId + '/artifacts/' + name,
      Buffer.from(build.artifacts[name], 'base64'),
    );
  }
  await this.objects.put(
    'specs/' + specId + '/build.json',
    Buffer.from(
      canonicalJson({
        ...build,
        artifacts: {},
        artifactNames,
        artifactHashes,
      }),
    ),
  );
  await this.store.pool.query(
    'UPDATE platform_site_spec SET artifact_hashes=$2 WHERE id=$1',
    [specId, JSON.stringify(artifactHashes)],
  );
}

export async function copyBuild(
  this: Sites,
  fromId: string,
  toId: string,
  build: VerifiedBuild,
) {
  const names =
    (build as VerifiedBuild & { artifactNames?: string[] }).artifactNames ?? [];
  const artifacts: Record<string, string> = {};
  for (const name of names)
    artifacts[name] = Buffer.from(
      await this.objects.get('specs/' + fromId + '/artifacts/' + name),
    ).toString('base64');
  await this.saveBuild(toId, { ...build, artifacts });
}
