import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readFile,
  mkdtemp,
  cp,
  writeFile,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Ajv from 'ajv';
import { parseTemplate, interpretTemplate } from '../src/library-template.ts';
import { validateVariantCss } from '../src/library-css.ts';
import { checkLibrary, libraryArtifacts } from '../scripts/library.mjs';
import {
  generateSite,
  renderPage,
  GENERATOR_VERSION,
  sha256,
} from '../dist/index.js';
import { fixtureSubmission } from '@a2aviary/site-core/fixtures/catalog';
const root = new URL('../../../', import.meta.url);
const input = await fixtureSubmission(),
  assets = new Map(
    Object.entries(input.assets).map(([id, b]) => [
      id,
      Buffer.from(b, 'base64'),
    ]),
  );
const fields = {
  heading: { kind: 'heading' },
  text: { kind: 'shortCopy' },
  items: { kind: 'textItems' },
  image: { kind: 'image' },
  links: { kind: 'links' },
};
test('template grammar preserves nested control flow and escaped text', () => {
  const ast = parseTemplate(
    '<div>{{#if heading}}<h2>{{heading}}</h2>{{/if}}{{#each items}}<p>{{#if text}}{{text}}{{/if}}</p>{{/each}}</div>',
    fields,
  );
  assert.equal(
    interpretTemplate(
      ast,
      { heading: '<>&"\'', items: [{ text: 'one' }, { text: '' }] },
      () => assert.fail(),
    ),
    '<div><h2>&lt;&gt;&amp;&quot;&#39;</h2><p>one</p><p></p></div>',
  );
  assert.equal(
    interpretTemplate(
      parseTemplate('{{#each links}}{{> link this}}{{/each}}', fields),
      { links: [{ label: 'ok' }] },
      (name, v) => name + ':' + v.label,
    ),
    'link:ok',
  );
});
test('reject unsafe or ill-typed template constructs at compilation', () => {
  for (const template of [
    '<script>alert(1)</script>',
    '<style>p{color:red}</style>',
    '<iframe></iframe>',
    '<object></object>',
    '<embed>',
    '<form></form>',
    '<svg></svg>',
    '<p onclick="x">x</p>',
    '<p style="color:red">x</p>',
    '<p class="{{heading}}">x</p>',
    '<a href="javascript:alert(1)">x</a>',
    '{{{heading}}}',
    '{{& heading}}',
    '{{missing}}',
    '{{constructor}}',
    '{{__proto__}}',
    '{{heading.length}}',
    '{{> run heading}}',
    '{{> image heading}}',
    '{{image}}',
    '{{#each heading}}{{this}}{{/each}}',
    '{{#if heading}}x{{/each}}',
    '{{#if heading}}<p>{{/if}}</p>',
    '<p>{{#if heading}}</p>{{/if}}',
    '<p><h2>x</p></h2>',
    '{{#if heading}}',
    '<p class=hello>x</p>',
    '<!-- hi -->',
    '{{> collection links}}',
    '{{#each items}}{{missing}}{{/each}}',
    '{{else}}',
    '{{/undefined}}<script>alert(1)</script>',
  ])
    assert.throws(
      () => parseTemplate(template, fields),
      /Invalid library template/,
      template,
    );
});
test('CSS validates every selector and rejects alternate syntax or resource loading', () => {
  const scope = '[data-v="hero:standard"]';
  validateVariantCss(
    scope + ' img{display:block;max-width:100%;height:auto}',
    'hero:standard',
  );
  validateVariantCss(
    scope + ' p,' + scope + ' h2{color:var(--color-primary)}',
    'hero:standard',
  );
  for (const css of [
    'body{display:block}',
    scope + ' p,body{display:block}',
    scope + ' + p{display:block}',
    scope + '~p{display:block}',
    scope + ':has(body){display:block}',
    scope + ' p{color:#fff}',
    scope + ' p{color:red}',
    scope + ' p{background:url(https://example.invalid)}',
    '@import "x";',
    '@media screen{' + scope + ' p{display:block}}',
    scope + ' p{--x:red}',
    scope + ' p{padding:var(--space-999)}',
    scope + ' p{color:var(--color-primary,red)}',
    scope + ' p{display:block!important}',
    scope + ' p{display:expression(x)}',
    scope + ' p{behavior:url(x)}',
    scope + ' p{display:bl/**/ock}',
    scope + ' p{display:bl\\6f ck}',
    scope + ' p{}',
    '[data-v="faq:standard"] p{display:block}',
  ])
    assert.throws(
      () => validateVariantCss(css, 'hero:standard'),
      /Invalid library CSS/,
      css,
    );
});
test('registry has 38 schema-valid curated packages', async () => {
  const { registry } = await checkLibrary();
  const value = JSON.parse(registry);
  const validate = new Ajv({ strict: false }).compile(
    JSON.parse(
      await readFile(new URL('library/registry.schema.json', root), 'utf8'),
    ),
  );
  assert(validate(value), JSON.stringify(validate.errors));
  assert.equal(value.packages.length, 38);
  assert.deepEqual([...new Set(value.packages.map((p) => p.type))].sort(), [
    'behavior',
    'component',
    'effect',
    'font',
    'variant',
  ]);
  assert(
    value.packages.filter((p) => p.status === 'experimental').length === 12 &&
      value.packages.filter((p) => p.status === 'stable').length === 26,
  );
  for (const type of ['behavior', 'effect', 'font'])
    assert(
      validate({
        schemaVersion: 1,
        packages: [
          {
            id: 'future',
            type,
            version: '1.0.0',
            status: 'experimental',
            files: { 'future/manifest.json': '0'.repeat(64) },
          },
        ],
      }),
    );
});
test('registry detects stale data, policy drift, missing/extra packages, symlinks and unexpected files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'a2aviary-library-'));
  try {
    await cp(new URL('library', root), join(dir, 'library'), {
      recursive: true,
    });
    await cp(new URL('plans', root), join(dir, 'plans'), { recursive: true });
    await cp(
      new URL('packages/generator/src/library-data.ts', root),
      join(dir, 'packages/generator/src/library-data.ts'),
      { recursive: true },
    );
    await cp(
      new URL('packages/site-core/src/library-data.ts', root),
      join(dir, 'packages/site-core/src/library-data.ts'),
      { recursive: true },
    );
    await checkLibrary(dir);
    const target = join(dir, 'library/hero/variants/standard/template.html'),
      original = await readFile(target, 'utf8');
    await writeFile(target, original + '\n');
    await assert.rejects(checkLibrary(dir), /stale/);
    await writeFile(target, original);
    await writeFile(join(dir, 'library/hero/run.js'), 'throw Error()');
    await assert.rejects(libraryArtifacts(dir), /unknown package|unexpected/);
    await rm(join(dir, 'library/hero/run.js'));
    await symlink(target, join(dir, 'library/hero/extra.html'));
    await assert.rejects(libraryArtifacts(dir), /symlink/);
    await rm(join(dir, 'library/hero/extra.html'));
    const metadata = join(dir, 'library/hero/component.json'),
      before = await readFile(metadata, 'utf8'),
      m = JSON.parse(before);
    m.fields.heading.kind = 'link';
    await writeFile(metadata, JSON.stringify(m));
    await assert.rejects(libraryArtifacts(dir), /component fields/);
    for (const version of [['1.0.0'], '01.0.0', '1.0.0\n']) {
      await writeFile(
        metadata,
        JSON.stringify({ ...JSON.parse(before), version }),
      );
      await assert.rejects(libraryArtifacts(dir), /version/);
    }
    await writeFile(metadata, before);
    await rm(join(dir, 'library/hero/variants/standard/style.css'));
    await assert.rejects(libraryArtifacts(dir));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test('fixtures render each policy component, helpers preserve links, assets and optional content', async () => {
  const registry = JSON.parse(
    await readFile(new URL('library/registry.json', root), 'utf8'),
  );
  for (const packageEntry of registry.packages.filter(
    (p) => p.type === 'variant',
  )) {
    const path = Object.keys(packageEntry.files).find((p) =>
      /\/fixtures\/[^/]+\.json$/.test(p),
    );
    const block = JSON.parse(
      await readFile(new URL('library/' + path, root), 'utf8'),
    );
    const spec = structuredClone(input.spec);
    const section = spec.pages
      .flatMap((p) => p.sections)
      .find((s) => s.blocks.some((b) => b.component === block.component));
    if (!section) {
      spec.pages[1].sections[0].blocks.push(block);
      spec.shell = {
        skipLink: 'Skip',
        primaryNavigationLabel: 'Main',
        footerNavigationLabel: 'Footer',
        notFoundTitle: 'Missing',
        notFoundText: 'Unavailable page.',
        notFoundHomeLabel: 'Home',
      };
      await generateSite(spec, assets, { test: true });
      continue;
    }
    const index = section.blocks.findIndex(
      (b) => b.component === block.component,
    );
    block.id = section.blocks[index].id;
    section.blocks[index] = block;
    spec.shell = {
      skipLink: 'Skip',
      primaryNavigationLabel: 'Main',
      footerNavigationLabel: 'Footer',
      notFoundTitle: 'Missing',
      notFoundText: 'Unavailable page.',
      notFoundHomeLabel: 'Home',
    };
    await generateSite(spec, assets, { test: true });
  }
  const spec = structuredClone(input.spec),
    hero = spec.pages
      .flatMap((p) => p.sections.flatMap((s) => s.blocks))
      .find((b) => b.component === 'hero');
  delete hero.props.image;
  delete hero.props.action;
  const html = renderPage(spec, spec.pages[0].id);
  assert(!html.includes('undefined'));
  assert(html.includes('data-v="hero:standard"'));
  const nested = spec.pages.find((p) => p.path !== '/');
  assert(renderPage(spec, nested.id).includes('../catalog.css'));
  const source = await generateSite(spec, assets);
  assert.equal(GENERATOR_VERSION, '2.3.0');
  assert.equal(source.specSha256.length, 64);
});
test('CSS includes only used variants once in sorted order and keeps deterministic bundles', async () => {
  const spec = structuredClone(input.spec);
  for (const page of spec.pages)
    for (const section of page.sections)
      section.blocks = section.blocks.filter((b) => b.component !== 'gallery');
  // Keep valid nonempty sections by replacing removed gallery-only blocks with a fictional FAQ.
  for (const page of spec.pages)
    for (const section of page.sections)
      if (!section.blocks.length)
        section.blocks = [
          {
            id: section.id + '-faq',
            component: 'faq',
            variant: 'standard',
            props: {
              heading: 'Fictional question',
              items: [{ question: 'Why?', answer: 'Example.' }],
            },
          },
        ];
  const source = await generateSite(spec, assets),
    css = source.files['public/catalog.css'];
  assert(!css.includes('[data-v="gallery:standard"]'));
  assert(css.indexOf('faq:standard') < css.indexOf('feature-grid:standard'));
  assert.equal((css.match(/\[data-v="hero:standard"\] img/g) ?? []).length, 1);
  assert.deepEqual(
    source,
    await generateSite(structuredClone(spec), new Map(assets)),
  );
  const reordered = structuredClone(spec);
  reordered.tokens.colors = Object.fromEntries(
    Object.entries(reordered.tokens.colors).reverse(),
  );
  assert.deepEqual(source, await generateSite(reordered, new Map(assets)));
  const baseline = JSON.parse(
    await readFile(
      new URL('../test/fixtures/library-baseline.json', import.meta.url),
      'utf8',
    ),
  );
  const full = await generateSite(input.spec, assets);
  assert.equal(sha256(full.files['public/cms.js']), baseline.cmsSha256);
  for (const page of input.spec.pages)
    assert.equal(
      renderPage(input.spec, page.id)
        .replace(/ data-v="[a-z-]+:standard"/g, '')
        .replace(/>\s+</g, '><')
        .trim(),
      baseline.html[page.id],
    );
});

test('default boxed output retains exact PR #29 HTML, CSS, CMS and font bytes', async () => {
  const golden = JSON.parse(
    await readFile(new URL('./fixtures/boxed-2.1.json', import.meta.url)),
  );
  const source = await generateSite(input.spec, assets);
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

test('new package control labels and empty live regions are authoring contracts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'a2aviary-label-authoring-'));
  try {
    await cp(new URL('library', root), join(dir, 'library'), {
      recursive: true,
    });
    await cp(new URL('plans', root), join(dir, 'plans'), { recursive: true });
    const path = join(
        dir,
        'library/profile-card/variants/flip-3d/template.html',
      ),
      original = await readFile(path, 'utf8');
    for (const changed of [
      original.replace('{{flipLabel}}', ''),
      original.replace(
        '<p class="copy-status"></p>',
        '<p class="copy-status">{{name}}</p>',
      ),
      original.replace('{{flipLabel}}', '{{copyLabel}}'),
    ]) {
      await writeFile(path, changed);
      await assert.rejects(
        libraryArtifacts(dir),
        /controls\/messages require owner text|status must be initially empty|label must be required/,
      );
    }
    await writeFile(path, original);
    await libraryArtifacts(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
