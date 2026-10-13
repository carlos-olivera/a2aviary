import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { prepare, approve, call } from './draft-fixture.mjs';
import { profileComposition } from '../../../packages/site-core/fixtures/starters/profile.mjs';
import { composition } from '@a2aviary/site-core/fixtures/presentation';
import {
  canonicalJson,
  sha256,
  defaultPolicy,
  policyForVersion,
  validateSiteSpec,
} from '@a2aviary/site-core';
import { readFile } from 'node:fs/promises';

async function live(f, u, starter = false) {
  const input = await (starter
    ? profileComposition('light-es')
    : composition('light-es'));
  input.slug += '-' + randomUUID().slice(0, 8);
  const initial = await prepare(
    f,
    u,
    input,
    false,
    () => {},
    starter ? { id: 'profile', version: '1.0.0' } : undefined,
  );
  await f.app.sites.processOne();
  await approve(f, u, initial.specId);
  await f.app.sites.deploy(
    u.id,
    initial.siteId,
    initial.specId,
    'fictional-password-only',
    'DEPLOY_SITE:' + initial.siteId,
  );
  await f.app.sites.processOne();
  assert.equal(
    (await f.app.sites.status(u.id, initial.siteId)).currentSpecId,
    initial.specId,
  );
  return initial;
}
async function edit(f, u, siteId, label = 'Changed fictional heading') {
  const d = await f.app.sites.drafts.openEdit(u.id, siteId, randomUUID());
  const full = await f.app.sites.drafts.get(u.id, d.draftId, 'full');
  const page = structuredClone(full.content.pages[0]);
  page.seo.title = label;
  const updated = await f.app.sites.drafts.apply(u.id, {
    draftId: d.draftId,
    expectedRevision: d.revision,
    requestId: randomUUID(),
    operations: [{ op: 'upsert-page', page }],
  });
  const snapshot = await f.app.sites.drafts.preview(
    u.id,
    d.draftId,
    updated.revision,
  );
  await f.app.sites.processOne();
  await approve(f, u, snapshot.specId);
  return { ...updated, ...snapshot };
}
const deploy = (f, u, s) =>
  f.app.sites.deploy(
    u.id,
    s.siteId,
    s.specId,
    undefined,
    'DEPLOY_SITE:' + s.siteId,
  );

