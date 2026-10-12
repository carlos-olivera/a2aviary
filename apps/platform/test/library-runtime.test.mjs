import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { canonicalJson, sha256 } from '@a2aviary/generator';
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
test('retired drafts remain readable and discardable but cannot mutate or preview', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('retired@example.invalid'),
    d = f.app.sites.drafts;
  const created = await d.create(user.id, 'retired-draft', randomUUID());
  await f.pool.query(
    "UPDATE platform_site SET policy_version='2.0.0' WHERE id=$1",
    [created.siteId],
  );
  const read = await d.get(user.id, created.draftId, 'full');
  assert.equal(read.policyVersion, '2.0.0');
  assert.equal(read.missing[0].rule, 'policy.retired');
  await assert.rejects(
    d.apply(user.id, {
      draftId: created.draftId,
      expectedRevision: 0,
      requestId: randomUUID(),
      operations: [{ op: 'settings', settings: { language: 'es' } }],
    }),
    /draft_policy_retired/,
  );
  await assert.rejects(
    d.preview(user.id, created.draftId, 0),
    /draft_policy_retired/,
  );
  await assert.rejects(
    d.open(user.id, created.draftId, randomUUID()),
    /draft_policy_retired/,
  );
  await d.discard(user.id, created.draftId, 0);
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

test('a historical verified 2.0 snapshot remains approvable and deploys its stored bytes', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const user = await f.user('legacy-approved@example.invalid'),
    sites = f.app.sites,
    saved = await prepare(f, user);
  await sites.processOne();
  const row = (
    await f.pool.query('SELECT * FROM platform_site_spec WHERE id=$1', [
      saved.specId,
    ])
  ).rows[0];
  const spec = { ...row.spec, contractVersion: '2.0', policyVersion: '2.0.0' },
    digest = sha256(canonicalJson(spec));
  const key = 'specs/' + saved.specId + '/build.json',
    build = JSON.parse(Buffer.from(await deps.objects.get(key)).toString());
  build.report.specSha256 = digest;
  build.report.checks = build.report.checks.filter(
    (c) =>
      !c.name.startsWith('motion:reduced') && c.name !== 'network:external',
  );
  if (build.artifactHashes['report.json']) {
    const bytes = Buffer.from(JSON.stringify(build.report));
    await deps.objects.put(
      'specs/' + saved.specId + '/artifacts/report.json',
      bytes,
    );
    build.artifactHashes['report.json'] = sha256(bytes);
  }
  await deps.objects.put(key, Buffer.from(canonicalJson(build)));
  await f.pool.query(
    "UPDATE platform_site SET policy_version='2.0.0' WHERE id=$1",
    [saved.siteId],
  );
  await f.pool.query(
    "UPDATE platform_site_spec SET spec=$2,spec_sha256=$3,generator_version='2.1.0',artifact_hashes=$4 WHERE id=$1",
    [
      saved.specId,
      JSON.stringify(spec),
      digest,
      JSON.stringify(build.artifactHashes),
    ],
  );
  await approve(f, user, saved.specId);
  await sites.deploy(
    user.id,
    saved.siteId,
    saved.specId,
    'fictional-password-12345',
    'DEPLOY_SITE:' + saved.siteId,
  );
  await sites.processOne();
  assert.equal(deps.counts.verifies, 1);
  assert.equal(deps.counts.deploys, 1);
  assert.deepEqual(deps.inputs[0].build.files, build.files);
});
