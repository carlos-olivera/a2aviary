import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const sharp = createRequire(
  new URL('../../../packages/generator/package.json', import.meta.url),
)('sharp');
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { prepare, approve, call } from './draft-fixture.mjs';
import { fixtureSubmission } from '../../../packages/generator/scripts/fixture-lib.mjs';

test('revisioned MCP drafts validate partial content, atomicity, conflicts, missing inputs and compact budgets', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('draft@example.invalid'),
    outsider = await f.user('outsider@example.invalid');
  const req = randomUUID(),
    created = await call(f, user, 'site.draft.create', {
      slug: 'draft',
      requestId: req,
    });
  assert.equal(created.isError, false);
  assert.ok(created.missing.length);
  assert.ok(Buffer.byteLength(JSON.stringify(created)) < 4096);
  for (const sections of [null, [{ id: 'section', blocks: [null] }]]) {
    const malformed = await call(f, user, 'site.draft.apply', {
      draftId: created.draftId,
      expectedRevision: 0,
      requestId: randomUUID(),
      operations: [{ op: 'upsert-page', page: { id: 'home', path: '/', sections }, index: 0 }],
    });
    assert.equal(malformed.error, 'draft_validation');
    assert.equal(malformed.errors[0].operationIndex, 0);
    assert.ok(malformed.errors[0].path.startsWith('/pages/0/sections'));
    assert.equal((await f.app.sites.drafts.get(user.id, created.draftId)).revision, 0);
  }
  assert.deepEqual(
    await call(f, user, 'site.draft.create', { slug: 'draft', requestId: req }),
    created,
  );
  const conflict = await call(f, user, 'site.draft.create', {
    slug: 'different',
    requestId: req,
  });
  assert.equal(conflict.error, 'idempotency_conflict');
  const bad = await call(f, user, 'site.draft.apply', {
    draftId: created.draftId,
    expectedRevision: 0,
    requestId: randomUUID(),
    operations: [
      { op: 'upsert-page', page: { id: 'home', path: '/' }, index: 0 },
      {
        op: 'upsert-page',
        page: { id: 'bad', path: '/api/private/' },
        index: 1,
      },
    ],
  });
  assert.equal(bad.isError, true);
  assert.equal(bad.errors[0].operationIndex, 1);
  assert.ok('actual' in bad.errors[0]);
  assert.equal(
    (await f.app.sites.drafts.get(user.id, created.draftId, 'full')).content
      .pages.length,
    0,
  );
  const good = {
    draftId: created.draftId,
    expectedRevision: 0,
    requestId: randomUUID(),
    operations: [
      { op: 'upsert-page', page: { id: 'home', path: '/' }, index: 0 },
    ],
  };
  const updated = await call(f, user, 'site.draft.apply', good);
  assert.equal(updated.revision, 1);
  assert.deepEqual(await call(f, user, 'site.draft.apply', good), updated);
  assert.equal(
    (
      await call(f, user, 'site.draft.apply', {
        ...good,
        requestId: randomUUID(),
      })
    ).error,
    'revision_conflict',
  );
  assert.equal(
    (
      await call(f, user, 'site.preview', {
        draftId: created.draftId,
        expectedRevision: 1,
      })
    ).error,
    'draft_incomplete',
  );
  assert.equal(
    (await call(f, outsider, 'site.draft.get', { draftId: created.draftId }))
      .isError,
    true,
  );
  assert.equal(
    (await f.request('/api/site-specs', { method: 'POST', body: '{}' })).status,
    404,
  );
  assert.equal(
    (await call(f, user, 'change.request')).error,
    'change_requests_unavailable',
  );
  const list = await (await f.rpc(await f.token(user))).json();
  assert.ok(
    !list.result.tools.some(
      (x) => x.name === 'site.build' || x.name === 'site.approve',
    ),
  );
});

