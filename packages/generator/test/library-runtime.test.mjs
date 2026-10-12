import test from 'node:test';
import { shells } from '@a2aviary/site-core/fixtures/presentation';
import assert from 'node:assert/strict';
import { readFile, writeFile, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from 'acorn';
import { validateBehavior } from '../src/library-behavior.ts';
import { validateVariantCss } from '../src/library-css.ts';
import { libraryArtifacts } from '../scripts/library.mjs';
import { runtimeFixture } from './fixtures/library-runtime/fixture.mjs';
import { validateSiteSpec } from '@a2aviary/site-core';
import {
  defaultPolicy,
  policyForVersion,
} from '@a2aviary/site-core';
import {
  validateLibrarySelection,
  gzipBytes,
  selectedPackages,
  behaviorBundle,
} from '@a2aviary/site-core';
import { renderPage, css } from '../src/render.ts';
import {
  compactLibraryManifest,
  libraryDetail,
} from '../src/library-manifest.ts';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = JSON.parse(
  await readFile(join(root, 'contracts/site/2.2.0/examples/site-spec.json')),
);
const withFixture = async (fn) => {
  const f = await runtimeFixture(root, libraryArtifacts);
  try {
    await fn(f);
  } finally {
    await f.close();
  }
};
function specimen(f) {
  const s = structuredClone(baseline);
  s.pages[0].sections[0].blocks = [
    structuredClone(f.catalog['hero:interactive'].fixture),
  ];
  return s;
}
test('restricted JS allows owned callbacks and rejects every forbidden capability and unprovable alias', () => {
  validateBehavior(
    "export default (element, context) => { const button=element.querySelector('button'); button.addEventListener('click', event => { button.hidden = !button.hidden; }); };",
    parse,
  );
  for (const code of [
    "fetch('/')",
    'new XMLHttpRequest()',
    "new WebSocket('x')",
    "new EventSource('x')",
    "navigator.sendBeacon('/')",
    "import('x')",
    "eval('x')",
    "Function('x')",
    "setTimeout('x',1)",
    "setInterval('x',1)",
    'document.cookie',
    "localStorage.getItem('x')",
    "sessionStorage.getItem('x')",
    "indexedDB.open('x')",
    "element.innerHTML='x'",
    "element.outerHTML='x'",
    "element.insertAdjacentHTML('beforeend','x')",
    "location.href='x'",
    'element.ownerDocument.body.hidden=true',
    'element.parentElement.hidden=true',
    "element.closest('body')",
    "element['hidden']=true",
    "element.constructor.constructor('x')()",
    "const f=element.querySelector; f('body')",
    "element.querySelector(':scope + div')",
    "element.addEventListener('click', e=>{e.target.hidden=true})",
    "element.addEventListener('click', e=>{e.view.location='x'})",
    'while(true){}',
    'const x={};',
    'this.x',
    "globalThis.fetch('/')",
  ]) {
    assert.throws(
      () =>
        validateBehavior(
          'export default (element, context) => {' + code + ';};',
          parse,
        ),
      undefined,
      code,
    );
  }
  for (const source of [
    "import x from 'x';export default (element, context)=>{}",
    'alert(1);export default (element, context)=>{}',
    'export default async (element, context)=>{}',
    'export const x=1',
    'export default (e,c)=>{}',
  ])
    assert.throws(() => validateBehavior(source, parse));
});
test('extended CSS values, scoped pseudos, media/supports/keyframes and properties remain closed', () => {
  assert.throws(() => validateVariantCss('', 'hero--standard', 'effect'), /id/);
  const id = 'fixture',
    s = '[data-fx~="fixture"]';
  for (const value of [
    'position:relative',
    'position:absolute',
    'position:sticky',
    'inset:0 10px',
    'z-index:99',
    'opacity:0.5',
    'transform:translateX(10px) rotate(30deg)',
    'transform-style:preserve-3d',
    'perspective:500px',
    'backface-visibility:hidden',
    'filter:blur(12px)',
    'background:linear-gradient(90deg,var(--color-primary),transparent)',
    'background-image:radial-gradient(circle,var(--color-surface),currentColor)',
    'background:conic-gradient(var(--color-primary),var(--color-accent))',
    'background:color-mix(in srgb,var(--color-primary) 20%,transparent)',
    'border:1px solid var(--color-border)',
    'outline:2px solid var(--color-accent)',
    'width:100%',
    'height:100vh',
    'min-width:20rem',
    'max-height:900px',
    'aspect-ratio:16 / 9',
    'font-family:var(--font-mono)',
  ])
    validateVariantCss(s + '{' + value + '}', id, 'effect');
  validateVariantCss(s + ':hover::before{content:""}', id, 'effect');
  validateVariantCss(
    '@supports (animation-timeline: view()){' +
      s +
      '{animation-timeline:view();animation-range:entry 0% cover 100%}}',
    id,
    'effect',
  );
  validateVariantCss(
    '@supports not (animation-timeline: view()){' + s + '{opacity:1}}',
    id,
    'effect',
  );
  validateVariantCss(
    '@property --pkg-fixture-angle{syntax:"<angle>";inherits:false;initial-value:0deg;}' +
      s +
      '{--pkg-fixture-angle:90deg}',
    id,
    'effect',
  );
  validateVariantCss(
    '@keyframes pkg-fixture-pulse{from{opacity:0}to{opacity:1}}' +
      s +
      '{animation:pkg-fixture-pulse 1s linear infinite}@media (prefers-reduced-motion: reduce){' +
      s +
      '{animation:none}}',
    id,
    'effect',
  );
  for (const value of [
    'position:fixed',
    'z-index:100',
    'opacity:2',
    'width:10000px',
    'filter:blur(999px)',
    'background:#fff',
    'background:linear-gradient(red,blue)',
    'background:url(/x)',
    'border:1px solid red',
    'font-family:evil',
    'content:"text"',
    'transform:translateX(url(x))',
    'transition:opacity 1s linear',
    'animation-name:pkg-fixture-unknown',
  ])
    assert.throws(
      () => validateVariantCss(s + '{' + value + '}', id, 'effect'),
      /Invalid library CSS/,
    );
  for (const value of [
    '@import "x";',
    '@media print{' + s + '{opacity:1}}',
    '@supports (display: grid){' + s + '{opacity:1}}',
    '@keyframes foreign{from{opacity:0}to{opacity:1}}',
    s + ',body{opacity:1}',
    s + ' + div{opacity:1}',
    s + ':has(body){opacity:1}',
    '@property --foreign{syntax:"<angle>";inherits:false;initial-value:0deg;}',
  ])
    assert.throws(() => validateVariantCss(value, id, 'effect'));
  assert.throws(
    () =>
      validateVariantCss(
        s +
          ':hover{transition:opacity 1s linear}@media (prefers-reduced-motion: reduce){' +
          s +
          '{transition:none}}',
        id,
        'effect',
      ),
    /reduced-motion/,
  );
});
test('2.1 optional defaults, language subset, literal code and historical validation', () => {
  assert(validateSiteSpec(baseline).ok);
  for (const language of ['en', 'es', 'es-BO', 'zh-Hant-TW', 'es-419'])
    assert(
      validateSiteSpec({ ...baseline, language, shell: shells.en }).ok,
      language,
    );
  for (const language of [
    'en_US',
    'en-u-ca-gregory',
    'x-private',
    '<script>',
    'english',
    'es-bo',
  ])
    assert.equal(
      validateSiteSpec({ ...baseline, language, shell: shells.en }).ok,
      false,
      language,
    );
  assert.equal(validateSiteSpec({ ...baseline, test: true }).ok, false);
  const old = JSON.parse(JSON.stringify(baseline));
  old.policyVersion = '2.0.0';
  old.contractVersion = '2.0';
  assert(validateSiteSpec(old, policyForVersion('2.0.0')).ok);
  assert.equal(
    validateSiteSpec({ ...old, language: 'es' }, policyForVersion('2.0.0')).ok,
    false,
  );
  assert.equal(
    validateSiteSpec({
      ...baseline,
      tokens: { ...baseline.tokens, motion: 'fast' },
    }).ok,
    false,
  );
});
test('status gates include components, variants, effects, fonts and transitive behaviors', () =>
  withFixture(async (f) => {
    const s = specimen(f);
    s.pages[0].sections[0].effects = ['fixture-glow'];
    assert(
      validateSiteSpec(s, f.policy, { test: true, catalog: f.catalog }).ok,
    );
    assert.equal(
      validateSiteSpec(s, f.policy, { catalog: f.catalog }).ok,
      false,
    );
    for (const id of [
      'hero',
      'hero:interactive',
      'fixture-toggle',
      'fixture-glow',
      'inter',
    ]) {
      const c = structuredClone(f.catalog);
      c[id].status = 'deprecated';
      const r = validateSiteSpec(s, f.policy, { test: true, catalog: c });
      assert.equal(r.ok, false, id);
      assert(
        r.errors.some(
          (e) =>
            e.rule === 'library.status' && e.suggestion.includes('deprecated'),
        ),
      );
    }
    const c = structuredClone(f.catalog);
    c['hero:interactive'].status = 'stable';
    c['fixture-glow'].status = 'stable';
    const r = validateSiteSpec(s, f.policy, { catalog: c });
    assert(
      r.errors.some(
        (e) => e.actual === 'experimental' && e.path.endsWith('/variant'),
      ),
    );
  }));
test('effects reject incompatible location, variants and absent targets with precise paths', () =>
  withFixture(async (f) => {
    const s = specimen(f),
      section = s.pages[0].sections[0],
      block = section.blocks[0];
    for (const [target, id, rule] of [
      [section, 'fixture-pulse', 'effect.target'],
      [block, 'fixture-glow', 'effect.target'],
      [block, 'fixture-items', 'effect.compatibility'],
    ]) {
      target.effects = [id];
      const r = validateSiteSpec(s, f.policy, {
        test: true,
        catalog: f.catalog,
      });
      assert(!r.ok);
      assert(
        r.errors.some((e) => e.rule === rule && e.path.includes('/effects/0')),
      );
      delete target.effects;
    }
    block.effects = ['fixture-action'];
    const c = structuredClone(f.catalog);
    delete c['hero:interactive'].targets.action;
    assert(
      validateLibrarySelection(s, f.policy, c, { test: true }).some(
        (e) => e.rule === 'effect.targetMissing',
      ),
    );
  }));
test('package and aggregate budgets include shared bundles, loader, font bytes and boundaries', () =>
  withFixture(async (f) => {
    const s = specimen(f),
      p = structuredClone(f.policy),
      used = selectedPackages(s, f.catalog),
      js = behaviorBundle(f.catalog, used.behaviors),
      css = used.variants.map((id) => f.catalog[id].css).join('');
    p.firstVersion.library.budgets.pageJs.value = gzipBytes(js);
    p.firstVersion.library.budgets.pageCss.value = gzipBytes(css);
    assert.equal(
      validateLibrarySelection(s, p, f.catalog, { test: true }).length,
      0,
    );
    p.firstVersion.library.budgets.pageJs.value--;
    p.firstVersion.library.budgets.pageCss.value--;
    const errors = validateLibrarySelection(s, p, f.catalog, { test: true });
    assert(errors.some((e) => e.rule === 'budget.pageJs'));
    assert(errors.some((e) => e.rule === 'budget.pageCss'));
    for (const key of ['fontFamilies', 'fontFiles', 'fontBytes']) {
      const q = structuredClone(f.policy);
      q.firstVersion.library.budgets[key].value = 0;
      assert(
        validateLibrarySelection(s, q, f.catalog, { test: true }).some(
          (e) => e.rule === 'budget.' + key,
        ),
      );
    }
    const paths = [
      'plans/web-simple.policy.json',
      'plans/versions/web-simple/2.2.0.policy.json',
    ];
    for (const key of [
      'components',
      'variants',
      'behaviors',
      'effects',
      'fonts',
      'variantCss',
      'effectCss',
      'behaviorJs',
    ]) {
      const q = structuredClone(f.policy);
      q.firstVersion.library.budgets[key].value = 1;
      for (const path of paths)
        await writeFile(join(f.root, path), JSON.stringify(q));
      await assert.rejects(
        libraryArtifacts(f.root),
        new RegExp('budget ' + key),
      );
    }
  }));
test('compiled output preserves default boxes, emits selected effects and Spanish flush sections', () =>
  withFixture(async (f) => {
    const s = specimen(f);
    s.language = 'es-BO';
    s.tokens.layout = 'flush';
    s.tokens.motion = 'subtle';
    s.pages[0].sections[0].effects = ['fixture-glow'];
    s.pages[0].sections[0].blocks[0].effects = [
      'fixture-pulse',
      'fixture-action',
    ];
    const html = renderPage(s, s.pages[0].id, f);
    assert(html.includes('lang="es-BO"'));
    assert(html.includes('class="section-inner"'));
    assert(html.includes('data-behavior="fixture-toggle"'));
    assert(html.includes('data-fx="fixture-pulse"'));
    assert(html.includes('data-fx="fixture-action"'));
    assert(html.includes('site.js" defer'));
    assert(html.includes('type="button" data-behavior-control hidden'));
    const base = renderPage(baseline, baseline.pages[0].id);
    assert(!base.includes('site.js'));
    assert(!base.includes('section-inner'));
    assert.equal(
      base,
      renderPage(
        { ...baseline, tokens: { ...baseline.tokens, layout: 'boxed' } },
        baseline.pages[0].id,
      ),
    );
    assert(css(s, f.catalog).includes('.layout-flush main{max-width:none'));
  }));
test('schemas, policy agreement, duplicate signatures and font provenance reject tampering', () =>
  withFixture(async (f) => {
    const path = join(f.root, 'library/fonts/inter/font.json'),
      original = await readFile(path, 'utf8');
    for (const change of [
      (p) => (p.source.subset = 'latin-ext'),
      (p) => (p.source.license = 'unknown'),
      (p) => (p.files[0].sha256 = '0'.repeat(64)),
      (p) => (p.source.package = 'https://fonts.invalid'),
      (p) => (p.unexpected = true),
    ]) {
      const meta = JSON.parse(original);
      change(meta);
      await writeFile(path, JSON.stringify(meta));
      await assert.rejects(libraryArtifacts(f.root));
    }
    await writeFile(path, original);
    const q = structuredClone(f.policy);
    q.firstVersion.library.effects.value = [];
    for (const p of [
      'plans/web-simple.policy.json',
      'plans/versions/web-simple/2.2.0.policy.json',
    ])
      await writeFile(join(f.root, p), JSON.stringify(q));
    await assert.rejects(libraryArtifacts(f.root), /registry\/policy/);
    for (const p of [
      'plans/web-simple.policy.json',
      'plans/versions/web-simple/2.2.0.policy.json',
    ])
      await writeFile(join(f.root, p), JSON.stringify(f.policy));
    await cp(join(f.root, 'library/steps'), join(f.root, 'library/duplicate'), {
      recursive: true,
    });
    await rm(join(f.root, 'library/duplicate/variants/timeline'), {
      recursive: true,
    });
    const m = JSON.parse(
      await readFile(join(f.root, 'library/duplicate/component.json')),
    );
    m.id = 'duplicate';
    await writeFile(
      join(f.root, 'library/duplicate/component.json'),
      JSON.stringify(m),
    );
    const v = JSON.parse(
      await readFile(
        join(f.root, 'library/duplicate/variants/standard/variant.json'),
      ),
    );
    v.id = 'duplicate:standard';
    v.component = 'duplicate';
    await writeFile(
      join(f.root, 'library/duplicate/variants/standard/variant.json'),
      JSON.stringify(v),
    );
    let source = await readFile(
      join(f.root, 'library/duplicate/variants/standard/style.css'),
      'utf8',
    );
    await writeFile(
      join(f.root, 'library/duplicate/variants/standard/style.css'),
      source.replaceAll('steps:standard', 'duplicate:standard'),
    );
    const fixture = JSON.parse(
      await readFile(
        join(
          f.root,
          'library/duplicate/variants/standard/fixtures/default.json',
        ),
      ),
    );
    fixture.component = 'duplicate';
    await writeFile(
      join(f.root, 'library/duplicate/variants/standard/fixtures/default.json'),
      JSON.stringify(fixture),
    );
    const p = structuredClone(f.policy);
    p.firstVersion.components.duplicate = structuredClone(
      p.firstVersion.components.steps,
    );
    p.firstVersion.components.duplicate.variants.value = ['standard'];
    for (const path of [
      'plans/web-simple.policy.json',
      'plans/versions/web-simple/2.2.0.policy.json',
    ])
      await writeFile(join(f.root, path), JSON.stringify(p));
    await assert.rejects(
      libraryArtifacts(f.root),
      /duplicate component field signature/,
    );
  }));
test('manifest fits context and package details contain no executable source or font bytes', () => {
  assert(libraryDetail('hero').exampleProps);
  assert.throws(() => libraryDetail('__proto__'), /library_package_not_found/);
  assert(Buffer.byteLength(JSON.stringify(compactLibraryManifest())) <= 24576);
  assert.equal(compactLibraryManifest().manifest.packages.length, 35);
  assert.equal(libraryDetail('inter').source.subset, 'latin');
  assert(!JSON.stringify(libraryDetail('inter')).includes('d09GMg'));
  assert.throws(() => libraryDetail('fixture-glow'));
});

test('full generator emits only trusted behavior code and binds package metadata to provenance', () =>
  withFixture(async (f) => {
    const { generateSite } = await import('../dist/index.js');
    const spec = specimen(f),
      pixel = await readFile(
        join(root, 'contracts/site/2.2.0/examples/fictional-pixel.webp'),
      ),
      assets = new Map([[spec.assets[0].id, pixel]]);
    spec.pages[0].sections[0].effects = ['fixture-glow'];
    await assert.rejects(
      generateSite(spec, assets, { fixtureLibrary: f }),
      /invalid_spec/,
    );
    const source = await generateSite(spec, assets, {
      test: true,
      fixtureLibrary: f,
    });
    assert(source.files['public/site.js'].includes('fixture-toggle'));
    assert(!source.files['public/site.js'].includes('fixture-failure'));
    assert(source.files['verify.mjs'].startsWith('// network-guard-sha256: '));
    const changed = { ...f, catalog: structuredClone(f.catalog) };
    changed.catalog['hero:interactive'].version = '1.0.1';
    const next = await generateSite(spec, assets, {
      test: true,
      fixtureLibrary: changed,
    });
    assert.notEqual(source.sourceSha256, next.sourceSha256);
    assert.deepEqual(source.files, next.files);
  }));
