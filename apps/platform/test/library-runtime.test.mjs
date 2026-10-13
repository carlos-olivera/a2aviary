import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { canonicalJson, sha256 } from '@a2aviary/site-core';

import { prepare, call, approve } from './draft-fixture.mjs';

test('MCP 2.1 settings and effects remain atomic, compact and cannot supply trusted audience', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('library@example.invalid');
  const created = await call(f, user, 'site.draft.create', {
    slug: 'library-draft',
    requestId: randomUUID(),
  });
  const apply = (operations) =>
    call(f, user, 'site.draft.apply', {
      draftId: created.draftId,
      expectedRevision: 0,
      requestId: randomUUID(),
      operations,
    });
  const rejected = await apply([
    { op: 'settings', settings: { language: 'es' } },
    {
      op: 'upsert-page',
      page: {
        id: 'home',
        path: '/',
        sections: [{ id: 'section', effects: ['fixture-glow'] }],
      },
    },
  ]);
  assert(rejected.isError);
  assert.equal(
    (await f.app.sites.drafts.get(user.id, created.draftId)).revision,
    0,
  );
  const spoofed = await f.rpc(await f.token(user), 'tools/call', {
    name: 'site.draft.apply',
    arguments: {
      draftId: created.draftId,
      expectedRevision: 0,
      requestId: randomUUID(),
      operations: [{ op: 'settings', settings: { test: true } }],
    },
  });
  assert((await spoofed.json()).result.isError);
  const result = await apply([
    {
      op: 'settings',
      settings: {
        language: 'es-BO',
        tokens: {
          fonts: { mono: 'system-mono' },
          motion: 'none',
          layout: 'flush',
        },
      },
    },
  ]);
  assert.equal(result.isError, false);
  assert.equal(result.language, 'es-BO');
  assert.equal(result.tokens.layout, 'flush');
  assert(Buffer.byteLength(JSON.stringify(result)) <= 4096);
  const info = await call(f, user, 'library.get', { id: 'inter' });
  assert.equal(info.family, 'Inter');
  assert.equal(info.source.subset, 'latin');
  assert.equal(
    (await call(f, user, 'library.get', { id: 'fixture-toggle' })).isError,
    true,
  );
  const listed = await f.rpc(await f.token(user), 'tools/list', {});
  assert(
    (await listed.json()).result.tools.some((t) => t.name === 'library.get'),
  );
});
for (const version of ['1.0.0', '1.0.1', '2.0.0', '2.1.0', '9.0.0'])
  test('unsupported policy ' + version + ' rejects draft reads, mutation, uploads, preview and discard', async (t) => {
    const f = await fixture(testDependencies()); t.after(f.close);
    const user = await f.user('unsupported@example.invalid'), d = f.app.sites.drafts;
    const created = await d.create(user.id, 'unsupported-draft', randomUUID());
    await f.pool.query('UPDATE platform_site SET policy_version=$2 WHERE id=$1', [created.siteId, version]);
    for (const operation of [
      () => d.get(user.id, created.draftId, 'full'),
      () => d.apply(user.id, { draftId: created.draftId, expectedRevision: 0, requestId: randomUUID(), operations: [{ op: 'settings', settings: { language: 'es' } }] }),
      () => d.preview(user.id, created.draftId, 0),
      () => d.open(user.id, created.draftId, randomUUID()),
      () => d.discard(user.id, created.draftId, 0),
    ]) await assert.rejects(operation(), /policy_version_unsupported/);
  });
test('same revision cannot reuse a preview with stale source/checker/generator provenance', async (t) => {
  const dependencies = testDependencies(),
    f = await fixture(dependencies);
  t.after(f.close);
  const user = await f.user('provenance@example.invalid');
  const saved = await prepare(f, user);
  await f.pool.query(
    "UPDATE platform_site_spec SET cache_key=$2,checker_sha256=$3,generator_version='2.1.0' WHERE id=$1",
    [saved.specId, '0'.repeat(64), '0'.repeat(64)],
  );
  const next = await f.app.sites.drafts.preview(
    user.id,
    saved.draftId,
    saved.revision,
  );
  assert.notEqual(next.specId, saved.specId);
});
test('library.get follows site-tool visibility', async (t) => {
  const f = await fixture();
  t.after(f.close);
  const user = await f.user('discovery@example.invalid');
  const r = await f.rpc(await f.token(user), 'tools/list', {});
  assert(!(await r.json()).result.tools.some((t) => t.name === 'library.get'));
});

for (const historical of ['2.0.0', '2.1.0'])
  test('historical snapshot ' + historical + ' cannot be approved or deployed', async (t) => {
    const deps = testDependencies(), f = await fixture(deps); t.after(f.close);
    const user = await f.user('unsupported-snapshot@example.invalid');
    const saved = await prepare(f, user); await f.app.sites.processOne();
    await f.pool.query('UPDATE platform_site SET policy_version=$2 WHERE id=$1', [saved.siteId,historical]);
    await assert.rejects(f.app.sites.drafts.approve(user.id, 'fictional-session', saved.specId, 'fictional-token'), /policy_version_unsupported/);
    await assert.rejects(f.app.sites.deploy(user.id,saved.siteId,saved.specId,'fictional-password-12345','DEPLOY_SITE:'+saved.siteId), /policy_version_unsupported/);
    assert.equal(deps.counts.deploys,0);
  });

for (const version of ['2.0.0','2.1.0'])
  test('unsupported snapshot policy is rejected even on a current-version site', async t => {
    const deps=testDependencies(),f=await fixture(deps);t.after(f.close);
    const user=await f.user('snapshot-policy@example.invalid'),saved=await prepare(f,user);
    await f.app.sites.processOne();
    await f.pool.query("UPDATE platform_site_spec SET spec=jsonb_set(spec,'{policyVersion}',to_jsonb($2::text)) WHERE id=$1",[saved.specId,version]);
    await assert.rejects(f.app.sites.drafts.approve(user.id,'fictional-session',saved.specId,'fictional-token'), /policy_version_unsupported/);
    await assert.rejects(f.app.sites.drafts.previewRow(f.app.sites.drafts.signPreview(saved.specId)), /policy_version_unsupported/);
    assert.equal(deps.counts.deploys,0);
  });