test('agent probe, blocked-network instructions, mixed channels, safe retries, authorization and session expiry', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('upload@example.invalid'),
    outsider = await f.user('other@example.invalid');
  const d = f.app.sites.drafts;
  const created = await d.create(user.id, 'upload', randomUUID()),
    r = await d.open(user.id, created.draftId, randomUUID());
  assert.match(r.selectionRule, /probe fails/);
  assert.ok(r.human.url && r.human.qrUrl);
  await assert.rejects(
    fetch('http://127.0.0.1:1', { signal: AbortSignal.timeout(100) }),
  ); // blocked network causes no session mutation; human link remains usable
  const headers = { authorization: r.agent.authorization };
  assert.equal(
    (
      await fetch(r.agent.probe.url, {
        method: 'PUT',
        headers,
        body: Buffer.from([0]),
      })
    ).status,
    200,
  );
  const bytes = await sharp({
      create: { width: 16, height: 8, channels: 3, background: '#345678' },
    })
      .jpeg()
      .toBuffer(),
    uid = randomUUID(),
    url = r.agent.uploadUrl.replace('{uploadId}', uid);
  const first = await fetch(url, { method: 'PUT', headers, body: bytes }),
    asset = await first.json();
  assert.equal(first.status, 200, JSON.stringify(asset));
  const retry = await fetch(url, { method: 'PUT', headers, body: bytes });
  assert.equal((await retry.json()).assetId, asset.assetId);
  const different = await sharp({
    create: { width: 16, height: 8, channels: 3, background: '#876543' },
  })
    .png()
    .toBuffer();
  assert.equal(
    (await fetch(url, { method: 'PUT', headers, body: different })).status,
    403,
  );
  const page = await f.request(new URL(r.human.url).pathname, {
      headers: { cookie: user.cookie },
    }),
    html = await page.text();
  assert.equal(page.status, 200);
  assert.ok(html.includes(asset.assetId));
  const csrf = html.match(/data-csrf="([^"]+)"/)[1];
  const humanUrl = r.agent.uploadUrl.replace('{uploadId}', randomUUID());
  const humanHeaders = {
    cookie: user.cookie,
    origin: f.config.origin,
    'x-csrf-token': csrf,
  };
  const h = await fetch(humanUrl, {
    method: 'PUT',
    headers: humanHeaders,
    body: different,
  });
  assert.equal(h.status, 200, await h.text());
  assert.equal(
    (
      await fetch(r.agent.uploadUrl.replace('{uploadId}', randomUUID()), {
        method: 'PUT',
        headers: { cookie: user.cookie, origin: f.config.origin },
        body: bytes,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.request(new URL(r.human.url).pathname, {
        headers: { cookie: outsider.cookie },
      })
    ).status,
    403,
  );
  const status = await d.status(user.id, r.sessionId);
  assert.deepEqual(
    new Set(status.files.map((x) => x.channel)),
    new Set(['agent', 'human']),
  );
  assert.ok(!JSON.stringify(status).includes(r.agent.authorization));
  assert.equal((await d.get(user.id, created.draftId)).assets, 2);
  await d.revoke(user.id, r.sessionId);
  assert.equal(
    (
      await fetch(r.agent.probe.url, {
        method: 'PUT',
        headers,
        body: Buffer.from([0]),
      })
    ).status,
    403,
  );
  const second = await d.open(user.id, created.draftId, randomUUID());
  await f.pool.query(
    "UPDATE platform_upload_session SET expires_at=now()-interval '1 second' WHERE id=$1",
    [second.sessionId],
  );
  await assert.rejects(
    d.authenticateUpload(second.sessionId, second.agent.authorization.slice(7)),
    /expired/,
  );
});