test('live draft lifecycle reuses assets and stored bytes, changes content/tokens/sections/pages, preserves provenance and history', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('tester@example.invalid'),
    owner = await f.user('owner@example.invalid');
  const initial = await live(f, u, true),
    s = f.app.sites,
    d = s.drafts;
  const requestId = randomUUID();
  const opened = await call(f, u, 'site.edit.open', {
    siteId: initial.siteId,
    requestId,
  });
  assert.equal(opened.isError, false);
  assert.equal(
    (await d.openEdit(u.id, initial.siteId, requestId)).draftId,
    opened.draftId,
  );
  assert.equal(opened.baseSpecId, initial.specId);
  const content = (await d.get(u.id, opened.draftId, 'full')).content;
  assert.ok(content.assets.length);
  assert.ok(
    ![...deps.data.keys()].some((k) =>
      k.startsWith('drafts/' + opened.draftId + '/assets/'),
    ),
  );
  const original = await f.pool.query(
    'SELECT kind,starter_id,starter_version FROM platform_site WHERE id=$1',
    [initial.siteId],
  );
  const page = structuredClone(content.pages[0]);
  page.seo.title = 'Edited fictional studio';
  page.sections.push({
    id: 'edit-section',
    blocks: [
      {
        id: 'edit-copy',
        component: 'rich-text',
        variant: 'standard',
        props: {
          content: [
            {
              type: 'paragraph',
              text: 'New fictional content supplied by the human.',
            },
          ],
        },
      },
    ],
  });
  const added = {
    ...structuredClone(page),
    id: 'new-page',
    path: '/new-page/',
    seo: {
      title: 'New fictional page',
      description: 'Prepared fictional page.',
    },
  };
  const tokens = structuredClone(content.tokens);
  tokens.colors.primary = '#123456';
  const updated = await d.apply(u.id, {
    draftId: opened.draftId,
    expectedRevision: opened.revision,
    requestId: randomUUID(),
    operations: [
      { op: 'settings', settings: { tokens } },
      { op: 'upsert-page', page },
      { op: 'upsert-page', page: added, index: 1 },
    ],
  });
  const quick = await d.quick.create(u.id, opened.draftId, updated.revision);
  assert.equal(quick.verified, false);
  const preview = await d.preview(u.id, opened.draftId, updated.revision);
  await s.processOne();
  await approve(f, u, preview.specId);
  await deploy(f, u, { ...preview, siteId: initial.siteId });
  assert.equal(
    (await s.status(u.id, initial.siteId)).currentSpecId,
    initial.specId,
  );
  assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 0);
  await assert.rejects(
    d.apply(u.id, {
      draftId: opened.draftId,
      expectedRevision: updated.revision,
      requestId: randomUUID(),
      operations: [{ op: 'remove-page', pageId: 'new-page' }],
    }),
    /deployment_busy/,
  );
  await assert.rejects(
    d.openEdit(u.id, initial.siteId, randomUUID()),
    /deployment_busy/,
  );
  await s.processOne();
  const status = await s.status(u.id, initial.siteId);
  assert.equal(status.currentSpecId, preview.specId);
  assert.equal(status.monthlyRequestsUsed, 1);
  assert.equal(deps.inputs.at(-1).clientPassword, undefined);
  assert.equal(deps.inputs.at(-1).redeploy, true);
  const stored = JSON.parse(
    Buffer.from(
      await deps.objects.get('specs/' + preview.specId + '/build.json'),
    ).toString(),
  );
  assert.deepEqual(deps.inputs.at(-1).build.files, stored.files);
  assert.equal(deps.counts.verifies, 2);
  await deploy(f, u, { ...preview, siteId: initial.siteId });
  assert.equal(deps.counts.deploys, 2);
  assert.deepEqual(
    (
      await f.pool.query(
        'SELECT kind,starter_id,starter_version FROM platform_site WHERE id=$1',
        [initial.siteId],
      )
    ).rows,
    original.rows,
  );
  assert.equal(
    (await s.inspect(owner.id, initial.siteId)).monthlyRequestsUsed,
    1,
  );
  assert.equal(
    (await s.list(owner.id, { limit: 25 })).sites[0].deployedEdits,
    1,
  );
  const report = await s.administration.report(
    owner.id,
    initial.siteId,
    new Date().toISOString().slice(0, 7),
  );
  assert.equal(report.appliedChanges, 1);
  assert.equal(report.editHistory.length, 1);
  assert.equal(
    (
      await f.pool.query('SELECT state FROM platform_site_spec WHERE id=$1', [
        initial.specId,
      ])
    ).rows[0].state,
    'live',
  );
  await d.cleanup();
  assert.ok(await deps.objects.get('specs/' + initial.specId + '/build.json'));
  const later = await d.openEdit(u.id, initial.siteId, randomUUID());
  await d.discard(u.id, later.draftId, later.revision);
  assert.equal(
    (
      await f.pool.query(
        'SELECT count(*)::int n FROM platform_site_draft WHERE site_id=$1',
        [initial.siteId],
      )
    ).rows[0].n,
    3,
  );
  await s.reset(owner.id, initial.siteId, 'RESET ' + initial.siteId);
  const archived = await s.inspect(owner.id, initial.siteId);
  assert.equal(
    archived.monthlyRequestsUsed,
    0,
    'documented tester reset clears allowance',
  );
  assert.equal(archived.archivedEdits[0].specId, preview.specId);
  assert.equal(
    (await s.list(owner.id, { limit: 25 })).sites[0].deployedEdits,
    1,
  );
  const archivedReport = await s.administration.report(
    owner.id,
    initial.siteId,
    new Date().toISOString().slice(0, 7),
  );
  assert.equal(
    archivedReport.appliedChanges,
    1,
    'historical reporting survives reset',
  );
  assert.equal(archivedReport.editHistory[0].specId, preview.specId);
  assert.equal(archivedReport.editHistory[0].archived, true);

  assert.equal(
    (await f.pool.query('SELECT count(*)::int n FROM platform_site_approval'))
      .rows[0].n,
    2,
  );
  assert.equal(
    (await f.pool.query('SELECT count(*)::int n FROM platform_site_draft'))
      .rows[0].n,
    0,
  );
});

