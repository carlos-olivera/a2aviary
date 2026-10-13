import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { call, prepare } from './draft-fixture.mjs';
import {
  composition,
  compositionNames,
} from '@a2aviary/site-core/fixtures/presentation';
import { profileComposition } from '../../../packages/site-core/fixtures/starters/profile.mjs';
import { fixtureSubmission } from '@a2aviary/site-core/fixtures/catalog';

for (const name of [...compositionNames, 'catalog', 'profile'])
  test('quick preview renders without verifier: ' + name, async (t) => {
    const deps = testDependencies(),
      f = await fixture(deps);
    t.after(f.close);
    const user = await f.user('tester@example.invalid');
    const input =
      name === 'catalog'
        ? await fixtureSubmission()
        : name === 'profile'
          ? await profileComposition('light-es')
          : await composition(name);
    const saved = await prepare(
      f,
      user,
      input,
      true,
      () => {},
      name === 'profile' ? { id: 'profile' } : undefined,
      'site.preview.quick',
    );
    assert.equal(saved.verified, false);
    assert.equal(saved.test, true);
    assert.deepEqual(saved.blockers, []);
    assert.deepEqual(
      saved.suggestions,
      (await f.app.sites.drafts.get(user.id, saved.draftId)).suggestions,
    );
    assert.equal(deps.counts.verifies, 0);
    for (const table of [
      'platform_site_spec',
      'platform_site_job',
      'platform_site_approval',
    ])
      assert.equal(
        (await f.pool.query('SELECT count(*)::int AS n FROM ' + table)).rows[0]
          .n,
        0,
      );
    assert.deepEqual(
      (
        await f.pool.query(
          "SELECT kind FROM platform_site_quota WHERE kind IN ('preview','quick')",
        )
      ).rows,
      [{ kind: 'quick' }],
    );
    const path = new URL(saved.previewUrl).pathname;
    const wrapper = await f.request(path, {
      headers: { cookie: 'fictional-irrelevant-cookie=1' },
    });
    assert.equal(wrapper.status, 200);
    assert.match(await wrapper.text(), /Unverified preview/);
    for (const p of input.spec.pages) {
      const response = await f.request(path + '/files' + p.path);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert(!html.includes('<script'));
      assert(!html.includes('Unverified preview')); // platform chrome never contaminates owner content
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
      assert.equal(response.headers.get('set-cookie'), null);
      assert.match(
        response.headers.get('content-security-policy'),
        /^sandbox;/,
      );
    }
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ reducedMotion: 'reduce' });
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(saved.previewUrl);
        const frame = page.frames().find((f) => f.url().includes('/files/'));
        assert(frame);
        await frame.evaluate(() => document.fonts.ready);
        assert.equal(
          await frame.evaluate(() => getComputedStyle(document.body).margin),
          '0px',
        );
        for (const img of await frame.locator('img').all()) {
          await img.evaluate(async (el) => { el.loading = 'eager'; await el.decode(); });
          assert(await img.evaluate((el) => el.naturalWidth > 0));
        }
      }
    } finally {
      await browser.close();
    }
    const approval = await f.request('/sites/approve/' + saved.quickPreviewId, {
      headers: { cookie: user.cookie },
    });
    assert.equal(approval.status, 403);
    assert.equal((await approval.json()).error, 'snapshot_not_found');
    const approvalPost = await f.request(
      '/sites/approve/' + saved.quickPreviewId,
      {
        method: 'POST',
        headers: { cookie: user.cookie, origin: f.config.origin },
        body: 'action=approve&csrf=fictional',
      },
    );
    assert.equal(approvalPost.status, 403);
    const deploy = await call(f, user, 'site.deploy', {
      siteId: saved.siteId,
      specId: saved.quickPreviewId,
      cmsPassword: 'fictional-password-12345',
      confirmation: 'DEPLOY_SITE:' + saved.siteId,
    });
    assert(deploy.isError);
    assert.equal(deps.counts.deploys, 0);
    const events = (
      await f.pool.query(
        "SELECT details FROM platform_audit WHERE details->>'tool'='site.preview.quick'",
      )
    ).rows;
    assert(events.length);
    assert(events.every((e) => e.details.test === true));
  });

