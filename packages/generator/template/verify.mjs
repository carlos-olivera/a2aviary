// This fixed checker runs inside the secret-free Agents API sandbox, before the model turn.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import lighthouse from 'lighthouse';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
const hash = (b) => createHash('sha256').update(b).digest('hex');
const canonical = (v) =>
  Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : v && typeof v === 'object'
      ? '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
          .join(',') +
        '}'
      : JSON.stringify(v);
const input = JSON.parse(await readFile('verification-input.json', 'utf8'));
await mkdir('outputs', { recursive: true });
const report = {
  version: 1,
  sourceSha256: input.sourceSha256,
  specSha256: input.specSha256,
  passed: false,
  checks: [],
  outputSha256: null
};
const check = (name, passed, details) =>
  report.checks.push({ name, passed, details });
let browser, server, previewServer;
try {
  const syntax = ['astro.config.mjs', 'public/cms.js'].map(
    (file) =>
      spawnSync(process.execPath, ['--check', file], { stdio: 'pipe' })
        .status === 0
  );
  check('catalog-syntax', syntax.every(Boolean), { files: syntax.length });
  if (!syntax.every(Boolean)) throw Error('syntax_failed');
  const result = spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build'],
    {
      encoding: 'utf8',
      timeout: 120000,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: 'production',
        ASTRO_TELEMETRY_DISABLED: '1'
      }
    }
  );
  check('astro-build', result.status === 0, { exitCode: result.status });
  if (result.status !== 0) throw Error('build_failed');
  // Public binary inputs are written unchanged. Neither Astro image tools nor OCR are used.
  const root = resolve('dist');
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2'
  };
  const serve =
    (preview = false) =>
    async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        let path = url.pathname;
        if (path.startsWith('/api/cms/')) {
          res.setHeader('content-type', 'application/json');
          return res.end('{"items":[]}');
        }
        const base = preview ? resolve('approved-preview') : root;
        const file = resolve(
          base,
          '.' +
            decodeURIComponent(path) +
            (path.endsWith('/') ? 'index.html' : '')
        );
        if (!file.startsWith(base + sep)) throw Error();
        const bytes = await readFile(file);
        const ext = '.' + file.split('.').at(-1);
        res.setHeader('content-type', types[ext] ?? 'application/octet-stream');
        // Preview HTML cannot run scripts; both surfaces have no outbound network.
        if (preview)
          res.setHeader(
            'content-security-policy',
            "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; script-src 'none'"
          );
        res.end(bytes);
      } catch {
        res.statusCode = 404;
        res.end('Not found');
      }
    };
  server = createServer(serve());
  previewServer = createServer(serve(true));
  await new Promise((r) => previewServer.listen(0, '127.0.0.1', r));
  const previewOrigin = 'http://127.0.0.1:' + previewServer.address().port;
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const reservation = createTcpServer();
  await new Promise((r) => reservation.listen(0, '127.0.0.1', r));
  const chromePort = reservation.address().port;
  await new Promise((r) => reservation.close(r));
  browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--remote-debugging-port=' + chromePort]
  });
  const context = await browser.newContext();
  await context.route('**/*', (r) =>
    [origin, previewOrigin].includes(new URL(r.request().url()).origin)
      ? r.continue()
      : r.abort()
  );
  const page = await context.newPage();
  for (const path of input.paths) {
    await page.goto(origin + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const violations = (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations;
    check('a11y:' + path, violations.length === 0, {
      rules: violations.map((v) => v.id)
    });
    const refs = await page
      .locator('a[href],img[src],link[href],script[src]')
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          url: n.href ?? n.src,
          href: n.getAttribute('href')
        }))
      );
    let broken = 0;
    for (const ref of refs) {
      const u = new URL(ref.url);
      if (u.origin !== origin) continue;
      const response = await context.request.get(u.href);
      if (!response.ok()) broken++;
      if (u.hash) {
        const target = await context.newPage();
        await target.goto(u.origin + u.pathname);
        if (
          !(await target
            .locator(
              '[id=' + JSON.stringify(decodeURIComponent(u.hash.slice(1))) + ']'
            )
            .count())
        )
          broken++;
        await target.close();
      }
    }
    check('links:' + path, broken === 0, { broken });
    const lh = await lighthouse(origin + path, {
      port: chromePort,
      output: 'json',
      onlyCategories: ['accessibility', 'best-practices'],
      logLevel: 'error'
    });
    const accessibility = lh.lhr.categories.accessibility.score;
    check('lighthouse:' + path, accessibility >= 0.9, {
      accessibility,
      bestPractices: lh.lhr.categories['best-practices'].score
    });
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const actual = PNG.sync.read(await page.screenshot({ fullPage: true }));
      await page.goto(previewOrigin + path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const approved = PNG.sync.read(await page.screenshot({ fullPage: true }));
      const sameSize =
        actual.width === approved.width && actual.height === approved.height;
      const diff = new PNG({ width: actual.width, height: actual.height });
      const pixels = sameSize
        ? pixelmatch(
            actual.data,
            approved.data,
            diff.data,
            actual.width,
            actual.height,
            { threshold: 0.1 }
          )
        : actual.width * actual.height;
      const ratio = pixels / (actual.width * actual.height);
      const id = hash(path).slice(0, 12) + '-' + width;
      await writeFile('outputs/' + id + '-actual.png', PNG.sync.write(actual));
      await writeFile(
        'outputs/' + id + '-approved.png',
        PNG.sync.write(approved)
      );
      await writeFile('outputs/' + id + '-diff.png', PNG.sync.write(diff));
      check('visual:' + path + ':' + width, sameSize && ratio <= 0.001, {
        sameSize,
        differenceRatio: ratio
      });
    }
  }
  const files = {};
  async function visit(dir, prefix = '') {
    for (const e of (await readdir(dir, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (e.isSymbolicLink()) throw Error('symlink');
      const name = prefix + e.name;
      if (e.isDirectory()) await visit(resolve(dir, e.name), name + '/');
      else
        files[name] = (await readFile(resolve(dir, e.name))).toString('base64');
    }
  }
  await visit(root);
  report.outputSha256 = hash(canonical(files));
  await writeFile(
    'outputs/site.json',
    canonical({ files, outputSha256: report.outputSha256 })
  );
  report.passed =
    report.checks.length > 0 && report.checks.every((c) => c.passed);
} catch {
  check('verification-complete', false, { error: 'verification_failed' });
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((r) => server.close(r));
  if (previewServer) await new Promise((r) => previewServer.close(r));
  await writeFile(
    'outputs/report.json',
    JSON.stringify(report, null, 2) + '\n'
  );
}
if (!report.passed) process.exitCode = 1;