test('server preview, browser approval security, stale revisions, exact-byte deploy and immutable history', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const user = await f.user('site@example.invalid'),
    outsider = await f.user('other@example.invalid'),
    owner = await f.user('owner@example.invalid'),
    admin = await f.user('admin@example.invalid');
  const saved = await prepare(f, user, undefined, true);
  const sites = f.app.sites;
  await sites.processOne();
  let row = (await sites.status(user.id, saved.siteId)).specs[0];
  assert.equal(row.state, 'verified', JSON.stringify(row));
  assert.equal(deps.counts.verifies, 1);
  const repeated = await sites.drafts.preview(
    user.id,
    saved.draftId,
    saved.revision,
  );
  assert.equal(repeated.specId, saved.specId);
  assert.equal(deps.counts.verifies, 1);
  const deploy = () =>
    sites.deploy(
      user.id,
      saved.siteId,
      saved.specId,
      'fictional-password-12345',
      'DEPLOY_SITE:' + saved.siteId,
    );
  await assert.rejects(deploy(), /approval_required/);
  const path = '/sites/approve/' + saved.specId;
  for (const headers of [
    {},
    { authorization: 'Bearer ' + (await f.token(user)) },
    { cookie: outsider.cookie },
    { cookie: owner.cookie },
  ])
    assert.equal(
      (await f.request(path, { headers })).status,
      headers.cookie || headers.authorization ? 403 : 303,
    );
  const page = await f.request(path, { headers: { cookie: user.cookie } });
  assert.equal(page.status, 200);
  const html = await page.text(),
    csrf = html.match(/name="csrf" value="([^"]+)"/)[1];
  for (const origin of [undefined, 'null', 'https://attacker.example.invalid'])
    assert.equal(
      (
        await f.request(path, {
          method: 'POST',
          headers: { cookie: user.cookie, ...(origin ? { origin } : {}) },
          body: new URLSearchParams({ csrf, action: 'approve' }),
        })
      ).status,
      403,
    );
  assert.equal(
    (
      await f.request(path, {
        method: 'POST',
        headers: { cookie: user.cookie, origin: f.config.origin },
        body: new URLSearchParams({ csrf: 'invalid', action: 'approve' }),
      })
    ).status,
    403,
  );
  const token = html.match(/src="\/p\/([^/]+)\//)[1],
    preview = await f.request('/p/' + token + '/');
  assert.equal(preview.status, 200);
  assert.match(preview.headers.get('content-security-policy'), /sandbox;/);
  assert.ok(!preview.headers.has('set-cookie'));
  assert.equal(await preview.text(), 'Fictional provider test double');
  await sites.administration.admins(owner.id, saved.siteId, 'assign', [
    admin.email,
  ]);
  await approve(f, admin, saved.specId);
  assert.equal(
    (
      await f.request(path, {
        method: 'POST',
        headers: { cookie: user.cookie, origin: f.config.origin },
        body: new URLSearchParams({ csrf, action: 'approve' }),
      })
    ).status,
    403,
  );
  await assert.rejects(
    f.pool.query('DELETE FROM platform_site_approval WHERE spec_id=$1', [
      saved.specId,
    ]),
    /immutable history/,
  );
  await deploy();
  await assert.rejects(
    sites.drafts.apply(user.id, {
      draftId: saved.draftId,
      expectedRevision: saved.revision,
      requestId: randomUUID(),
      operations: [{ op: 'remove-page', pageId: 'about' }],
    }),
    /deployment_busy/,
  );
  await sites.processOne();
  row = (await sites.status(user.id, saved.siteId)).specs[0];
  assert.equal(row.state, 'live', JSON.stringify(row));
  assert.equal(deps.counts.verifies, 1);
  assert.equal(deps.inputs[0].build.report.outputSha256, row.outputSha256);
  assert.equal(deps.inputs[0].clientEmail, user.email);
  await assert.rejects(deploy(), /initial_site_only/);
});

