import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { validateBehavior } from '../src/library-behavior.ts';
import { validateVariantCss } from '../src/library-css.ts';
import { parseTemplate } from '../src/library-template.ts';
import { renderPage, css, generateSite } from '../dist/index.js';
import { validateSiteSpec } from '@a2aviary/site-core';
import {
  policyForVersion,
  defaultPolicy,
  sha256,
} from '@a2aviary/site-core';
import { catalog } from '@a2aviary/site-core';
import { contentErrors } from '@a2aviary/site-core';
import {
  composition,
  compositionNames,
  shells,
} from '@a2aviary/site-core/fixtures/presentation';
const baseline = JSON.parse(
  await readFile(
    new URL(
      '../../../contracts/site/2.2.0/examples/site-spec.json',
      import.meta.url,
    ),
  ),
);
// URL above is relative to test/, which is four levels below repository root.
test('shell requirements follow language, package metadata and dependencies without defaults', async () => {
  assert(validateSiteSpec(baseline).ok);
  for (const language of ['es', 'en-US']) {
    const s = { ...baseline, language };
    const r = validateSiteSpec(s);
    assert(!r.ok);
    assert.equal(
      r.errors.filter((e) => e.rule === 'content.required').length,
      6,
    );
    assert(validateSiteSpec({ ...s, shell: shells.es }).ok);
  }
  assert.equal(
    contentErrors({ ...baseline, shell: { skipLink: 'Go' } }, catalog).length,
    5,
  );
  const { spec } = await composition('dark-en');
  delete spec.shell;
  assert.equal(
    contentErrors(spec, catalog).filter((e) => e.path.startsWith('/shell/'))
      .length,
    6,
  );
  const isolated = structuredClone(catalog);
  for (const p of Object.values(isolated)) delete p.requiresShellContent;
  isolated.tilt.requiresShellContent = true;
  assert.equal(
    contentErrors(spec, isolated).filter((e) => e.path.startsWith('/shell/'))
      .length,
    6,
  );
});
test('conditional controls have exact missing paths, empty optionals never receive copy', async () => {
  const { spec } = await composition('dark-en');
  const props = spec.pages[0].sections[0].blocks[0].props;
  for (const key of [
    'flipLabel',
    'backLabel',
    'copyLabel',
    'copiedLabel',
    'manualCopyLabel',
  ])
    props[key] = '';
  const r = validateSiteSpec(spec, undefined, { test: true });
  assert(!r.ok);
  assert.equal(r.errors.filter((e) => e.rule === 'content.required').length, 5);
  delete props.primaryContact;
  assert.equal(contentErrors(spec, catalog).length, 2);
  const without = await composition('light-es', {
    image: false,
    contact: false,
  });
  const html = renderPage(without.spec, 'home');
  assert(!html.includes('copy-control'));
  assert(!html.includes('copied-message'));
  assert(!html.includes('card-front is-active"><img'));
});
test('every batch composition is tester-only and fits the existing font and bundle budgets', async () => {
  for (const name of compositionNames) {
    const { spec } = await composition(name);
    assert(validateSiteSpec(spec, undefined, { test: true }).ok);
    const denied = validateSiteSpec(spec);
    assert(!denied.ok);
    assert(denied.errors.some((e) => e.rule === 'library.status'));
  }
});
test('pointer output is typed, namespaced and instrumented; unrelated capabilities stay closed', () => {
  const properties = {
    '--pkg-tilt-x': { unit: 'deg', min: -8, max: 8, initial: 0 },
  };
  const compile = (body) =>
    validateBehavior(
      'export default (element, context)=>{' + body + '};',
      parse,
      'tilt',
      properties,
    );
  const output = compile(
    "element.addEventListener('pointermove',event=>{const box=element.getBoundingClientRect();const x=(event.clientX-box.left)/box.width;element.style.setProperty('--pkg-tilt-x',x+'deg');});",
  );
  assert(output.includes('context.setProperty('));
  assert(!output.includes('.style.setProperty'));
  for (const body of [
    "element.style.setProperty('--color-text',1+'deg')",
    "element.style.setProperty('--pkg-other-x',1+'deg')",
    "element.style.setProperty('--pkg-tilt-x','url(x)')",
    "element.style.setProperty('--pkg-tilt-x',1+'px')",
    "element.style.setProperty('--pkg-tilt-x',element.textContent+'deg')",
    "element.style.color='red'",
    "element.querySelector('div').getBoundingClientRect()",
    "element.addEventListener('click',event=>{element.style.setProperty('--pkg-tilt-x',event.clientX+'deg')})",
    "context.copyText('mailto:a@example.com','Manual',ok=>{})",
    "context.copyText(element,'Manual',async ok=>{})",
    "context.copyText(element,'Manual',ok=>{}).then(ok=>{})",
    "context.setProperty(element,'--pkg-tilt-x',1)",
    'requestAnimationFrame(x=>{})',
    "navigator.clipboard.writeText('x')",
  ])
    assert.throws(() => compile(body), undefined, body);
});
test('new CSS grammar stays scoped, bounded and dependency-aware', () => {
  const id = 'profile-card:flip-3d',
    s = '[data-v="' + id + '"]';
  const props = {
    '--pkg-tilt-x': { unit: 'deg', min: -8, max: 8, initial: 0 },
  };
  validateVariantCss(
    s +
      ' .face.active{transform:rotateY(180deg);grid-area:1 / 1;clip-path:inset(0 100% 0 0)}',
    id,
  );
  validateVariantCss(
    s + '{transform:rotateX(var(--pkg-tilt-x))}',
    id,
    'variant',
    props,
  );
  for (const text of [
    s + '{transform:rotateX(var(--pkg-tilt-x))}',
    s + '{transform:rotateY(1000deg)}',
    s + '{clip-path:inset(0 101%)}',
    s + '{animation-timing-function:steps(999)}',
    s + ':nth-child(999){opacity:1}',
    s + ' .face.active,body{opacity:1}',
    s + '{background:red}',
    s + '{font-family:Inter}',
  ])
    assert.throws(() => validateVariantCss(text, id));
  assert.throws(
    () => parseTemplate('<p>Default copy</p>', {}, true),
    /literal package copy/,
  );
});
test('effect targets decorate actual list items and action links only when selected', async () => {
  const { spec } = await composition('dark-en');
  let html = renderPage(spec, 'home');
  assert.match(html, /<li data-fx="glow-border">/);
  assert.match(html, /<a data-fx="shimmer" href="mailto:studio@example.com">/);
  for (const s of spec.pages[0].sections) {
    delete s.effects;
    for (const b of s.blocks) delete b.effects;
  }
  html = renderPage(spec, 'home');
  assert(!html.includes('data-fx='));
  assert(!html.includes('class="grid-item"'));
});
test('current English generated resources retain the original boxed bytes', async () => {
  const golden = JSON.parse(
    await readFile(new URL('./fixtures/boxed-2.1.json', import.meta.url)),
  );
  const bytes = await readFile(
    new URL(
      '../../../contracts/site/2.2.0/examples/fictional-pixel.webp',
      import.meta.url,
    ),
  );
  const source = await generateSite(
    baseline,
    new Map(baseline.assets.map((a) => [a.id, bytes])),
  );
  for (const [path, hash] of Object.entries(golden.hashes))
    assert.equal(
      sha256(
        path in source.binaryFiles
          ? Buffer.from(source.binaryFiles[path], 'base64')
          : source.files[path],
      ),
      hash,
      path,
    );
});

