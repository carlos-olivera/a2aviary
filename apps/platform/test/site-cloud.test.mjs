import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { siteRuntime, AgentsVerifier, sha256 } from '@a2aviary/generator';
import { fixture } from './helpers.mjs';
import { prepare, call } from './draft-fixture.mjs';
import { cleanupFixture } from './cloud-fixture-cleanup.mjs';
const require = createRequire(
  new URL('../../../packages/generator/package.json', import.meta.url),
);
const { chromium } = require('playwright');
test(
  'one hosted tester fixture: real MCP drafts/upload → hosted verification → browser approval → isolated deployment/CMS → one teardown',
  { skip: process.env.RUN_SITE_CLOUD_E2E !== 'true', timeout: 3600000 },
  async (t) => {
    assert.equal(process.env.SITE_DEPLOY_ENVIRONMENT, 'fixture');
    assert.equal(process.env.SITE_DRAFTS_ENABLED, 'true');
    assert.equal(process.env.RUN_TESTER_CLOUD_E2E, 'true');
    const events = [],
      runtime = siteRuntime(process.env);
    assert.ok(runtime);
    runtime.verifier = new AgentsVerifier(runtime.verifier.client, (event) =>
      events.push(event),
    );
    const f = await fixture(runtime),
      sites = f.app.sites;
    let owner,
      saved,
      resources = {},
      usage = {
        status: 'unavailable',
        amount: null,
        reason: 'fixture_not_deployed',
      },
      browser,
      stage = 'identity',
      passed = false;
    t.after(async () => {
      try {
        if (browser) await browser.close();
        const prefixes = saved
          ? [
              'drafts/' + saved.draftId + '/',
              ...(saved.specId ? ['specs/' + saved.specId + '/'] : []),
            ]
          : [];
        const approvals = saved
          ? (
              await f.pool.query(
                'SELECT count(*)::int AS n FROM platform_site_approval WHERE spec_id=$1',
                [saved.specId],
              )
            ).rows[0].n
          : 0;
        const cleanup = await cleanupFixture({
          enabled: true,
          saved,
          owner,
          sites,
          resetVerified: false,
        });
        const leftovers = saved
          ? (
              await f.pool.query(
                'SELECT resources,lifecycle FROM platform_site WHERE id=$1',
                [saved.siteId],
              )
            ).rows[0]
          : null;
        const retainedApprovals = saved
          ? (
              await f.pool.query(
                'SELECT count(*)::int AS n FROM platform_site_approval WHERE spec_id=$1',
                [saved.specId],
              )
            ).rows[0].n
          : 0;
        const bucketInventory = [];
        for (const prefix of prefixes) {
          try {
            const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
            const r = await runtime.objects.client.send(
              new ListObjectsV2Command({
                Bucket: runtime.objects.bucket,
                Prefix: prefix,
                MaxKeys: 1000,
              }),
            );
            bucketInventory.push({
              prefix,
              remainingObjects: r.KeyCount ?? 0,
              truncated: r.IsTruncated ?? false,
              status: 'available',
            });
          } catch {
            bucketInventory.push({
              prefix,
              status: 'unavailable',
              errorCode: 'fixture_inventory_failed',
            });
          }
        }
        await mkdir(new URL('../../../.local/', import.meta.url), {
          recursive: true,
        });
        await writeFile(
          new URL(
            '../../../.local/server-drafts-hosted-evidence.json',
            import.meta.url,
          ),
          JSON.stringify(
            {
              createdAt: new Date().toISOString(),
              passed,
              stage,
              siteId: saved?.siteId,
              specId: saved?.specId,
              test: true,
              fictionalBrowserSession: true,
              realGoogleAuthenticationVerified: false,
              providerEvents: events,
              resources,
              railwayUsage: usage,
              openaiBilling: {
                status: 'unavailable',
                amount: null,
                reason:
                  'Agents token events do not supply billed currency amounts',
              },
              cleanup,
              leftovers,
              bucketInventory,
              retainedApprovals,
              approvalsBeforeReset: approvals,
              credentialsLogged: false,
              variableNamesRead: JSON.parse(
                process.env.FIXTURE_VARIABLE_NAMES ?? '[]',
              ),
            },
            null,
            2,
          ) + '\n',
        );
        if (!passed) return;
        assert.equal(
          cleanup.resetVerified,
          true,
          'One tester teardown must finish',
        );
        assert.ok(
          bucketInventory.every(
            (p) => p.remainingObjects === 0 && !p.truncated,
          ),
        );
      } finally {
        runtime.objects.client.destroy();
        await f.close();
      }
    });
    owner = await f.user('owner@example.invalid');
    const user = await f.user('fixture-owner@example.invalid');
    await f.app.store.tester(owner.id, 'testers.add', user.email);
    stage = 'draft/upload/preview';
    saved = await prepare(f, user, undefined, true, (created) => {
      saved = created;
    });
    stage = 'hosted-verification';
    await sites.processOne();
    const status = await call(f, user, 'site.status', { siteId: saved.siteId });
    assert.equal(status.specs[0].state, 'verified');
    assert.ok(events.some((e) => e.event === 'agents.cleanup.deleted'));
    assert.ok(!events.some((e) => e.event === 'agents.cleanup.pending'));
    const row = (
        await f.pool.query('SELECT * FROM platform_site_spec WHERE id=$1', [
          saved.specId,
        ])
      ).rows[0],
      build = await sites.readVerifiedBuild(row);
    stage = 'browser-preview/approval';
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const cookie = user.cookie.split('=');
    await context.addCookies([
      {
        name: cookie[0],
        value: cookie.slice(1).join('='),
        url: f.config.origin,
      },
    ]);
    const page = await context.newPage();
    await page.goto(f.config.origin + '/sites/approve/' + saved.specId, {
      waitUntil: 'networkidle',
    });
    assert.equal(await page.locator('iframe[sandbox]').count(), 1);
    assert.equal(await page.locator('figure img').count(), 2);
    const frame = page.frames().find((frame) => frame.url().includes('/p/'));
    assert.ok(frame);
    assert.equal(await frame.locator('h1').count(), 1);
    assert.ok(
      await frame.evaluate(() =>
        getComputedStyle(document.body).fontFamily.includes('Inter'),
      ),
    );
    assert.equal(
      await frame
        .locator('img')
        .evaluateAll((images) =>
          images.every((image) => image.complete && image.naturalWidth > 0),
        ),
      true,
    );
    await page.getByRole('button', { name: 'Approve this snapshot' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok((await page.locator('body').innerText()).includes('approved'));
    stage = 'deployment';
    const password = 'fictional-' + randomBytes(24).toString('hex');
    const admission = await call(f, user, 'site.deploy', {
      siteId: saved.siteId,
      specId: saved.specId,
      cmsPassword: password,
      confirmation: 'DEPLOY_SITE:' + saved.siteId,
    });
    assert.equal(admission.isError, false);
    await sites.processOne();
    const live = await call(f, user, 'site.status', { siteId: saved.siteId });
    assert.equal(live.specs[0].state, 'live');
    assert.equal(live.test, true);
    assert.match(
      new URL(live.siteUrl).hostname,
      /^[a-z0-9-]+\.up\.railway\.app$/,
    );
    resources = (
      await f.pool.query('SELECT resources FROM platform_site WHERE id=$1', [
        saved.siteId,
      ])
    ).rows[0].resources;
    stage = 'web/CMS';
    const response = await fetch(live.siteUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200);
    assert.equal(
      sha256(new Uint8Array(await response.arrayBuffer())),
      sha256(Buffer.from(build.files['index.html'], 'base64')),
    );
    const cms = await fetch(
      live.siteUrl + '/api/cms/api/collections/editors/auth-with-password',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identity: user.email, password }),
        signal: AbortSignal.timeout(30000),
      },
    );
    assert.equal(cms.status, 200);
    const credentials = await cms.json();
    const record = await fetch(
      live.siteUrl + '/api/cms/api/collections/catalog/records',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: credentials.token,
        },
        body: JSON.stringify({
          title: 'Fictional smoke content',
          body: 'Fictional test record',
          published: true,
        }),
        signal: AbortSignal.timeout(30000),
      },
    );
    assert.equal(record.status, 200);
    usage = await runtime.deployer.usage(
      resources,
      'cli-' +
        String(
          (
            await f.pool.query('SELECT number FROM platform_site WHERE id=$1', [
              saved.siteId,
            ])
          ).rows[0].number,
        ).padStart(3, '0') +
        '-' +
        (
          await f.pool.query('SELECT slug FROM platform_site WHERE id=$1', [
            saved.siteId,
          ])
        ).rows[0].slug,
      new Date().toISOString().slice(0, 7),
      true,
    );
    stage = 'completed';
    passed = true;
  },
);