test('concurrent edit admission, stale approval and failed/unknown deployment preserve the live baseline', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('tester@example.invalid'),
    initial = await live(f, u),
    d = f.app.sites.drafts,
    s = f.app.sites;
  const contenders = await Promise.allSettled([
    d.openEdit(u.id, initial.siteId, randomUUID()),
    d.openEdit(u.id, initial.siteId, randomUUID()),
  ]);
  assert.equal(contenders.filter((x) => x.status === 'fulfilled').length, 1);
  assert.match(
    contenders.find((x) => x.status === 'rejected').reason.message,
    /active_draft_exists/,
  );
  const opened = contenders.find((x) => x.status === 'fulfilled').value;
  await d.discard(u.id, opened.draftId, opened.revision);
  let candidate = await edit(f, u, initial.siteId);
  await d.apply(u.id, {
    draftId: candidate.draftId,
    expectedRevision: candidate.revision,
    requestId: randomUUID(),
    operations: [{ op: 'settings', settings: { language: 'en' } }],
  });
  await assert.rejects(deploy(f, u, candidate), /snapshot_approval_required/);
  await assert.rejects(approve(f, u, candidate.specId));
  await d.discard(u.id, candidate.draftId, candidate.revision + 1);
  candidate = await edit(f, u, initial.siteId, 'Second fictional revision');
  deps.failDeployment(true);
  await deploy(f, u, candidate);
  await s.processOne();
  assert.equal(
    (await s.status(u.id, initial.siteId)).currentSpecId,
    initial.specId,
  );
  assert.equal((await s.status(u.id, initial.siteId)).monthlyCapacityHeld, 0);
  deps.failDeployment(false);
  await deploy(f, u, candidate);
  await s.processOne();
  assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 1);
  candidate = await edit(f, u, initial.siteId, 'Third fictional revision');
  deps.failDeployment(true, true);
  await deploy(f, u, candidate);
  await s.processOne();
  assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 1);
  assert.equal((await s.status(u.id, initial.siteId)).monthlyCapacityHeld, 2);
  await assert.rejects(
    d.openEdit(u.id, initial.siteId, randomUUID()),
    /deployment_busy/,
  );
});

test('UTC month boundaries, held capacity and plan allowance do not charge failed previews or retries', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const u = await f.user('tester@example.invalid'),
    initial = await live(f, u),
    s = f.app.sites;
  const candidate = await edit(f, u, initial.siteId);
  // Real SQL boundary fixtures, relative to the transaction clock: just before
  // this UTC month, its first instant, and next month. Session timezone differs.
  await f.pool.query("SET TIME ZONE 'Pacific/Honolulu'");
  for (const when of [
    "(date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 microsecond'",
    "date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",
    "(date_trunc('month',now() AT TIME ZONE 'UTC')+interval '1 month') AT TIME ZONE 'UTC'",
  ]) {
    await f.pool.query(
      `INSERT INTO platform_site_spec(id,site_id,spec,spec_sha256,state,accounting,applied_at) SELECT $1,site_id,spec,spec_sha256,'live','{"kind":"edit"}',${when} FROM platform_site_spec WHERE id=$2`,
      [randomUUID(), initial.specId],
    );
  }
  assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 1);
  for (let i = 1; i < defaultPolicy.changes.perMonth.value; i++)
    await f.pool.query(
      `INSERT INTO platform_site_spec(id,site_id,spec,spec_sha256,state,accounting,applied_at) SELECT $1,site_id,spec,spec_sha256,'live','{"kind":"edit"}',now() FROM platform_site_spec WHERE id=$2`,
      [randomUUID(), initial.specId],
    );
  await assert.rejects(deploy(f, u, candidate), /monthly_change_allowance/);
  await f.pool.query(
    "UPDATE platform_site_spec SET applied_at=(date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 microsecond' WHERE accounting IS NOT NULL AND applied_at IS NOT NULL",
  );
  assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 0);
  await deploy(f, u, candidate);
  await s.processOne();
  assert.equal((await s.status(u.id, initial.siteId)).monthlyRequestsUsed, 1);
});