test('quick tokens, owner, revisions, discard and expired retention fail closed; full verification still needed', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const user = await f.user('tester@example.invalid'),
    other = await f.user('other@example.invalid');
  const saved = await prepare(
    f,
    user,
    await composition('dark-en'),
    false,
    () => {},
    undefined,
    'site.preview.quick',
  );
  const drafts = f.app.sites.drafts,
    path = new URL(saved.previewUrl).pathname,
    token = path.split('/')[2];
  await assert.rejects(
    drafts.quick.create(other.id, saved.draftId, saved.revision),
  );
  await assert.rejects(
    drafts.quick.create(user.id, saved.draftId, saved.revision - 1),
    /revision_conflict/,
  );
  assert.equal(
    (await f.request(path.slice(0, -1) + (path.endsWith('a') ? 'b' : 'a')))
      .status,
    403,
  );
  const value = saved.quickPreviewId + '.' + Math.floor(Date.now() / 1000 - 1);
  assert.equal(
    (
      await f.request(
        '/q/' + value + '.' + drafts.mac('quick-preview-v1', value),
      )
    ).status,
    403,
  );
  assert.equal((await f.request('/p/' + token + '/')).status, 403); // domain-separated MAC
  const full = await drafts.preview(user.id, saved.draftId, saved.revision);
  assert.equal(full.cached, false);
  assert.equal(full.state, 'queued');
  assert.equal(
    (
      await f.pool.query(
        "SELECT count(*)::int AS n FROM platform_site_quota WHERE kind='preview'",
      )
    ).rows[0].n,
    1,
  );
  await drafts.apply(user.id, {
    draftId: saved.draftId,
    expectedRevision: saved.revision,
    requestId: randomUUID(),
    operations: [
      {
        op: 'settings',
        settings: {
          tokens: {
            ...(await drafts.get(user.id, saved.draftId, 'full')).content
              .tokens,
            radius: 4,
          },
        },
      },
    ],
  });
  assert.equal((await f.request(path)).status, 403);
  const current = await drafts.get(user.id, saved.draftId);
  const next = await drafts.quick.create(
    user.id,
    saved.draftId,
    current.revision,
  );
  await drafts.discard(user.id, saved.draftId, current.revision);
  assert.equal(
    (await f.request(new URL(next.previewUrl).pathname)).status,
    403,
  );
  await assert.rejects(
    drafts.quick.create(user.id, saved.draftId, current.revision),
    /draft_expired/,
  );
});