test('each added CSS grammar has accepted and rejected bounds', () => {
  const id = 'profile-card:flip-3d',
    scope = '[data-v="' + id + '"]';
  const ok = (declaration) =>
    validateVariantCss(scope + '{' + declaration + '}', id);
  for (const declaration of [
    'transform:rotateX(-8deg) rotateY(180deg)',
    'grid-area:1 / 1',
    'overflow-wrap:anywhere;overflow:clip',
    'clip-path:inset(0 100% 0 0)',
    'animation-timing-function:steps(120, end)',
    'animation-duration:calc(var(--motion-duration) * 8)',
    'background:conic-gradient(from 90deg,var(--color-primary),var(--color-accent))',
    'transform:translateY(var(--motion-distance))',
  ])
    ok(declaration);
  validateVariantCss(
    scope +
      '.ready .face.active{display:block}' +
      scope +
      ':nth-child(40){display:block}',
    id,
  );
  for (const declaration of [
    'transform:rotateX(1000deg)',
    'grid-area:1 / 2',
    'overflow:scroll',
    'clip-path:inset(-1% 0)',
    'animation-timing-function:steps(0)',
    'animation-duration:calc(var(--motion-duration) * 9)',
    'background:conic-gradient(from 1000deg,var(--color-primary),var(--color-accent))',
    'transform:translateY(var(--arbitrary))',
  ])
    assert.throws(() => ok(declaration), undefined, declaration);
  for (const selector of [
    scope + ':nth-child(41)',
    scope + ':nth-child(2n)',
    scope + ' .face+body',
    '.ready ' + scope,
  ])
    assert.throws(() => validateVariantCss(selector + '{display:block}', id));
});

