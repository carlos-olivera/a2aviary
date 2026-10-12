import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import {
  composition,
  compositionNames,
} from '@a2aviary/site-core/fixtures/presentation';
import { renderPage, css } from '../src/render.ts';
import { catalog } from '@a2aviary/site-core';
import {
  behaviorBundle,
  fontPackages,
  selectedPackages,
} from '@a2aviary/site-core';
import { validateSiteSpec } from '@a2aviary/site-core';
export async function checkPresentationBrowser(root, interactionOnly = false) {
  const out = join(root, '.local/presentation-check');
  await mkdir(out, { recursive: true });
  const report = [];
  let resources = {},
    browser,
    server,
    complete = false;
  const load = async (name, options = {}) => {
    const { spec, assets } = await composition(name, options);
    if (options.motion) spec.tokens.motion = options.motion;
    const checked = validateSiteSpec(spec, undefined, { test: true });
    assert(checked.ok, JSON.stringify(checked));
    resources = {
      '/': renderPage(spec, 'home'),
      '/catalog.css': css(spec),
      '/cms.js': '',
      '/site.js': behaviorBundle(
        catalog,
        selectedPackages(spec, catalog).behaviors,
        spec.tokens.motion,
      ),
    };
    for (const a of spec.assets)
      resources['/assets/' + a.sha256 + '.webp'] = Buffer.from(
        assets[a.id],
        'base64',
      );
    for (const f of fontPackages(spec, catalog))
      for (const file of f.files)
        resources[
          '/fonts/' + (f.files.length === 1 ? f.id + '.woff2' : file.file)
        ] = Buffer.from(file.data, 'base64');
    return spec;
  };
  try {
    server = createServer((req, res) => {
      const path = new URL(req.url, 'http://localhost').pathname,
        data = resources[path];
      if (data === undefined) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'",
      );
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
    const open = async (options = {}) => {
      const context = await browser.newContext({
          viewport: { width: 390, height: 900 },
          serviceWorkers: 'block',
          ...options,
        }),
        page = await context.newPage();
      const external = [],
        errors = [];
      await context.route('**/*', (route) => {
        if (new URL(route.request().url()).origin === origin)
          return route.continue();
        external.push(route.request().url());
        return route.abort();
      });
      context.setDefaultTimeout(10000);
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });
      await page.goto(origin, { waitUntil: 'networkidle' });
      if (options.javaScriptEnabled !== false)
        await page.waitForFunction(() => document.fonts.status === 'loaded');
      return { context, page, external, errors };
    };
    const inspect = async (page, label, staticOnly = false) => {
      const results = await new AxeBuilder({ page })
        .setLegacyMode(staticOnly)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        label,
      );
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        label + ' horizontal overflow',
      );
      return {
        violations: results.violations.length,
        incomplete: results.incomplete.map((v) => v.id),
      };
    };
    for (const name of interactionOnly ? [] : compositionNames)
      for (const width of [390, 1280])
        for (const reducedMotion of ['no-preference', 'reduce']) {
          console.log('Presentation state', name, width, reducedMotion);
          await load(name);
          const { context, page, external, errors } = await open({
            viewport: { width, height: 900 },
            reducedMotion,
          });
          assert.equal(
            await page
              .locator('.card-root')
              .evaluate((e) => e.classList.contains('behavior-ready')),
            true,
          );
          for (const face of ['front', 'back']) {
            if (face === 'back') {
              await page.locator('.flip-control').focus();
              await page.keyboard.press('Enter');
              await page.waitForFunction(() =>
                document.activeElement?.classList.contains('back-control'),
              );
            }
            assert.equal(
              await page
                .locator(face === 'front' ? '.card-back' : '.card-front')
                .getAttribute('aria-hidden'),
              'true',
            );
            assert.equal(
              await page
                .locator(face === 'front' ? '.card-back' : '.card-front')
                .evaluate((e) => e.inert),
              true,
            );
            const axe = await inspect(page, name + ' ' + face);
            const screenshot = `${name}-${width}-${reducedMotion}-${face}.png`;
            await page.screenshot({
              path: join(out, screenshot),
              fullPage: true,
              animations: 'disabled',
            });
            report.push({ name, width, reducedMotion, face, axe, screenshot });
          }
          await page.locator('#sample-links a').focus();
          await inspect(page, name + ' focus border');
          await page.locator('#services-grid li').first().hover();
          await inspect(page, name + ' hover border');
          await page.locator('#contact-action a').focus();
          await inspect(page, name + ' action focus');
          await page.locator('.back-control').focus();
          await page.keyboard.press('Space');
          assert.equal(
            await page.locator('.flip-control').getAttribute('aria-pressed'),
            'false',
          );
          if (reducedMotion === 'reduce')
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
          assert.deepEqual(external, []);
          assert.deepEqual(errors, []);
          await context.close();
        }
    // Boundary lengths and all optional combinations in every palette.
    for (const name of interactionOnly ? [] : compositionNames)
      for (const length of ['minimum', 'maximum'])
        for (const image of [false, true])
          for (const contact of [false, true])
            for (const width of [390, 1280])
              for (const reducedMotion of ['no-preference', 'reduce']) {
                console.log(
                  'Presentation boundary',
                  name,
                  length,
                  image,
                  contact,
                  width,
                  reducedMotion,
                );
                await load(name, { length, image, contact });
                const { context, page, external, errors } = await open({
                  viewport: { width, height: 900 },
                  reducedMotion,
                });
                await inspect(page, `${name}/${length}/${image}/${contact}`);
                await page.locator('.flip-control').click();
                await inspect(page, 'back boundaries');
                assert.equal(
                  await page.locator('.copy-control').count(),
                  contact ? 1 : 0,
                );
                assert.equal(
                  await page.locator('.card-front img').count(),
                  image ? 1 : 0,
                );
                assert.deepEqual(errors, []);
                assert.deepEqual(external, []);
                report.push({
                  name,
                  length,
                  image,
                  contact,
                  width,
                  reducedMotion,
                  boundaries: true,
                });
                await context.close();
              }
    // Both new fonts and system controls across every palette, width and preference.
    for (const name of interactionOnly ? [] : compositionNames)
      for (const fontMode of ['new', 'system'])
        for (const width of [390, 1280])
          for (const reducedMotion of ['no-preference', 'reduce']) {
            console.log(
              'Presentation fonts',
              name,
              fontMode,
              width,
              reducedMotion,
            );
            await load(name, {
              fonts:
                fontMode === 'new'
                  ? {
                      heading: 'Space Grotesk',
                      body: 'system-sans',
                      mono: 'JetBrains Mono',
                    }
                  : {
                      heading: 'system-sans',
                      body: 'system-serif',
                      mono: 'system-mono',
                    },
            });
            const { context, page, external, errors } = await open({
              viewport: { width, height: 900 },
              reducedMotion,
            });
            for (const face of ['front', 'back']) {
              if (face === 'back') await page.locator('.flip-control').click();
              const axe = await inspect(page, name + ' font ' + face);
              report.push({ name, fontMode, width, reducedMotion, face, axe });
            }
            assert.deepEqual(external, []);
            assert.deepEqual(errors, []);
            await context.close();
          }
    for (const name of interactionOnly ? [] : compositionNames) {
      console.log('Presentation no JS', name);
      await load(name);
      const { context, page } = await open({ javaScriptEnabled: false });
      assert(await page.locator('.card-front').isVisible());
      assert(await page.locator('.card-back').isVisible());
      assert.equal(await page.locator('.card-control:visible').count(), 0);
      const snapshot = await page.content();
      await context.close();
      // Audit the exact no-JS DOM in a scripting-capable harness for axe timers.
      const audit = await open();
      await audit.page.setContent(
        snapshot.replace(/<script[\s\S]*?<\/script>/g, ''),
      );
      await inspect(audit.page, name + ' static no-JS snapshot');
      assert.equal(await audit.page.locator('.behavior-ready').count(), 0);
      await audit.context.close();
    }
    console.log('Composition, boundary, font and no-JS checks passed');
    // Native successful clipboard write; explicit doubles cover platform denial/races.
    await load('dark-en');
    let c = await open({ permissions: ['clipboard-read', 'clipboard-write'] });
    await c.page.locator('.flip-control').click();
    await c.page.locator('.copy-control').click();
    await c.page.waitForFunction(
      () =>
        document.querySelector('.copy-status').textContent === 'Address copied',
    );
    assert.equal(
      await c.page.evaluate(() => navigator.clipboard.readText()),
      'studio@example.com',
    );
    await c.page.locator('.back-control').focus();
    assert.equal(await c.page.locator('.copy-status').textContent(), '');
    await c.context.close();
    console.log('Native clipboard passed');
    for (const mode of ['denied', 'unavailable', 'delayed']) {
      c = await open();
      await c.page.evaluate(
        (mode) =>
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value:
              mode === 'unavailable'
                ? undefined
                : {
                    writeText: () =>
                      mode === 'denied'
                        ? Promise.reject(Error('fixture denial'))
                        : new Promise(
                            (resolve) => (window.fixtureResolve = resolve),
                          ),
                  },
          }),
        mode,
      );
      await c.page.locator('.flip-control').click();
      await c.page.locator('.copy-control').click();
      if (mode === 'delayed') {
        await c.page.locator('.back-control').focus();
        await c.page.evaluate(() => window.fixtureResolve());
        assert.equal(await c.page.locator('.copy-status').textContent(), '');
      } else {
        await c.page.waitForFunction(() =>
          document.activeElement?.classList.contains('copy-fallback'),
        );
        assert.equal(
          await c.page.locator('.copy-fallback').inputValue(),
          'studio@example.com',
        );
        assert.equal(
          await c.page
            .locator('.copy-fallback')
            .evaluate((e) => e.selectionEnd - e.selectionStart),
          18,
        );
        assert.equal(
          await c.page.locator('.copy-status').textContent(),
          'Copy the selected address with your keyboard',
        );
        await inspect(c.page, 'manual copy');
        await c.page.locator('.back-control').focus();
        assert.equal(await c.page.locator('.copy-status').textContent(), '');
      }
      await c.context.close();
    }
    // Fine/coarse input, clamping, reset, and changing the OS preference live.
    await load('dark-en');
    c = await open();
    const box = await c.page.locator('.card-root').boundingBox();
    await c.page.mouse.move(box.x + box.width - 4, box.y + box.height / 2);
    assert.notEqual(
      await c.page
        .locator('.card-scene')
        .evaluate((e) => e.style.getPropertyValue('--pkg-tilt-y')),
      '0deg',
    );
    await c.page
      .locator('.card-root')
      .dispatchEvent('pointermove', { clientX: 999999, clientY: -999999 });
    assert.equal(
      await c.page
        .locator('.card-scene')
        .evaluate((e) => e.style.getPropertyValue('--pkg-tilt-y')),
      '8deg',
    );
    await c.page.locator('.card-root').dispatchEvent('pointerleave');
    assert.equal(
      await c.page
        .locator('.card-scene')
        .evaluate((e) => e.style.getPropertyValue('--pkg-tilt-y')),
      '0deg',
    );
    await c.page.mouse.move(box.x + 5, box.y + 5);
    await c.page.emulateMedia({ reducedMotion: 'reduce' });
    await c.page.waitForFunction(
      () =>
        document
          .querySelector('.card-scene')
          .style.getPropertyValue('--pkg-tilt-y') === '0deg',
    );
    assert.equal(
      await c.page
        .locator('.card-scene')
        .evaluate((e) => e.style.getPropertyValue('--pkg-tilt-y')),
      '0deg',
    );
    await c.context.close();
    c = await open({ hasTouch: true, isMobile: true });
    await c.page
      .locator('.card-root')
      .dispatchEvent('pointermove', { clientX: 99999, clientY: 99999 });
    assert.equal(
      await c.page
        .locator('.card-scene')
        .evaluate((e) => e.style.getPropertyValue('--pkg-tilt-y')),
      '0deg',
    );
    await c.context.close();
    await load('dark-en', { motion: 'none' });
    c = await open();
    await c.page.locator('.flip-control').click();
    assert(await c.page.locator('.card-back').isVisible());
    assert.equal(await c.page.locator('.card-front').isVisible(), false);
    assert.equal(
      await c.page.evaluate(() => document.getAnimations().length),
      0,
    );
    await c.context.close();
    // A partial initializer failure rolls back the first behavior and its listeners.
    await load('dark-en');
    resources['/site.js'] = resources['/site.js'].replace(
      'behaviors[id](root,context);',
      'behaviors[id](root,context);if(id==="tilt")throw Error("fixture initialization failure");',
    );
    c = await open();
    assert.equal(await c.page.locator('.card-root.behavior-ready').count(), 0);
    assert(await c.page.locator('.card-front').isVisible());
    assert(await c.page.locator('.card-back').isVisible());
    assert.equal(await c.page.locator('.card-control:visible').count(), 0);
    await inspect(c.page, 'initializer rollback');
    await c.context.close();
    // Remove conditional enhancement rules to exercise the authored unsupported fallback.
    await load('dark-en');
    c = await open();
    await c.page.evaluate(() => {
      for (const sheet of document.styleSheets)
        for (let i = sheet.cssRules.length - 1; i >= 0; i--)
          if (sheet.cssRules[i] instanceof CSSSupportsRule) sheet.deleteRule(i);
    });
    assert.equal(
      await c.page
        .locator('#services-grid')
        .evaluate((e) => getComputedStyle(e).opacity),
      '1',
    );
    await inspect(c.page, 'unsupported timeline fallback');
    await c.context.close();
    complete = true;
  } finally {
    if (browser) await browser.close();
    if (server) {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
    await writeFile(
      join(out, interactionOnly ? 'interactions.json' : 'summary.json'),
      JSON.stringify(
        {
          complete,
          interactionOnly,
          cases: report,
          interactions: complete
            ? [
                'native-clipboard',
                'clipboard-denied',
                'clipboard-unavailable',
                'clipboard-stale',
                'fine-pointer',
                'coarse-pointer',
                'live-reduced-motion',
                'motion-none',
                'unsupported-scroll-fallback',
              ]
            : [],
        },
        null,
        2,
      ) + '\n',
    );
  }
  console.log(
    'Presentation browser matrix passed: ' + report.length + ' cases',
  );
}
if (process.argv[1]?.endsWith('/presentation-browser.mjs'))
  await checkPresentationBrowser(
    new URL('../../../', import.meta.url).pathname,
    process.argv.includes('--interactions-only'),
  );