test('blank and starter share completeness blockers; independent daily/burst quotas count failures', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('tester@example.invalid');
  const drafts = f.app.sites.drafts;
  for (const starter of [undefined, { id: 'profile' }]) {
    const d = await drafts.create(
      user.id,
      'fictional-' + randomUUID(),
      randomUUID(),
      starter,
    );
    let full, quick;
    try {
      await drafts.preview(user.id, d.draftId, 0);
    } catch (e) {
      full = e;
    }
    try {
      await drafts.quick.create(user.id, d.draftId, 0);
    } catch (e) {
      quick = e;
    }
    assert.equal(quick.code, 'draft_incomplete');
    assert.deepEqual(quick.errors, full.errors);
    await drafts.discard(user.id, d.draftId, 0);
  }
  const saved = await prepare(
    f,
    user,
    await composition('dark-en'),
    false,
    () => {},
    undefined,
    'site.preview.quick',
  );
  const attempt = () =>
    drafts.quick.create(user.id, saved.draftId, saved.revision);
  const seed = async (n, owner, age) => {
    await f.pool.query("DELETE FROM platform_site_quota WHERE kind='quick'");
    await f.pool.query(
      "INSERT INTO platform_site_quota(owner_id,kind,amount,created_at) SELECT $1,'quick',1,now()-$3::interval FROM generate_series(1,$2)",
      [owner, n, age],
    );
  };
  await seed(60, user.id, '2 hours');
  await assert.rejects(attempt(), /quick_preview_quota/);
  const other = await f.user('other@example.invalid');
  await seed(300, other.id, '2 hours');
  await assert.rejects(attempt(), /quick_preview_quota/);
  await seed(10, user.id, '0 seconds');
  await assert.rejects(attempt(), /quick_preview_quota/);
  await seed(30, other.id, '0 seconds');
  await assert.rejects(attempt(), /quick_preview_quota/);
  await seed(0, user.id, '0 seconds');
  const get = f.app.sites.objects.get;
  f.app.sites.objects.get = async () => {
    throw Error('fictional storage failure');
  };
  await assert.rejects(attempt());
  f.app.sites.objects.get = get;
  assert.equal(
    (
      await f.pool.query(
        "SELECT count(*)::int AS n FROM platform_site_quota WHERE kind='quick'",
      )
    ).rows[0].n,
    1,
  );
  const lease = await f.pool.connect();
  await lease.query(
    "SELECT pg_advisory_lock(hashtext('quick-preview-execution'))",
  );
  await assert.rejects(attempt(), /quick_preview_busy/);
  await lease.query(
    "SELECT pg_advisory_unlock(hashtext('quick-preview-execution'))",
  );
  lease.release();
  const next = await attempt();
  assert.equal(
    (await f.request(new URL(saved.previewUrl).pathname)).status,
    403,
  ); // replaced, never reused
  drafts.quick.entries.get(next.quickPreviewId).expires = Date.now() - 1;
  assert.equal(
    (await f.request(new URL(next.previewUrl).pathname)).status,
    403,
  );
});

test('browser: chosen sandbox blocks scripts, cookies, outbound fetch/images, forms and top navigation', async (t) => {
  const f = await fixture(testDependencies());
  t.after(f.close);
  const user = await f.user('tester@example.invalid');
  const saved = await prepare(
    f,
    user,
    await composition('dark-en'),
    false,
    () => {},
    undefined,
    'site.preview.quick',
  );
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.addCookies([
    { name: 'platform-secret', value: 'fictional', url: f.config.origin },
  ]);
  const page = await context.newPage(),
    requests = [];
  const originalFetch = f.app.fetch;
  f.app.fetch = async (request) => {
    requests.push(request.url);
    return originalFetch(request);
  };
  // Deliberately inject active HTML into the isolated test-only artifact store to exercise headers beyond trusted rendering.
  const entry = f.app.sites.drafts.quick.entries.get(saved.quickPreviewId);
  entry.files['probe.html'] = Buffer.from(
    `<script>window.ran=true;fetch('/escape');top.location='/escape';document.cookie='stolen=1';</script><img src="/escape-image"><form action="/escape-form"><button>submit</button></form><a target="_top" href="/escape-top">escape</a>`,
  ).toString('base64');
  entry.pages.push({ path: '/probe.html', title: 'Fictional isolation probe' });
  await page.goto(
    saved.previewUrl + '?page=' + encodeURIComponent('/probe.html'),
  );
  const frame = page.frames().find((f) => f.url().includes('/files/'));
  assert(frame);
  assert.equal(await frame.evaluate(() => window.ran), undefined);
  assert.equal(
    await frame.evaluate(() => {
      try {
        return document.cookie;
      } catch {
        return 'blocked';
      }
    }),
    'blocked',
  );
  assert.equal(
    await frame.evaluate(async () => {
      try {
        await fetch('/escape-fetch');
        return 'allowed';
      } catch {
        return 'blocked';
      }
    }),
    'blocked',
  );
  await frame.locator('button').click();
  await frame.locator('a').click();
  assert.equal(
    page.url(),
    saved.previewUrl + '?page=' + encodeURIComponent('/probe.html'),
  );
  assert(!requests.some((u) => new URL(u).pathname.startsWith('/escape')));
  await page.goto(saved.previewUrl + '/files/probe.html');
  assert.equal(
    await page.evaluate(() => {
      try {
        return document.cookie;
      } catch {
        return 'blocked';
      }
    }),
    'blocked',
  );
  assert.equal(await page.evaluate(() => window.ran), undefined);
});

