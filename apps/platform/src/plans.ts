import { readFile } from 'node:fs/promises';
import { canonicalJson, sha256 } from '@a2aviary/site-core';

export async function loadPlans(root = new URL('../../../', import.meta.url)) {
  const manifest = JSON.parse(
    await readFile(new URL('contracts/site/2.2.0/manifest.json', root), 'utf8'),
  );
  const markdown = await readFile(
    new URL('contracts/site/2.2.0/manifest.md', root),
    'utf8',
  );
  const siteSpec = JSON.parse(
    await readFile(
      new URL('contracts/site/2.2.0/site-spec.schema.json', root),
      'utf8',
    ),
  );
  const changeRequest = JSON.parse(
    await readFile(
      new URL('contracts/site/2.2.0/change-request.schema.json', root),
      'utf8',
    ),
  );
  const policyBytes = await readFile(
    new URL('plans/web-simple.policy.json', root),
  );
  const policy = JSON.parse(policyBytes.toString('utf8'));
  const policySha256 = sha256(canonicalJson(policy));
  if (
    manifest.planId !== policy.planId.value ||
    manifest.policyVersion !== policy.version.value ||
    manifest.policySha256 !== policySha256
  )
    throw new Error('Stale generated plan manifest');
  if (
    siteSpec['x-provenance']?.policyVersion !== manifest.policyVersion ||
    changeRequest['x-provenance']?.policyVersion !== manifest.policyVersion ||
    siteSpec['x-provenance']?.policySha256 !== policySha256 ||
    changeRequest['x-provenance']?.policySha256 !== policySha256
  )
    throw new Error('Stale generated plan schemas');
  return {
    id: manifest.planId as string,
    version: manifest.policyVersion as string,
    manifest,
    markdown,
    siteSpec,
    changeRequest,
  };
}
export type Plans = Awaited<ReturnType<typeof loadPlans>>;
