import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceFreshnessRequired } from '../scripts/architecture-scope.mjs';

test('runtime, contracts, collections, infrastructure and architecture changes require fresh provenance', () => {
  for (const path of ['apps/platform/src/tools/tool-registry.ts','apps/platform/Dockerfile','packages/site-core/src/policy.ts','collections/catalog/collection.json','plans/web-simple.policy.json','contracts/site/2.2.0/site-spec.schema.json','library/blog/component.json','packages/generator/scripts/collections.mjs','infra/src/email.ts','services/src/intake.ts','local/test.mjs','package-lock.json','AGENTS.md','website/scripts/check-architecture.mjs'])
    assert(sourceFreshnessRequired([path]), path);
});
test('unrelated PRs permit a stale source fingerprint; releases always require freshness', () => {
  const unrelated = ['docs/history/release-verification-2026-10.md','CHANGELOG.md','apps/platform/test/tool-visibility.test.mjs','.github/workflows/release.yml'];
  assert.equal(sourceFreshnessRequired(unrelated), false);
  assert.equal(sourceFreshnessRequired(unrelated,true), true);
  assert.equal(sourceFreshnessRequired([...unrelated,'packages/generator/src/render.ts']),true);
});