test('2.3 requires all explicit shell/presentation values while frozen 2.2 remains valid', async () => {
  const old = JSON.parse(
    await readFile(
      new URL(
        '../../../contracts/site/2.2.0/examples/site-spec.json',
        import.meta.url,
      ),
    ),
  );
  assert.equal(validateSiteSpec(old, policyForVersion('2.2.0')).ok, true);
  const current = (await composition('light-es')).spec;
  for (const path of [
    'language',
    'shell',
    'tokens.fonts.mono',
    'tokens.motion',
    'tokens.layout',
  ]) {
    const s = structuredClone(current),
      keys = path.split('.'),
      key = keys.pop();
    delete keys.reduce((v, k) => v[k], s)[key];
    assert.equal(
      validateSiteSpec(s, defaultPolicy, { test: true }).ok,
      false,
      path,
    );
  }
  assert.equal(
    sha256(canonicalJson(policyForVersion('2.2.0'))),
    sha256(
      canonicalJson(
        JSON.parse(
          await readFile(
            new URL(
              '../../../plans/versions/web-simple/2.2.0.policy.json',
              import.meta.url,
            ),
          ),
        ),
      ),
    ),
  );
});

test('last monthly slot is atomic across sites; a running provider freezes the edit and retains the baseline', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('tester@example.invalid'),
    s = f.app.sites;
  const a = await live(f, u),
    b = await live(f, u),
    ea = await edit(f, u, a.siteId, 'Site A edited'),
    eb = await edit(f, u, b.siteId, 'Site B edited');
  for (let n = 0; n < 3; n++)
    await f.pool.query(
      `INSERT INTO platform_site_spec(id,site_id,spec,spec_sha256,state,accounting,applied_at) SELECT $1,site_id,spec,spec_sha256,'live','{"kind":"edit"}',now() FROM platform_site_spec WHERE id=$2`,
      [randomUUID(), a.specId],
    );
  const attempts = await Promise.allSettled([
    deploy(f, u, ea),
    deploy(f, u, eb),
  ]);
  assert.equal(attempts.filter((v) => v.status === 'fulfilled').length, 1);
  assert.match(
    attempts.find((v) => v.status === 'rejected').reason.message,
    /monthly_change_allowance/,
  );
  const winner = attempts[0].status === 'fulfilled' ? ea : eb,
    base = winner.siteId === a.siteId ? a : b;
  let entered, release;
  const started = new Promise((r) => (entered = r)),
    gate = new Promise((r) => (release = r)),
    original = deps.deployer.deploy;
  deps.deployer.deploy = async (input) => {
    entered();
    await gate;
    return original(input);
  };
  const processing = s.processOne();
  await started;
  try {
    await assert.rejects(
      s.drafts.openEdit(u.id, winner.siteId, randomUUID()),
      /deployment_busy/,
    );
    await assert.rejects(
      s.drafts.apply(u.id, {
        draftId: winner.draftId,
        expectedRevision: winner.revision,
        requestId: randomUUID(),
        operations: [{ op: 'settings', settings: { language: 'es' } }],
      }),
      /deployment_busy/,
    );
    assert.equal(
      (await s.status(u.id, winner.siteId)).currentSpecId,
      base.specId,
    );
  } finally {
    release();
    await processing;
  }
  assert.equal((await s.status(u.id, winner.siteId)).monthlyRequestsUsed, 4);
});

