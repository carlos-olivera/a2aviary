import { fixtureSelection } from '../scripts/fixture-selection.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { call, prepare } from './draft-fixture.mjs';
import { composition } from '@a2aviary/site-core/fixtures/presentation';

test('real MCP drafts/upload accept the presentation for tester sites and reject non-test sites', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const tester = await f.user('tester@example.invalid');
  const input = await composition('dark-en');
  const saved = await prepare(f, tester, input, true);
  assert.deepEqual(saved.missing, []);
  assert.deepEqual(saved.missingLabels, []);
  await f.app.sites.processOne();
  assert.equal(deps.counts.verifies, 1);
  const row = (
    await f.pool.query(
      'SELECT spec,test_mode FROM platform_site_spec WHERE id=$1',
      [saved.specId],
    )
  ).rows[0];
  assert.equal(row.test_mode, true);
  assert.equal(row.spec.contractVersion, '2.2');
  assert.deepEqual(row.spec.shell, input.spec.shell);
  assert.equal(row.spec.pages[0].sections[0].blocks[0].variant, 'flip-3d');
  const client = await f.user('client-presentation@example.invalid');
  const created = await call(f, client, 'site.draft.create', {
    slug: 'fictional-denied',
    requestId: randomUUID(),
  });
  const noImage = await composition('dark-en', { image: false });
  const apply = await call(f, client, 'site.draft.apply', {
    draftId: created.draftId,
    expectedRevision: 0,
    requestId: randomUUID(),
    operations: [
      {
        op: 'settings',
        settings: {
          tokens: noImage.spec.tokens,
          shell: noImage.spec.shell,
          language: noImage.spec.language,
          navigation: noImage.spec.navigation,
          cms: noImage.spec.cms,
        },
      },
      { op: 'upsert-page', index: 0, page: noImage.spec.pages[0] },
    ],
  });
  assert.equal(apply.isError, true);
  assert(JSON.stringify(apply).includes('library.status'));
  const spoof = await f.rpc(await f.token(client), 'tools/call', {
    name: 'site.draft.apply',
    arguments: {
      draftId: created.draftId,
      expectedRevision: 0,
      requestId: randomUUID(),
      operations: [{ op: 'settings', settings: { test: true } }],
    },
  });
  assert.equal((await spoof.json()).result.isError, true);
  assert.equal(deps.counts.deploys, 0);
});
test('incomplete labels survive incremental apply, are reported immediately, and block preview', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const tester = await f.user('tester@example.invalid');
  const input = await composition('light-es', { image: false });
  delete input.spec.shell;
  const props = input.spec.pages[0].sections[0].blocks[0].props;
  delete props.copyLabel;
  props.manualCopyLabel = ' ';
  const created = await call(f, tester, 'site.draft.create', {
    slug: 'fictional-labels',
    requestId: randomUUID(),
  });
  const applied = await call(f, tester, 'site.draft.apply', {
    draftId: created.draftId,
    expectedRevision: 0,
    requestId: randomUUID(),
    operations: [
      {
        op: 'settings',
        settings: {
          language: 'es',
          shell: { skipLink: '' },
          tokens: input.spec.tokens,
          navigation: input.spec.navigation,
          cms: input.spec.cms,
        },
      },
      { op: 'upsert-page', index: 0, page: input.spec.pages[0] },
    ],
  });
  assert.equal(applied.isError, false, JSON.stringify(applied));
  const paths = applied.missingLabels.flatMap((g) =>
    g.fields.map((k) => g.path + '/' + k),
  );
  assert(paths.includes('/shell/notFoundText'));
  assert(paths.includes('/pages/0/sections/0/blocks/0/props/manualCopyLabel'));
  assert.equal(paths.length, 8);
  const got = await call(f, tester, 'site.draft.get', {
    draftId: created.draftId,
  });
  assert.deepEqual(got.missingLabels, applied.missingLabels);
  const preview = await call(f, tester, 'site.preview', {
    draftId: created.draftId,
    expectedRevision: applied.revision,
  });
  assert.equal(preview.isError, true);
  assert(JSON.stringify(preview).includes('/shell/notFoundText'));
});
test('2.1 drafts remain readable and discardable but edits and previews are retired', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('history@example.invalid');
  const d = f.app.sites.drafts;
  const created = await d.create(user.id, 'fictional-history', randomUUID());
  await f.pool.query(
    "UPDATE platform_site SET policy_version='2.1.0' WHERE id=$1",
    [created.siteId],
  );
  assert.equal(
    (await d.get(user.id, created.draftId)).missing[0].rule,
    'policy.retired',
  );
  await assert.rejects(
    d.apply(user.id, {
      draftId: created.draftId,
      expectedRevision: 0,
      requestId: randomUUID(),
      operations: [{ op: 'settings', settings: { language: 'en' } }],
    }),
    /draft_policy_retired/,
  );
  await assert.rejects(
    d.preview(user.id, created.draftId, 0),
    /draft_policy_retired/,
  );
  await d.discard(user.id, created.draftId, 0);
});

test('hosted alternative input parsing is allowlisted and independently testable without providers', () => {
  assert.equal(fixtureSelection([]), undefined);
  assert.equal(fixtureSelection(['--composition', 'dark-en']), 'dark-en');
  assert.equal(
    fixtureSelection(['--preflight', '--composition', 'contrast-es']),
    'contrast-es',
  );
  for (const args of [
    ['--composition'],
    ['--composition', '../../private'],
    ['--composition', 'dark-en', '--composition', 'light-es'],
    ['--run'],
  ])
    assert.throws(() => fixtureSelection(args));
});