test('candidate allow-scripts sandbox is rejected: opaque origin still allows scripted frame navigation and network', async (t) => {
  const { createServer } = await import('node:http');
  const arrivals = [];
  const server = createServer((req, res) => {
    arrivals.push(req.url);
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      res.end('<iframe sandbox="allow-scripts" src="/candidate"></iframe>');
      return;
    }
    if (req.url === '/candidate') {
      res.setHeader('content-type', 'text/html');
      res.setHeader(
        'content-security-policy',
        "sandbox allow-scripts; default-src 'none'; script-src 'nonce-fictional'; connect-src 'none'; form-action 'none'; base-uri 'none'",
      );
      res.end(
        `<button id="navigate">test</button><script nonce="fictional">try{document.body.dataset.cookies=document.cookie}catch{document.body.dataset.cookies='blocked'};fetch('/fetch-escape').catch(()=>{document.body.dataset.fetch='blocked'});document.querySelector('button').onclick=()=>{if(top!==self){try{top.location='/top-escape'}catch{}};location.href='/navigation-escape'}</script>`,
      );
      return;
    }
    res.end('Fictional navigation endpoint');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(origin);
  const frame = page.frames()[1];
  await frame.waitForFunction(() => document.body.dataset.fetch === 'blocked');
  assert.equal(
    await frame.evaluate(() => document.body.dataset.cookies),
    'blocked',
  );
  await Promise.all([
    frame.waitForURL('**/navigation-escape'),
    frame.locator('button').click(),
  ]);
  assert.equal(page.url(), origin + '/');
  assert(!arrivals.includes('/fetch-escape'));
  assert(!arrivals.includes('/top-escape'));
  assert(arrivals.includes('/navigation-escape')); // connect-src cannot enforce a no-network guarantee for scripts
  // Even if the platform wrapper restricts frame-src, direct opening has no parent CSP.
  arrivals.length = 0;
  await page.goto(origin + '/candidate');
  assert.equal(
    await page.evaluate(() => document.body.dataset.cookies),
    'blocked',
  );
  await Promise.all([
    page.waitForURL('**/navigation-escape'),
    page.locator('button').click(),
  ]);
  assert(arrivals.includes('/navigation-escape'));
});

test('quick rendering holds no verification slot and rechecks edits before returning a URL', async (t) => {
  const deps = testDependencies(),
    f = await fixture(deps);
  t.after(f.close);
  const user = await f.user('tester@example.invalid');
  const saved = await prepare(f, user, await composition('dark-en'));
  const drafts = f.app.sites.drafts,
    objects = f.app.sites.objects,
    originalGet = objects.get.bind(objects);
  let release, entered;
  const ready = new Promise((r) => (entered = r)),
    hold = new Promise((r) => (release = r));
  let first = true;
  objects.get = async (key) => {
    if (first && key.startsWith('drafts/')) {
      first = false;
      entered();
      await hold;
    }
    return originalGet(key);
  };
  const pending = drafts.quick.create(user.id, saved.draftId, saved.revision);
  const rejected = assert.rejects(pending, /revision_conflict/);
  await ready;
  assert.equal(await f.app.sites.processOne(), true);
  assert.equal(deps.counts.verifies, 1);
  const full = await drafts.get(user.id, saved.draftId, 'full');
  await drafts.apply(user.id, {
    draftId: saved.draftId,
    expectedRevision: saved.revision,
    requestId: randomUUID(),
    operations: [
      {
        op: 'settings',
        settings: { tokens: { ...full.content.tokens, radius: 4 } },
      },
    ],
  });
  release();
  await rejected;
  assert.equal(drafts.quick.entries.size, 0);
});
