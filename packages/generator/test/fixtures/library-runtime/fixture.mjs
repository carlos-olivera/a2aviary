// Fictional packages exist only in a temporary test catalog, never the release catalog.
import { mkdtemp, cp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function runtimeFixture(sourceRoot, libraryArtifacts) {
  const root = await mkdtemp(join(tmpdir(), 'a2aviary-library-'));
  try {
    await cp(join(sourceRoot, 'library'), join(root, 'library'), {
      recursive: true,
    });
    const policy = JSON.parse(
      await readFile(join(sourceRoot, 'plans/web-simple.policy.json')),
    );
    const files = {
      'hero/variants/interactive/variant.json': {
        id: 'hero:interactive',
        type: 'variant',
        version: '1.0.0',
        status: 'experimental',
        component: 'hero',
        variant: 'interactive',
        behaviors: ['fixture-toggle'],
        targets: {
          root: 'fixture-root',
          control: 'fixture-control',
          action: 'fixture-action',
        },
        purpose: 'Fictional disclosure enhancement.',
      },
      'hero/variants/interactive/template.html':
        '<div class="fixture-root"><h1>{{heading}}</h1><p>{{text}}</p><button class="fixture-control">Toggle note</button><p class="fixture-note">Fictional optional note</p><span class="fixture-action">Fictional action target</span></div>',
      'hero/variants/interactive/style.css':
        '[data-v="hero:interactive"] .fixture-control{cursor:pointer}',
      'hero/variants/interactive/fixtures/default.json': {
        id: 'fictional-hero',
        component: 'hero',
        variant: 'interactive',
        props: {
          heading: 'Fictional example',
          text: 'All content is illustrative.',
        },
      },
      'feature-grid/variants/items/variant.json': {
        id: 'feature-grid:items',
        type: 'variant',
        version: '1.0.0',
        status: 'experimental',
        component: 'feature-grid',
        variant: 'items',
        behaviors: [],
        targets: { items: 'fixture-item' },
        purpose: 'Fictional repeated effect targets.',
      },
      'feature-grid/variants/items/template.html':
        '<div><h2>{{heading}}</h2>{{#each items}}<div class="fixture-item"><h3>{{heading}}</h3><p>{{text}}</p></div>{{/each}}</div>',
      'feature-grid/variants/items/style.css': '',
      'feature-grid/variants/items/fixtures/default.json': {
        id: 'fictional-items',
        component: 'feature-grid',
        variant: 'items',
        props: {
          heading: 'Fictional steps',
          items: [{ heading: 'One', text: 'Illustrative content.' }],
        },
      },
      'behaviors/fixture-toggle/behavior.json': {
        id: 'fixture-toggle',
        type: 'behavior',
        version: '1.0.0',
        status: 'experimental',
        purpose: 'Fictional keyboard-operable disclosure.',
      },
      'behaviors/fixture-toggle/index.js': `export default (element, context) => { const control = element.querySelector('.fixture-control'); const note = element.querySelector('.fixture-note'); control.setAttribute('aria-expanded', 'true'); control.addEventListener('click', event => { note.hidden = !note.hidden; control.setAttribute('aria-expanded', note.hidden ? 'false' : 'true'); }); };`,
    };
    files['behaviors/fixture-failure/behavior.json'] = {
      id: 'fixture-failure',
      type: 'behavior',
      version: '1.0.0',
      status: 'experimental',
      purpose: 'Fictional initialization failure to verify isolation.',
    };
    files['behaviors/fixture-failure/index.js'] =
      "export default (element, context) => { const missing = element.querySelector('.missing'); missing.hidden = true; };";
    files['hero/variants/failing/variant.json'] = {
      ...files['hero/variants/interactive/variant.json'],
      id: 'hero:failing',
      variant: 'failing',
      behaviors: ['fixture-failure'],
    };
    files['hero/variants/failing/template.html'] =
      files['hero/variants/interactive/template.html'];
    files['hero/variants/failing/style.css'] = '';
    files['hero/variants/failing/fixtures/default.json'] = {
      ...files['hero/variants/interactive/fixtures/default.json'],
      id: 'fictional-failure',
      variant: 'failing',
    };
    policy.firstVersion.components.hero.variants.value.push('failing');
    for (const [id, target, compatibility] of [
      ['fixture-glow', 'section', []],
      ['fixture-pulse', 'block', ['hero:interactive']],
      ['fixture-items', 'items', ['feature-grid:items']],
      ['fixture-action', 'action', ['hero:interactive']],
    ]) {
      files[`effects/${id}/effect.json`] = {
        id,
        type: 'effect',
        version: '1.0.0',
        status: 'experimental',
        target,
        compatibility,
        purpose: 'Fictional ' + target + ' effect.',
      };
      files[`effects/${id}/style.css`] =
        target === 'section'
          ? `[data-fx~="${id}"]{background:linear-gradient(90deg,var(--color-surface),var(--color-background))}`
          : target === 'block'
            ? `@keyframes pkg-${id}-pulse{from{opacity:0.8}to{opacity:1}}[data-fx~="${id}"]{animation:pkg-${id}-pulse 1s linear infinite}@media (prefers-reduced-motion: reduce){[data-fx~="${id}"]{animation:none}}`
            : `[data-fx~="${id}"]{position:relative}`;
      files[`effects/${id}/fixtures/default.json`] = {
        component: target === 'items' ? 'feature-grid' : 'hero',
        variant: target === 'items' ? 'items' : 'interactive',
      };
      policy.firstVersion.library.effects.value.push(id);
    }
    policy.firstVersion.components.hero.variants.value.push('interactive');
    policy.firstVersion.components['feature-grid'].variants.value.push('items');
    for (const [path, value] of Object.entries(files)) {
      const dest = join(root, 'library', path);
      await mkdir(join(dest, '..'), { recursive: true });
      await writeFile(
        dest,
        typeof value === 'string'
          ? value
          : JSON.stringify(value, null, 2) + '\n',
      );
    }
    await mkdir(join(root, 'plans/versions/web-simple'), { recursive: true });
    for (const path of [
      'plans/web-simple.policy.json',
      'plans/versions/web-simple/2.1.0.policy.json',
    ])
      await writeFile(join(root, path), JSON.stringify(policy));
    const output = await libraryArtifacts(root);
    return {
      ...output,
      policy,
      root,
      close: () => rm(root, { recursive: true, force: true }),
    };
  } catch (e) {
    await rm(root, { recursive: true, force: true });
    throw e;
  }
}