test('reviewed setters clamp numbers, reject nonfinite writes and reset live preferences', async () => {
  const { behaviorLoader } =
    await import('@a2aviary/site-core');
  const { runInNewContext } = await import('node:vm');
  const values = new Map(),
    listeners = [];
  const root = {
    innerHTML: 'readable',
    dataset: { behavior: 'tilt' },
    style: { setProperty: (k, v) => values.set(k, v) },
    addEventListener() {},
    querySelectorAll: () => [],
    contains: () => false,
    classList: { add() {}, remove() {} },
    isConnected: true,
  };
  const media = {
      matches: false,
      addEventListener: (_, fn) => listeners.push(fn),
    },
    pointer = {
      matches: true,
      addEventListener: (_, fn) => listeners.push(fn),
    };
  let context;
  const boot = runInNewContext('(' + behaviorLoader + ')', {
    matchMedia: (q) => (q.includes('reduced') ? media : pointer),
    document: { querySelectorAll: () => [root] },
    AbortController,
  });
  boot(
    {
      tilt: (_root, c) => {
        context = c;
      },
    },
    { tilt: { '--pkg-tilt-x': { unit: 'deg', min: -8, max: 8, initial: 0 } } },
    'expressive',
  );
  context.setProperty(root, '--pkg-tilt-x', 99);
  assert.equal(values.get('--pkg-tilt-x'), '8deg');
  for (const n of [NaN, Infinity, -Infinity, '4'])
    context.setProperty(root, '--pkg-tilt-x', n);
  assert.equal(values.get('--pkg-tilt-x'), '8deg');
  context.setProperty(root, '--pkg-tilt-x', -99);
  assert.equal(values.get('--pkg-tilt-x'), '-8deg');
  context.setProperty({}, '--pkg-tilt-x', 3);
  context.setProperty(root, '--pkg-unknown-x', 3);
  assert.equal(values.size, 1);
  media.matches = true;
  listeners[0]();
  assert.equal(values.get('--pkg-tilt-x'), '0deg');
});

test('owner 404 braces remain data rather than executable Astro expressions', async () => {
  const { spec, assets } = await composition('dark-en');
  spec.shell.notFoundText =
    '{process.env.PRIVATE_VALUE} <script>never execute</script>';
  const source = await generateSite(
    spec,
    new Map(
      Object.entries(assets).map(([id, b]) => [id, Buffer.from(b, 'base64')]),
    ),
    { test: true },
  );
  const file = source.files['src/pages/404.astro'];
  assert(file.startsWith('---\nconst html = '));
  assert(file.endsWith('<Fragment set:html={html} />\n'));
  const html = JSON.parse(
    file.split('\n')[1].slice('const html = '.length, -1),
  );
  assert(
    html.includes(
      '{process.env.PRIVATE_VALUE} &lt;script&gt;never execute&lt;/script&gt;',
    ),
  );
});

test('a newer trusted copy interaction suppresses the earlier async completion', async () => {
  const { behaviorLoader } =
    await import('@a2aviary/site-core');
  const { runInNewContext } = await import('node:vm');
  const events = new Map(),
    pending = [],
    status = { textContent: '' };
  class Anchor {
    href = 'mailto:studio@example.com';
  }
  const link = new Anchor();
  const root = {
    innerHTML: 'readable',
    dataset: { behavior: 'copy-text' },
    isConnected: true,
    addEventListener(name, fn) {
      if (!events.has(name)) events.set(name, []);
      events.get(name).push(fn);
    },
    querySelectorAll: () => [status],
    contains: (item) => item === link,
    classList: { add() {}, remove() {} },
  };
  const boot = runInNewContext('(' + behaviorLoader + ')', {
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    document: { querySelectorAll: () => [root] },
    AbortController,
    URL,
    HTMLAnchorElement: Anchor,
    location: { protocol: 'https:' },
    navigator: {
      clipboard: {
        writeText: () => new Promise((resolve) => pending.push(resolve)),
      },
    },
  });
  boot(
    {
      'copy-text': (_, context) =>
        context.listen(root, 'click', () =>
          context.copyText(link, 'Copy selected address', (ok) => {
            status.textContent = ok ? 'Copied' : 'Manual';
          }),
        ),
    },
    {},
    'none',
  );
  const click = () =>
    events.get('click').forEach((fn) => fn({ isTrusted: true, type: 'click' }));
  click();
  click();
  assert.equal(pending.length, 2);
  pending[0]();
  await Promise.resolve();
  assert.equal(status.textContent, '');
  pending[1]();
  await Promise.resolve();
  assert.equal(status.textContent, 'Copied');
  click();
  events.get('blur').forEach((fn) => fn());
  pending[2]();
  await Promise.resolve();
  assert.equal(status.textContent, '');
});

test('owner-copy behavior packages cannot introduce literal messages or accessible labels', () => {
  const compile = (body) =>
    validateBehavior(
      'export default (element, context)=>{' + body + '};',
      parse,
      'copy-text',
      {},
      true,
    );
  compile(
    "const text=element.querySelector('.message').textContent;element.textContent=text;element.textContent='';element.setAttribute('aria-label',text);context.copyText(element.querySelector('a'),text,ok=>{element.textContent=text;});",
  );
  for (const body of [
    "element.textContent='Copied'",
    "const text='Copied';element.textContent=text",
    "element.textContent=element.textContent+' copied'",
    "element.setAttribute('aria-label','Copy')",
    "context.copyText(element.querySelector('a'),'Manual copy',ok=>{})",
  ])
    assert.throws(() => compile(body), /owner-supplied/);
});
