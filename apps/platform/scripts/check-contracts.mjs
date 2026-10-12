import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { defaultPolicy } from '@a2aviary/site-core';
import {
  assertPolicySnapshot,
  generateContracts,
} from '@a2aviary/site-core';
const root = new URL('../../../', import.meta.url);
const read = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));
assertPolicySnapshot(
  defaultPolicy,
  await read(
    `plans/versions/${defaultPolicy.planId.value}/${defaultPolicy.version.value}.policy.json`,
  ),
);
const generated = generateContracts(defaultPolicy);
assert.deepEqual(
  await read('contracts/site/2.2.0/site-spec.schema.json'),
  generated.siteSchema,
);
assert.deepEqual(
  await read('contracts/site/2.2.0/change-request.schema.json'),
  generated.changeSchema,
);
const manifest = await read('contracts/site/2.2.0/manifest.json');
assert.equal(manifest.planId, defaultPolicy.planId.value);
for (const key of ['includes', 'firstVersion', 'changes'])
  assert.deepEqual(manifest[key], defaultPolicy[key]);
assert.equal(manifest.policyVersion, generated.provenance.policyVersion);
assert.equal(manifest.policySha256, generated.provenance.policySha256);
console.log('Packaged plan contracts match Phase 1 generator.');
