// Local-only reproducible baseline/candidate comparison; no hosted calls or approvals.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
const [mode, modulePath, outputPath, baselinePath] = process.argv.slice(2);
assert(
  ['capture', 'compare'].includes(mode),
  'capture|compare MODULE OUTPUT [BASELINE]',
);
const renderer = await import(pathToFileURL(resolve(modulePath)));
const root = new URL('../../../', import.meta.url),
  output = resolve(outputPath);
const manifest = JSON.parse(
  await readFile(new URL('contracts/site/2.0.0/manifest.json', root), 'utf8'),
);
const fixture = JSON.parse(
  await readFile(
    new URL('contracts/site/2.0.0/examples/site-spec.json', root),
    'utf8',
  ),
);
const pixel = await readFile(
  new URL('contracts/site/2.0.0/examples/fictional-pixel.webp', root),
);
const specs = { manifest: manifest.examples.spec, fixture };
const records = [],
  browser = await chromium.launch({ headless: true });
const save = async (path, data) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
};
const normalize = (html) =>
  html
    .replace(/ data-v="[a-z-]+:standard"/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s+/g, ' ')
    .trim();
try {
  for (const [name, spec] of Object.entries(specs)) {
    const bundle = await renderer.generateSite(
      spec,
      new Map([[spec.assets[0].id, pixel]]),
    );
    const files = {};
    for (const [p, v] of Object.entries(bundle.files))
      if (p.startsWith('public/')) files['/' + p.slice(7)] = Buffer.from(v);
    for (const [p, v] of Object.entries(bundle.binaryFiles))
      files['/' + p.slice(7)] = Buffer.from(v, 'base64');
    for (const page of spec.pages)
      files[page.path] = Buffer.from(renderer.renderPage(spec, page.id));
    await save(resolve(output, name, 'source.json'), JSON.stringify(bundle));
    for (const state of ['empty', 'populated', 'error']) {
      const server = createServer((req, res) => {
        if (req.url.startsWith('/api/cms/')) {
          res.writeHead(state === 'error' ? 503 : 200, {
            'content-type': 'application/json',
          });
          res.end(
            JSON.stringify({
              items:
                state === 'populated'
                  ? [
                      {
                        title: 'Fictional update',
                        body: 'Fictional CMS content <script> remains text.',
                      },
                    ]
                  : [],
            }),
          );
          return;
        }
        const path = new URL(req.url, 'http://localhost').pathname,
          body = files[path];
        const type = path.endsWith('.css')
          ? 'text/css'
          : path.endsWith('.js')
            ? 'text/javascript'
            : path.endsWith('.woff2')
              ? 'font/woff2'
              : path.endsWith('.webp')
                ? 'image/webp'
                : 'text/html';
        res.writeHead(body ? 200 : 404, {
          'content-type': type,
          'content-security-policy':
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'",
        });
        res.end(body ?? 'not found');
      });
      await new Promise((r) => server.listen(0, '127.0.0.1', r));
      try {
        for (const page of spec.pages) {
          const key = page.id;
          if (state === 'empty') {
            const html = files[page.path].toString();
            await save(resolve(output, name, key + '.html'), html);
            if (mode === 'compare')
              assert.equal(
                normalize(html),
                normalize(
                  await readFile(
                    resolve(baselinePath, name, key + '.html'),
                    'utf8',
                  ),
                ),
                'HTML ' + name + page.path,
              );
          }
          for (const width of [390, 1280]) {
            const tab = await browser.newPage({
              viewport: { width, height: 900 },
              deviceScaleFactor: 1,
              reducedMotion: 'reduce',
            });
            const errors = [];
            tab.on('pageerror', (e) => errors.push(e.message));
            await tab.goto(
              'http://127.0.0.1:' + server.address().port + page.path,
              { waitUntil: 'networkidle' },
            );
            await tab.evaluate(async () => {
              await document.fonts.ready;
              await Promise.all([...document.images].map((i) => i.decode()));
            });
            if (state === 'populated') {
              for (const target of await tab.locator('[data-collection]').all())
                assert.match(await target.innerText(), /Fictional update/);
            }
            const file = [name, state, key + '-' + width + '.png'].join('/');
            const bytes = await tab.screenshot({ fullPage: true });
            await save(resolve(output, file), bytes);
            assert.deepEqual(errors, []);
            let changedPixels = 0;
            if (mode === 'compare') {
              const before = await sharp(
                await readFile(resolve(baselinePath, file)),
              )
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
              const after = await sharp(bytes)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
              assert.deepEqual(
                after.info,
                before.info,
                'image dimensions ' + file,
              );
              const diff = Buffer.alloc(after.data.length);
              for (let i = 0; i < diff.length; i += 4) {
                const changed = !after.data
                  .subarray(i, i + 4)
                  .equals(before.data.subarray(i, i + 4));
                if (changed) changedPixels++;
                diff[i] = changed ? 255 : 0;
                diff[i + 3] = 255;
              }
              await save(
                resolve(output, 'diff', file),
                await sharp(diff, { raw: after.info }).png().toBuffer(),
              );
            }
            records.push({ file, changedPixels });
            await tab.close();
          }
        }
      } finally {
        await new Promise((r) => server.close(r));
      }
    }
  }
} finally {
  await browser.close();
}
const report = {
  mode,
  generatorVersion: renderer.GENERATOR_VERSION,
  browser: 'Chromium',
  viewports: [390, 1280],
  height: 900,
  deviceScaleFactor: 1,
  records,
};
await save(
  resolve(output, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
assert(
  records.every((r) => r.changedPixels === 0),
  'pixel mismatch; see report and diff images',
);
console.log(
  JSON.stringify({
    mode,
    comparisons: records.length,
    changedPixels: records.reduce((n, r) => n + r.changedPixels, 0),
  }),
);