test('editing and reverting content cannot revive approval; failed verification is visible but never approvable', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('stale@example.invalid'),
    sites = f.app.sites,
    saved = await prepare(f, u);
  await sites.processOne();
  await approve(f, u, saved.specId);
  const full = await sites.drafts.get(u.id, saved.draftId, 'full'),
    page = structuredClone(full.content.pages[0]);
  page.seo.title = 'A revised title';
  const first = await sites.drafts.apply(u.id, {
    draftId: saved.draftId,
    expectedRevision: saved.revision,
    requestId: randomUUID(),
    operations: [{ op: 'upsert-page', page }],
  });
  await assert.rejects(
    sites.deploy(
      u.id,
      saved.siteId,
      saved.specId,
      'fictional-password-12345',
      'DEPLOY_SITE:' + saved.siteId,
    ),
    /approval/,
  );
  const reverted = await sites.drafts.apply(u.id, {
    draftId: saved.draftId,
    expectedRevision: first.revision,
    requestId: randomUUID(),
    operations: [{ op: 'upsert-page', page: full.content.pages[0] }],
  });
  const fresh = await sites.drafts.preview(
    u.id,
    saved.draftId,
    reverted.revision,
  );
  assert.notEqual(fresh.specId, saved.specId);
  assert.equal(fresh.state, 'verified');
  assert.equal(deps.counts.verifies, 1);
  await assert.rejects(
    sites.deploy(
      u.id,
      saved.siteId,
      fresh.specId,
      'fictional-password-12345',
      'DEPLOY_SITE:' + saved.siteId,
    ),
    /approval/,
  );
  const newPage = structuredClone(page);
  newPage.seo.title = 'Failure fixture';
  const next = await sites.drafts.apply(u.id, {
    draftId: saved.draftId,
    expectedRevision: reverted.revision,
    requestId: randomUUID(),
    operations: [{ op: 'upsert-page', page: newPage }],
  });
  deps.failVerification(true);
  const bad = await sites.drafts.preview(u.id, saved.draftId, next.revision);
  await sites.processOne();
  const r = (await sites.status(u.id, saved.siteId)).specs[0];
  assert.equal(r.state, 'failed');
  const html = await (
    await f.request('/sites/approve/' + bad.specId, {
      headers: { cookie: u.cookie },
    })
  ).text();
  assert.ok(html.includes('failed'));
  assert.ok(!html.includes('name="action"'));
});

test('draft/upload/verification quotas, expiry, cleanup and revoked approver are enforced', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('quota@example.invalid'),
    d = f.app.sites.drafts;
  for (const slug of ['one', 'two', 'three'])
    await d.create(u.id, slug, randomUUID());
  await assert.rejects(d.create(u.id, 'four', randomUUID()), /draft_quota/);
  const active = (
    await f.pool.query('SELECT * FROM platform_site_draft LIMIT 1')
  ).rows[0];
  await f.pool.query(
    "UPDATE platform_site_draft SET expires_at=now()-interval '1 second' WHERE id=$1",
    [active.id],
  );
  await d.cleanup();
  assert.equal(
    (
      await f.pool.query('SELECT state FROM platform_site_draft WHERE id=$1', [
        active.id,
      ])
    ).rows[0].state,
    'expired',
  );
  const saved = await prepare(f, u, {
    ...(await fixtureSubmission()),
    slug: 'four',
  });
  await f.app.sites.processOne();
  await approve(f, u, saved.specId);
  await f.pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1', [
    u.id,
  ]);
  await assert.rejects(
    f.app.sites.deploy(
      u.id,
      saved.siteId,
      saved.specId,
      'fictional-password-12345',
      'DEPLOY_SITE:' + saved.siteId,
    ),
  );
  await f.pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [
    u.id,
  ]);
  await f.pool.query(
    "INSERT INTO platform_site_quota(owner_id,kind,amount) SELECT $1,'preview',1 FROM generate_series(1,5)",
    [u.id],
  );
  const full = await d.get(u.id, saved.draftId, 'full');
  full.content.pages[0].seo.title = 'Quota changed';
  const updated = await d.apply(u.id, {
    draftId: saved.draftId,
    expectedRevision: saved.revision,
    requestId: randomUUID(),
    operations: [{ op: 'upsert-page', page: full.content.pages[0] }],
  });
  await assert.rejects(
    d.preview(u.id, saved.draftId, updated.revision),
    /preview_quota/,
  );
  await f.pool.query(
    "INSERT INTO platform_site_quota(owner_id,kind,amount) VALUES($1,'upload',$2)",
    [u.id, 200 * 1024 * 1024],
  );
  await assert.rejects(
    d.upload(
      u.id,
      saved.opened.sessionId,
      randomUUID(),
      Buffer.from('bad'),
      'agent',
    ),
    /upload_quota/,
  );
  await f.pool.query(
    "UPDATE platform_site_spec SET expires_at=now()-interval '1 second' WHERE id=$1",
    [saved.specId],
  );
  await d.cleanup();
  assert.ok(
    ![...deps.data.keys()].some((k) =>
      k.startsWith('specs/' + saved.specId + '/'),
    ),
  );
});

