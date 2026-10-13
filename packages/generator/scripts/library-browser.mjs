import { checkPresentationBrowser } from './presentation-browser.mjs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { renderPage, css } from '../src/render.ts';
import {
  behaviorBundle,
  fontPackages,
} from '@a2aviary/site-core';
import { validateSiteSpec } from '@a2aviary/site-core';
import { runtimeFixture } from '../test/fixtures/library-runtime/fixture.mjs';
export async function checkLibraryBrowser(root, production, compiler) {
  const fixture = await runtimeFixture(root, compiler),
    report = [];
  let browser,
    server,
    complete = false;
  const out = join(root, '.local/library-check');
  await mkdir(out, { recursive: true });
  try {
    const baseline = JSON.parse(
      await readFile(
        join(root, 'contracts/site/2.3.0/examples/site-spec.json'),
      ),
    );
    const variants = Object.values(fixture.catalog).filter(
        (p) => p.type === 'variant',
      ),
      effects = Object.values(fixture.catalog).filter(
        (p) => p.type === 'effect',
      );
    const cases = variants.flatMap((v) =>
      v.fixtures.map((block, index) => ({
        id: v.id,
        fixtureIndex: index,
        block,
      })),
    );
    for (const fx of effects)
      for (const [index, f] of fx.fixtures.entries()) {
        const v = fixture.catalog[f.component + ':' + f.variant];
        cases.push({
          id: fx.id,
          fixtureIndex: index,
          block: structuredClone(v.fixture),
          effect: fx,
        });
      }
    let resources = {};
    server = createServer((req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path.startsWith('/api/cms/')) {
        res.setHeader('content-type', 'application/json');
        res.end('{"items":[]}');
        return;
      }
      const data = resources[path];
      if (!data) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader(
        'content-type',
        path.endsWith('.css')
          ? 'text/css'
          : path.endsWith('.js')
            ? 'text/javascript'
            : path.endsWith('.woff2')
              ? 'font/woff2'
              : path.endsWith('.webp')
                ? 'image/webp'
                : 'text/html',
      );
      res.end(data);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const origin = 'http://127.0.0.1:' + server.address().port;
    browser = await chromium.launch({ headless: true });
    for (const entry of cases) {
      const spec = structuredClone(baseline);
      spec.pages = [
        {
          id: 'home',
          path: '/',
          seo: {
            title: 'Fictional library fixture',
            description: 'Fictional local package verification.',
          },
          sections: [
            { id: 'fixture-section', blocks: [structuredClone(entry.block)] },
          ],
        },
      ];
      // Fixture references use existing authored IDs; retain additional pages as link targets.
      const seen = new Set(['home']);
      for (const p of baseline.pages)
        if (!seen.has(p.id)) {
          spec.pages.push(p);
          seen.add(p.id);
        }
      if (entry.effect) {
        if (entry.effect.target === 'section') {
          spec.pages[0].sections[0].effects = [entry.effect.id];
          spec.tokens.layout = 'flush';
        } else spec.pages[0].sections[0].blocks[0].effects = [entry.effect.id];
      }
      if (entry.id === 'hero:interactive')
        spec.pages[0].sections[0].blocks.push(
          structuredClone(fixture.catalog['hero:failing'].fixture),
        );
      spec.shell = {
        skipLink: 'Skip content',
        primaryNavigationLabel: 'Navigation',
        footerNavigationLabel: 'Footer links',
        notFoundTitle: 'Missing page',
        notFoundText: 'This fictional page is unavailable.',
        notFoundHomeLabel: 'Start',
      };
      spec.tokens.motion = 'subtle';
      const catalog = fixture.catalog;
      const validation = validateSiteSpec(spec, fixture.policy, {
        test: true,
        catalog,
      });
      assert(validation.ok, JSON.stringify(validation));
      resources = {
        '/': renderPage(spec, 'home', fixture),
        '/catalog.css': css(spec, catalog),
        '/cms.js':
          "for(const e of document.querySelectorAll('[data-collection]')){}",
        '/site.js': behaviorBundle(
          catalog,
          Object.values(catalog)
            .filter((p) => p.type === 'behavior')
            .map((p) => p.id),
          'subtle',
        ),
      };
      for (const a of spec.assets)
        resources['/assets/' + a.sha256 + '.' + a.format] = await readFile(
          join(root, 'contracts/site/2.3.0/examples/fictional-pixel.webp'),
        );
      for (const f of fontPackages(spec, catalog))
        for (const file of f.files)
          resources[
            '/fonts/' + (f.files.length === 1 ? f.id + '.woff2' : file.file)
          ] = Buffer.from(file.data, 'base64');
      for (const width of [390, 1280])
        for (const reducedMotion of ['no-preference', 'reduce']) {
          const context = await browser.newContext({
              viewport: { width, height: 900 },
              reducedMotion,
              serviceWorkers: 'block',
            }),
            page = await context.newPage(),
            external = [],
            errors = [];
          page.on('pageerror', (e) => errors.push(e.message));
          await context.route('**/*', (r) => {
            if (new URL(r.request().url()).origin === origin)
              return r.continue();
            external.push(r.request().url());
            return r.abort();
          });
          await page.goto(origin, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const violations = (
            await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze()
          ).violations;
          assert.deepEqual(
            violations.map((v) => v.id),
            [],
            entry.id,
          );
          if (entry.id === 'hero:interactive') {
            const button = page.getByRole('button');
            assert.equal(
              await page
                .locator('[data-v="hero:failing"] .fixture-control')
                .isVisible(),
              false,
            );
            assert.equal(
              await page
                .locator('[data-v="hero:failing"] .fixture-note')
                .isVisible(),
              true,
            );
            await button.focus();
            await page.keyboard.press('Enter');
            assert.equal(await button.getAttribute('aria-expanded'), 'false');
            await page.keyboard.press('Space');
            assert.equal(await button.getAttribute('aria-expanded'), 'true');
          }
          if (entry.effect?.target === 'section') {
            const box = await page.locator('#fixture-section').boundingBox();
            assert.equal(box.x, 0);
            assert.equal(box.width, width);
          }
          if (reducedMotion === 'reduce') {
            await page.evaluate(async () => {
              for (
                let y = 0;
                y < document.documentElement.scrollHeight;
                y += innerHeight / 2
              ) {
                scrollTo(0, y);
                await new Promise((r) =>
                  requestAnimationFrame(() => requestAnimationFrame(r)),
                );
              }
            });
            assert.equal(
              await page.evaluate(
                () =>
                  document
                    .getAnimations()
                    .filter((a) => a.playState === 'running' || a.pending)
                    .length,
              ),
              0,
            );
          }
          assert.deepEqual(external, []);
          assert.deepEqual(errors, []);
          const name =
            entry.id.replace(':', '--') +
            '-' +
            entry.fixtureIndex +
            '-' +
            width +
            '-' +
            reducedMotion +
            '.png';
          await page.screenshot({
            path: join(out, name),
            fullPage: true,
            animations: 'disabled',
          });
          report.push({
            package: entry.id,
            width,
            reducedMotion,
            passed: true,
            screenshot: name,
          });
          await context.close();
        }
      if (entry.id === 'hero:interactive') {
        const context = await browser.newContext({ javaScriptEnabled: false }),
          page = await context.newPage();
        await page.goto(origin);
        assert.equal(
          await page
            .locator('[data-v="hero:interactive"] .fixture-note')
            .isVisible(),
          true,
        );
        assert.equal(
          await page
            .locator('[data-v="hero:interactive"] .fixture-control')
            .isVisible(),
          false,
        );
        await context.close();
      }
    }
    complete = true;
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((r) => server.close(r));
    await fixture.close();
    await writeFile(
      join(out, 'summary.json'),
      JSON.stringify({ complete, cases: report }, null, 2) + '\n',
    );
  }
  console.log('Library browser matrix passed: ' + report.length + ' captures');
  await checkPresentationBrowser(root);
}
