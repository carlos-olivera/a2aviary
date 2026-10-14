import test from 'node:test';
import assert from 'node:assert/strict';
import {policyDecision} from '../dist/policy.js';

const head = 'fictional-current-head';
const review = (login = 'carlos-olivera', commit_id = head, state = 'APPROVED') => ({user:{login}, state, commit_id});
const routine = [
  'docs/guide.md', 'docs/nested/guide.md', 'docs/architecture/provenance.json',
  'docs/decisions-guide.md', 'docs/evidence-guide.md', 'docs/history-guide.md',
  'docs/release-verification-notes.md', 'CHANGELOG.md', 'README.md', 'COSTS.md',
];
for (const filename of routine) test(`routine path needs no reviews: ${filename}`, () => {
  assert.deepEqual(policyDecision([{filename}], [], head), {allowed:true, sensitive:false, reason:'Policy satisfied.'});
});

const sensitive = [
  'library/behaviors/x.json', 'collections/blog/x.json', 'starters/profile/x.json',
  'scripts/x.mjs', 'local/x.mjs', 'brand/x', 'website/src/x', 'website/index.html',
  'docker-compose.local.yml', '.env.local.example', '.gitignore', '.editorconfig',
  'fictional-new-root-path', 'fictional-new-directory/file.md',
  'README.md.extra', 'nested/README.md',
  'docs/decisions/x.md', 'docs/evidence/x.json', 'docs/history/x.md',
  'docs/decisions/nested/x.md', 'docs/evidence/nested/x.md', 'docs/history/nested/x.md',
  'docs/release-verification.md',
  '.github/CODEOWNERS', 'infra/src/app.ts', 'services/src/policy.ts',
  'apps/platform/src/auth.ts', 'packages/generator/src/render.ts',
  'contracts/site/x.json', 'plans/x.json', 'policy/x.json', '.dockerignore',
  'AGENTS.md', 'CONTRIBUTING.md', 'GOVERNANCE.md', 'LICENSE', 'SECURITY.md',
  'package.json', 'package-lock.json', 'website/public/licenses/x.txt',
];
for (const filename of sensitive) test(`sensitive path requires current-head Carlos approval: ${filename}`, () => {
  const files = [{filename}];
  assert.deepEqual(policyDecision(files, [], head), {allowed:false, sensitive:true, reason:'Carlos must approve the current pull-request head.'});
  assert.equal(policyDecision(files, [review()], head).allowed, true);
  assert.equal(policyDecision(files, [review('carlos-olivera', 'fictional-old-head')], head).allowed, false);
  assert.equal(policyDecision(files, [review('collaborator-login')], head).allowed, false);
});

for (const previous_filename of sensitive) test(`sensitive rename origin stays sensitive: ${previous_filename}`, () => {
  const files = [{filename:'docs/guide.md', previous_filename}];
  assert.equal(policyDecision(files, [], head).allowed, false);
  assert.equal(policyDecision(files, [review()], head).allowed, true);
});

test('routine renames remain routine; a mixed diff requires approval', () => {
  const files = [{filename:'README.md', previous_filename:'docs/guide.md'}];
  assert.equal(policyDecision(files, [], head).allowed, true);
  assert.equal(policyDecision([...files, {filename:'library/behaviors/x.json'}], [], head).allowed, false);
});

test('only Carlos reviews affect the latest-review rule', () => {
  const files = [{filename:'library/behaviors/x.json'}];
  assert.equal(policyDecision(files, [review('collaborator-login')], head).allowed, false);
  assert.equal(policyDecision(files, [review(), review('collaborator-login', head, 'CHANGES_REQUESTED')], head).allowed, true);
  for (const state of ['CHANGES_REQUESTED', 'DISMISSED', 'COMMENTED']) {
    assert.equal(policyDecision(files, [review(), review('carlos-olivera', head, state)], head).allowed, false);
  }
});