test('a frozen 2.2 verified snapshot can still be approved and deployed without rebuilding or new defaults', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('tester@example.invalid'),
    s = f.app.sites;
  const initial = await prepare(f, u);
  await s.processOne();
  const row = (
    await f.pool.query('SELECT * FROM platform_site_spec WHERE id=$1', [
      initial.specId,
    ])
  ).rows[0];
  const legacy = structuredClone(row.spec);
  legacy.policyVersion = '2.2.0';
  legacy.contractVersion = '2.2';
  delete legacy.shell;
  delete legacy.language;
  delete legacy.tokens.fonts.mono;
  delete legacy.tokens.motion;
  delete legacy.tokens.layout;
  const { generateSite } = await import('@a2aviary/generator');
  const assets = new Map();
  for (const a of legacy.assets)
    assets.set(
      a.id,
      await deps.objects.get('specs/' + row.id + '/assets/' + a.id),
    );
  const source = await generateSite(legacy, assets, {
    test: true,
    serverNormalized: true,
  });
  const build = await deps.verifier.verify(source, legacy, { test: true });
  await s.saveBuild(row.id, build);
  await f.pool.query(
    "UPDATE platform_site_spec SET spec=$2,spec_sha256=$3,source_sha256=$4,output_sha256=$5,state='verified' WHERE id=$1",
    [
      row.id,
      JSON.stringify(legacy),
      source.specSha256,
      source.sourceSha256,
      build.report.outputSha256,
    ],
  );
  await f.pool.query(
    "UPDATE platform_site SET policy_version='2.2.0' WHERE id=$1",
    [initial.siteId],
  );
  await f.pool.query(
    "UPDATE platform_site_draft SET policy_version='2.2.0' WHERE id=$1",
    [initial.draftId],
  );
  await approve(f, u, row.id);
  const before = deps.counts.verifies;
  await s.deploy(
    u.id,
    initial.siteId,
    row.id,
    'fictional-password-only',
    'DEPLOY_SITE:' + initial.siteId,
  );
  await s.processOne();
  assert.equal((await s.status(u.id, initial.siteId)).currentSpecId, row.id);
  assert.equal(deps.counts.verifies, before);
  assert.deepEqual(deps.inputs.at(-1).build.files, build.files);
  assert.equal(deps.inputs.at(-1).spec.shell, undefined);
  const opened = await s.drafts.openEdit(u.id, initial.siteId, randomUUID());
  assert.equal(opened.policyVersion, '2.3.0');
  assert.ok(opened.requiredInputs.includes('/shell/skipLink'));
  await assert.rejects(
    s.drafts.preview(u.id, opened.draftId, opened.revision),
    /draft_incomplete/,
  );
});

test('returning to earlier content keeps the new approved snapshot identity in immutable deployment history', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const u = await f.user('tester@example.invalid');
  const initial = await live(f, u);
  const original = (
    await f.pool.query(
      'SELECT spec,spec_sha256 FROM platform_site_spec WHERE id=$1',
      [initial.specId],
    )
  ).rows[0];
  const changed = await edit(f, u, initial.siteId);
  await deploy(f, u, changed);
  await f.app.sites.processOne();
  const restored = await edit(
    f,
    u,
    initial.siteId,
    original.spec.pages[0].seo.title,
  );
  await deploy(f, u, restored);
  await f.app.sites.processOne();
  const row = (
    await f.pool.query(
      'SELECT spec_sha256 FROM platform_site_spec WHERE id=$1',
      [restored.specId],
    )
  ).rows[0];
  assert.equal(row.spec_sha256, original.spec_sha256);
  assert.notEqual(restored.specId, initial.specId);
  const event = (
    await f.pool.query(
      "SELECT spec_id FROM platform_site_operation WHERE site_id=$1 AND kind='site.deploy' AND result='applied' ORDER BY id DESC LIMIT 1",
      [initial.siteId],
    )
  ).rows[0];
  assert.equal(event.spec_id, restored.specId);
  assert.equal(
    (await f.app.sites.status(u.id, initial.siteId)).monthlyRequestsUsed,
    2,
  );
});
