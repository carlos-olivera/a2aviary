import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function loadPlans(root = new URL('../../../', import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('contracts/site/1.0.1/manifest.json', root), 'utf8'));
  const markdown = await readFile(new URL('contracts/site/1.0.1/manifest.md', root), 'utf8');
  const siteSpec = JSON.parse(await readFile(new URL('contracts/site/1.0.1/site-spec.schema.json', root), 'utf8'));
  const changeRequest = JSON.parse(await readFile(new URL('contracts/site/1.0.1/change-request.schema.json', root), 'utf8'));
  const policyBytes = await readFile(new URL('plans/web-simple.policy.json', root));
  const policy = JSON.parse(policyBytes.toString('utf8'));
  // Match the Phase 1 sorted-JSON policy digest, independent of file formatting.
  const canonical = (value: any): string => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value !== null && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}' : JSON.stringify(value);
  const policySha256 = createHash('sha256').update(canonical(policy)).digest('hex');
  if (manifest.planId !== policy.planId.value || manifest.policyVersion !== policy.version.value || manifest.policySha256 !== policySha256) throw new Error('Stale generated plan manifest');
  if (siteSpec['x-provenance']?.policyVersion !== manifest.policyVersion || changeRequest['x-provenance']?.policyVersion !== manifest.policyVersion || siteSpec['x-provenance']?.policySha256 !== policySha256 || changeRequest['x-provenance']?.policySha256 !== policySha256) throw new Error('Stale generated plan schemas');
  return {id: manifest.planId as string, version: manifest.policyVersion as string, manifest, markdown, siteSpec, changeRequest};
}
export type Plans = Awaited<ReturnType<typeof loadPlans>>;