test('identical pending snapshots share one admission and verified artifacts but separate approvals', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('pending@example.invalid'),
    input = await fixtureSubmission();
  input.assets = {};
  input.spec.assets = [];
  input.spec.pages = [input.spec.pages[0]];
  input.spec.pages[0].sections = input.spec.pages[0].sections.slice(0, 1);
  delete input.spec.pages[0].sections[0].blocks[0].props.image;
  input.spec.navigation = {
    primary: [{ label: 'Home', pageId: 'home' }],
    footer: [],
  };
  const first = await prepare(f, u, { ...input, slug: 'pending-one' }),
    second = await prepare(f, u, { ...input, slug: 'pending-two' });
  assert.equal(
    (
      await f.pool.query(
        "SELECT count(*)::int AS n FROM platform_site_quota WHERE kind='preview'",
      )
    ).rows[0].n,
    1,
  );
  assert.equal(second.cached, true);
  await Promise.all([f.app.sites.processOne(), f.app.sites.processOne()]);
  await f.app.sites.processOne();
  assert.equal(deps.counts.verifies, 1);
  assert.equal(
    (await f.app.sites.status(u.id, second.siteId)).specs[0].state,
    'verified',
  );
  await approve(f, u, first.specId);
  await assert.rejects(
    f.app.sites.deploy(
      u.id,
      second.siteId,
      second.specId,
      'fictional-password-12345',
      'DEPLOY_SITE:' + second.siteId,
    ),
    /approval_required/,
  );
});

test('artifact tampering fails at approval, admission and worker; edits and approvals serialize', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('integrity@example.invalid'),
    sites = f.app.sites,
    saved = await prepare(f, u);
  await sites.processOne();
  const key = 'specs/' + saved.specId + '/build.json',
    original = deps.data.get(key),
    altered = JSON.parse(original);
  altered.files['index.html'] = Buffer.from('tampered').toString('base64');
  const { sha256, canonicalJson } = await import('@a2aviary/generator');
  altered.report.outputSha256 = sha256(canonicalJson(altered.files));
  deps.data.set(key, Buffer.from(JSON.stringify(altered)));
  await assert.rejects(approve(f, u, saved.specId));
  deps.data.set(key, original);
  await approve(f, u, saved.specId);
  deps.data.set(key, Buffer.from(JSON.stringify(altered)));
  await assert.rejects(
    sites.deploy(
      u.id,
      saved.siteId,
      saved.specId,
      'fictional-password-12345',
      'DEPLOY_SITE:' + saved.siteId,
    ),
    /artifact_integrity/,
  );
  deps.data.set(key, original);
  await sites.deploy(
    u.id,
    saved.siteId,
    saved.specId,
    'fictional-password-12345',
    'DEPLOY_SITE:' + saved.siteId,
  );
  deps.data.set(key, Buffer.from(JSON.stringify(altered)));
  await sites.processOne();
  assert.equal(deps.counts.deploys, 0);
  assert.equal(
    (await sites.status(u.id, saved.siteId)).specs[0].error,
    'artifact_integrity',
  );
});

test('orphan write intents and expired drafts clean once and retain live artifacts and approval history', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('cleanup@example.invalid'),
    sites = f.app.sites,
    saved = await prepare(f, u);
  await sites.processOne();
  await approve(f, u, saved.specId);
  await sites.deploy(
    u.id,
    saved.siteId,
    saved.specId,
    'fictional-password-12345',
    'DEPLOY_SITE:' + saved.siteId,
  );
  await sites.processOne();
  await f.pool.query(
    "UPDATE platform_site_spec SET expires_at=now()-interval '1 second' WHERE id=$1",
    [saved.specId],
  );
  const orphan = 'specs/' + randomUUID() + '/';
  await sites.drafts.trackPrefix(orphan);
  deps.data.set(orphan + 'staging', Buffer.from('fictional'));
  await f.pool.query(
    "UPDATE platform_artifact_prefix SET created_at=now()-interval '2 days' WHERE prefix=$1",
    [orphan],
  );
  await sites.drafts.cleanup();
  await sites.drafts.cleanup();
  assert.ok(!deps.data.has(orphan + 'staging'));
  assert.ok(deps.data.has('specs/' + saved.specId + '/build.json'));
  assert.equal(
    (
      await f.pool.query(
        'SELECT count(*)::int AS n FROM platform_site_approval',
      )
    ).rows[0].n,
    1,
  );
});

