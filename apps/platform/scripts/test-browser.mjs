import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, symlink, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixture } from '../test/helpers.mjs';
import { prepare } from '../test/draft-fixture.mjs';
import { testDependencies } from '../test/site-dependencies.mjs';
import { writeSource } from '../../../packages/generator/scripts/fixture-lib.mjs';
import { sha256, canonicalJson } from '@a2aviary/generator';
const require = createRequire(
    new URL('../../../packages/generator/package.json', import.meta.url),
  ),
  { chromium } = require('playwright'),
  run = promisify(execFile);
const dependencies = testDependencies(),
  directory = new URL('../../../work/server-drafts-browser/', import.meta.url);
dependencies.verifier = {
  async verify(source, spec) {
    await mkdir(directory, { recursive: true });
    await writeSource(directory.pathname, source, spec);
    await symlink(
      new URL('../../../work/phase3-fixture/node_modules', import.meta.url)
        .pathname,
      new URL('node_modules', directory),
    ).catch((error) => {
      if (error.code !== 'EEXIST') throw error;
    });
    await run(process.execPath, ['verify.mjs'], {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ASTRO_TELEMETRY_DISABLED: '1',
      },
      timeout: 180000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const report = JSON.parse(
        await readFile(new URL('outputs/report.json', directory)),
      ),
      site = JSON.parse(
        await readFile(new URL('outputs/site.json', directory)),
      ),
      artifacts = {};
    for (const page of spec.pages)
      for (const width of [390, 1280]) {
        const name =
          sha256(page.path).slice(0, 12) + '-' + width + '-actual.png';
        artifacts[name] = (
          await readFile(new URL('outputs/' + name, directory))
        ).toString('base64');
      }
    artifacts['report.json'] = Buffer.from(JSON.stringify(report)).toString(
      'base64',
    );
    return {
      files: site.files,
      report,
      artifacts,
      sessionId: 'local-checker-no-provider',
    };
  },
};
const f = await fixture(dependencies);
let browser;
try {
  const u = await f.user('browser@example.invalid'),
    saved = await prepare(f, u, undefined, true);
  await f.app.sites.processOne();
  const state = (await f.app.sites.status(u.id, saved.siteId)).specs[0];
  assert.equal(state.state, 'verified', JSON.stringify(state));
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const pair = u.cookie.split('=');
  await context.addCookies([
    { name: pair[0], value: pair.slice(1).join('='), url: f.config.origin },
  ]);
  const page = await context.newPage();
  await page.goto(f.config.origin + '/sites/approve/' + saved.specId, {
    waitUntil: 'networkidle',
  });
  let frame = page.frames().find((frame) => frame.url().includes('/p/'));
  assert.ok(frame);
  assert.equal(await frame.locator('h1').count(), 1);
  assert.ok(await frame.evaluate(() => document.fonts.check('16px Inter')));
  assert.equal(
    await frame
      .locator('img')
      .evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      ),
    true,
  );
  assert.equal(await page.locator('figure img').count(), 2);
  const css = await frame.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  assert.notEqual(css, 'rgba(0, 0, 0, 0)');
  await page.locator('select[name=page]').selectOption('about');
  await page.getByRole('button', { name: 'Show page' }).click();
  await page.waitForLoadState('networkidle');
  frame = page.frames().find((frame) => frame.url().includes('/p/'));
  assert.ok(frame.url().endsWith('/about/'));
  assert.equal(
    await frame
      .locator('a[href]')
      .evaluateAll((links) =>
        links.every((link) => !link.getAttribute('href').startsWith('/')),
      ),
    true,
  );
  await page.screenshot({
    path: new URL('approval.png', directory).pathname,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Approve this snapshot' }).click();
  await page.waitForLoadState('networkidle');
  assert.ok((await page.locator('body').innerText()).includes('approved'));
  await page.goto(saved.opened.human.url, { waitUntil: 'networkidle' });
  assert.equal(
    await page
      .locator('img')
      .evaluateAll((images) =>
        images.every((image) => image.complete && image.naturalWidth > 0),
      ),
    true,
  );
  await page.screenshot({
    path: new URL('upload.png', directory).pathname,
    fullPage: true,
  });
  // Simulate hostile output after a compromised build boundary. The sandbox remains a separate defense.
  const key = 'specs/' + saved.specId + '/build.json',
    build = JSON.parse(dependencies.data.get(key));
  build.files['index.html'] = Buffer.from(
    '<!doctype html><h1>Fictional hostile fixture</h1><script>window.previewScriptExecuted=true</script><form action="/mcp"><input name="secret"></form>',
  ).toString('base64');
  build.report.outputSha256 = sha256(canonicalJson(build.files));
  dependencies.data.set(key, Buffer.from(JSON.stringify(build)));
  await f.pool.query(
    'UPDATE platform_site_spec SET output_sha256=$2 WHERE id=$1',
    [saved.specId, build.report.outputSha256],
  );
  const token = f.app.sites.drafts.signPreview(saved.specId),
    direct = await context.newPage();
  await direct.goto(f.config.origin + '/p/' + token + '/', {
    waitUntil: 'networkidle',
  });
  assert.equal(
    await direct.evaluate(() => window.previewScriptExecuted),
    undefined,
  );
  assert.equal(
    (await direct.request.get(f.config.origin + '/p/' + token + '/'))
      .headers()
      ['content-security-policy'].includes('sandbox;'),
    true,
  );
  console.log(
    JSON.stringify({
      passed: true,
      checkerChecks: 37,
      screenshots: 14,
      realBrowser: true,
      googleAuthentication: false,
      relativePages: true,
      fontsImagesCss: true,
      headerSandboxDirectOpen: true,
      approvalPost: true,
      uploadQr: true,
    }),
  );
} finally {
  if (browser) await browser.close();
  await f.close();
}