test('concurrent raw admission is bounded and failed decodes still consume quota', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('raw-race@example.invalid'),
    d = f.app.sites.drafts,
    created = await d.create(u.id, 'raw-race', randomUUID()),
    opened = await d.open(u.id, created.draftId, randomUUID());
  const results = await Promise.allSettled([
    d.upload(
      u.id,
      opened.sessionId,
      randomUUID(),
      Buffer.from('not an image'),
      'agent',
    ),
    d.upload(
      u.id,
      opened.sessionId,
      randomUUID(),
      Buffer.from('not an image'),
      'agent',
    ),
  ]);
  assert.equal(
    results.filter(
      (r) => r.status === 'rejected' && r.reason.code === 'upload_busy',
    ).length,
    1,
  );
  assert.equal(
    (
      await f.pool.query(
        'SELECT attempts FROM platform_upload_session WHERE id=$1',
        [opened.sessionId],
      )
    ).rows[0].attempts,
    1,
  );
  assert.equal(
    (
      await f.pool.query(
        "SELECT count(*)::int AS n FROM platform_site_quota WHERE kind='upload'",
      )
    ).rows[0].n,
    1,
  );
});

test('removed and rolled-back normalized staging files are cleaned without deleting referenced draft assets', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('staging@example.invalid'),
    d = f.app.sites.drafts,
    saved = await prepare(f, u);
  const full = await d.get(u.id, saved.draftId, 'full'),
    asset = full.content.assets[0],
    key = 'drafts/' + saved.draftId + '/assets/' + asset.id;
  await d.cleanup();
  assert.ok(deps.data.has(key));
  await d.apply(u.id, {
    draftId: saved.draftId,
    expectedRevision: saved.revision,
    requestId: randomUUID(),
    operations: [{ op: 'remove-asset', assetId: asset.id }],
  });
  await d.cleanup();
  assert.ok(!deps.data.has(key));
  assert.ok(deps.data.has('specs/' + saved.specId + '/assets/' + asset.id));
  await d.cleanup();
  assert.ok(
    (
      await f.pool.query(
        'SELECT cleaned_at FROM platform_asset_staging WHERE key=$1',
        [key],
      )
    ).rows[0].cleaned_at,
  );
});

test('upload progress stays within 4 KiB and append order keeps cursors stable', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const u = await f.user('progress@example.invalid'),
    d = f.app.sites.drafts,
    created = await d.create(u.id, 'progress', randomUUID()),
    session = await d.open(u.id, created.draftId, randomUUID()),
    input = await fixtureSubmission(),
    bytes = Buffer.from(Object.values(input.assets)[0], 'base64');
  for (let n = 0; n < 15; n++)
    await d.upload(u.id, session.sessionId, randomUUID(), bytes, 'agent');
  const first = await d.status(u.id, session.sessionId);
  assert.ok(Buffer.byteLength(JSON.stringify(first)) <= 4096);
  assert.ok(first.nextAfter !== null);
  await d.upload(u.id, session.sessionId, randomUUID(), bytes, 'agent');
  const second = await d.status(u.id, session.sessionId, first.nextAfter);
  assert.ok(Buffer.byteLength(JSON.stringify(second)) <= 4096);
  const ids = [...first.files, ...second.files].map((f) => f.uploadId);
  assert.equal(new Set(ids).size, 16);
  assert.equal(second.nextAfter, null);
});

test('change requests always report unavailable, including obsolete and malformed arguments', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const u = await f.user('changes@example.invalid');
  for (const args of [
    {},
    {
      siteId: randomUUID(),
      specId: randomUUID(),
      spec: { contractVersion: '1.0' },
      confirmation: 'obsolete',
    },
    { siteId: 'invalid', specId: 'invalid', test: true },
  ]) {
    const result = await call(f, u, 'change.request', args);
    assert.equal(result.error, 'change_requests_unavailable');
    assert.equal(result.isError, true);
  }
});
