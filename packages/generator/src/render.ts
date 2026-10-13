import { catalog, boundCollectionIds, collectionDefinitions, SUPPORTED_POLICY_VERSIONS } from '@a2aviary/site-core';
import {
  selectedPackages,
  fontPackages,
  behaviorBundle,
  type LibraryCatalog,
} from '@a2aviary/site-core';
import type { LibraryContext } from '@a2aviary/site-core';
import type { LibraryVariant } from './library-template.ts';
import { library } from './library-data.ts';
import { interpretTemplate } from './library-template.ts';
import {
  canonicalJson,
  defaultPolicy,
  sha256,
  specDigest,
  type Policy,
} from '@a2aviary/site-core';
import {
  validateSiteSpec,
  validateAssets,
} from '@a2aviary/site-core';
import type {
  Block,
  Link,
  SiteSpec,
  ValidationError,
} from '@a2aviary/site-core';
import { normalizedDimensions } from './webp.ts';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';

export class SiteError extends Error {
  readonly code: string;
  readonly errors: ValidationError[];
  constructor(code: string, errors: ValidationError[] = []) {
    super(code);
    this.code = code;
    this.errors = errors;
  }
}
const escape = (v: unknown) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export const GENERATOR_VERSION = '2.3.0';
export interface SourceBundle {
  files: Record<string, string>;
  binaryFiles: Record<string, string>;
  specSha256: string;
  sourceSha256: string;
  cmsCollections: string[];
}

export async function generateSite(
  input: unknown,
  assets: ReadonlyMap<string, Uint8Array>,
  options: {
    serverNormalized?: boolean;
    test?: boolean;
    fixtureLibrary?: {
      catalog: LibraryCatalog;
      policy: Policy;
      variants: Record<string, LibraryVariant>;
    };
  } = {},
): Promise<SourceBundle> {
  if (!SUPPORTED_POLICY_VERSIONS.includes((input as SiteSpec)?.policyVersion))
    throw new SiteError('policy_version_unsupported');
  const activeCatalog = options.fixtureLibrary?.catalog ?? catalog;
  const activePolicy = options.fixtureLibrary?.policy ?? defaultPolicy;
  const context: LibraryContext = {
    test: options.test,
    catalog: activeCatalog,
  };
  const checked = validateSiteSpec(input, activePolicy, context);
  if (!checked.ok) throw new SiteError('invalid_spec', checked.errors);
  if (options.serverNormalized) {
    // Only the platform's isolated normalizer creates these declarations and bytes.
    // Recheck structure/hashes without re-entering a native decoder with controller secrets.
    if (assets.size !== checked.value.assets.length)
      throw new SiteError('invalid_assets');
    for (const asset of checked.value.assets) {
      const bytes = assets.get(asset.id);
      if (
        !bytes ||
        bytes.length !== asset.bytes ||
        sha256(bytes) !== asset.sha256
      )
        throw new SiteError('invalid_assets');
      try {
        const dimensions = normalizedDimensions(bytes);
        if (
          dimensions.width !== asset.width ||
          dimensions.height !== asset.height
        )
          throw Error();
      } catch {
        throw new SiteError('invalid_assets');
      }
    }
  } else {
    const checkedAssets = await validateAssets(
      checked.value.assets,
      assets,
      activePolicy,
    );
    if (!checkedAssets.ok)
      throw new SiteError('invalid_assets', checkedAssets.errors);
  }
  const spec = checked.value;
  const resource = new URL('./resources/', import.meta.url);
  const packageJson = await readFile(new URL('package.json', resource), 'utf8');
  const files: Record<string, string> = {
    'package.json': packageJson,
    'package-lock.json': await readFile(
      new URL('package-lock.json', resource),
      'utf8',
    ),
    'network-guard.mjs': await readFile(
      new URL('network-guard.mjs', resource),
      'utf8',
    ),
    'verify.mjs': await readFile(new URL('verify.mjs', resource), 'utf8'),
    'astro.config.mjs':
      "import {defineConfig} from 'astro/config'; export default defineConfig({output:'static',trailingSlash:'always',compressHTML:false,build:{format:'directory'}});\n",
    'public/catalog.css': css(spec, activeCatalog),
    'public/cms.js': cmsScript,
    'src/pages/404.astro':
      '<!doctype html><html lang="en"><head><title>Page not found</title><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body><main><h1>Page not found</h1><a href="./">Home</a></main></body></html>\n',
  };
  if (spec.shell) {
    const html = `<!doctype html><html lang="${escape(spec.language ?? 'en')}"><head><title>${escape(spec.shell.notFoundTitle)}</title><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body><main><h1>${escape(spec.shell.notFoundTitle)}</h1><p>${escape(spec.shell.notFoundText)}</p><a href="/">${escape(spec.shell.notFoundHomeLabel)}</a></main></body></html>\n`;
    // Supplied shell text is data, never Astro source (including literal braces).
    files['src/pages/404.astro'] =
      `---\nconst html = ${JSON.stringify(html)};\n---\n<Fragment set:html={html} />\n`;
  }
  if (spec.language)
    files['src/pages/404.astro'] = files['src/pages/404.astro'].replace(
      'lang="en"',
      `lang="${escape(spec.language)}"`,
    );
  for (const page of spec.pages) {
    const file =
      'src/pages/' +
      (page.path === '/' ? 'index' : page.path.slice(1, -1) + '/index') +
      '.astro';
    // Trusted renderer emits escaped data, never client-supplied Astro expressions.
    const html = renderPage(spec, page.id, options.fixtureLibrary);
    files[file] =
      `---\nconst html = ${JSON.stringify(html)};\n---\n<Fragment set:html={html} />\n`;
  }
  const binaryFiles: Record<string, string> = {};
  for (const asset of spec.assets)
    binaryFiles[
      `public/assets/${asset.sha256}.${asset.format === 'jpeg' ? 'jpg' : asset.format}`
    ] = Buffer.from(assets.get(asset.id)!).toString('base64');
  for (const font of fontPackages(spec, activeCatalog)) {
    for (const file of font.files!) {
      const output = font.files!.length === 1 ? font.id + '.woff2' : file.file;
      binaryFiles['public/fonts/' + output] = file.data!;
    }
    files['public/fonts/' + font.id + '-LICENSE.txt'] = font.license!;
  }
  const behaviors = selectedPackages(spec, activeCatalog).behaviors;
  if (behaviors.length)
    files['public/site.js'] = behaviorBundle(
      activeCatalog,
      behaviors,
      spec.tokens.motion ?? 'none',
    );
  files['verify.mjs'] =
    '// network-guard-sha256: ' +
    sha256(files['network-guard.mjs']) +
    '\n' +
    files['verify.mjs'];
  const specSha256 = specDigest(spec);
  const sourceSha256 = sha256(
    canonicalJson({
      version: GENERATOR_VERSION,
      policySha256: sha256(canonicalJson(activePolicy)),
      librarySha256: sha256(canonicalJson(activeCatalog)),
      files,
      binaryFiles,
    }),
  );
  return {
    files,
    binaryFiles,
    specSha256,
    sourceSha256,
    cmsCollections: boundCollections(spec),
  };
}

export function boundCollections(spec: SiteSpec): string[] {
  return boundCollectionIds(spec).sort();
}
export function renderPage(
  spec: SiteSpec,
  pageId: string,
  fixtureLibrary?: {
    catalog: LibraryCatalog;
    variants: Record<string, LibraryVariant>;
  },
): string {
  const activeCatalog = fixtureLibrary?.catalog ?? catalog,
    variants = fixtureLibrary?.variants ?? library;
  const page = spec.pages.find((p) => p.id === pageId);
  if (!page) throw new SiteError('page_not_found');
  const used = selectedPackages({ pages: [page] }, activeCatalog);
  const marker = (ids: string[] | undefined, target: string) => {
    const selected = (ids ?? []).filter(
      (id) => activeCatalog[id]?.target === target,
    );
    return selected.length ? ` data-fx="${selected.join(' ')}"` : '';
  };
  const root = '../'.repeat(page.path.split('/').filter(Boolean).length);
  const image = (id: string) => {
    const a = spec.assets.find((a) => a.id === id)!;
    return `<img src="${root}assets/${a.sha256}.${a.format === 'jpeg' ? 'jpg' : a.format}" alt="${escape(a.alt)}" width="${a.width}" height="${a.height}" loading="lazy">`;
  };
  const href = (l: Link) =>
    'url' in l
      ? l.url
      : spec.pages.find((p) => p.id === l.pageId)!.path +
        (l.sectionId ? '#' + l.sectionId : '');
  const link = (l: Link) =>
    `<a href="${escape('pageId' in l ? (posix.relative(page.path, href(l).split('#')[0]) ? posix.relative(page.path, href(l).split('#')[0]) + '/' : './') + (href(l).includes('#') ? '#' + href(l).split('#')[1] : '') : href(l))}">${escape(l.label)}</a>`;
  const render = (b: Block) => {
    const variant = variants[b.component + ':' + b.variant];
    if (!variant || variant.component !== b.component)
      throw new SiteError('out_of_catalog');
    const rendered = interpretTemplate(
      variant.ast,
      b.props,
      (name, value, field) => {
        if (name === 'image') return image(value as string);
        if (name === 'link') {
          const target = variant.targets?.action;
          const fx =
            target &&
            typeof target === 'object' &&
            'helper' in target &&
            target.field === field
              ? marker(b.effects, 'action')
              : '';
          return link(value as Link).replace('<a ', '<a' + fx + ' ');
        }
        if (name === 'links')
          return (
            '<ul>' +
            (value as Link[]).map((l) => '<li>' + link(l) + '</li>').join('') +
            '</ul>'
          );
        if (name === 'richText')
          return (
            value as Array<{ type: string; text?: string; items?: string[] }>
          )
            .map((n) =>
              n.type === 'paragraph'
                ? `<p>${escape(n.text)}</p>`
                : n.type === 'heading'
                  ? `<h2>${escape(n.text)}</h2>`
                  : `<ul>${n.items!.map((t) => `<li>${escape(t)}</li>`).join('')}</ul>`,
            )
            .join('');
        if (name === 'collection')
          return `<div data-collection="${escape(value)}" aria-live="polite"><p>${escape(b.props.emptyText)}</p></div>`;
        throw new SiteError('out_of_catalog');
      },
      (tag, role) => tag.slice(0, -1) + marker(b.effects, role) + '>',
    );
    return rendered.replace(
      /<(header|div|span|button|h[123]|p|ul|ol|li|details|summary)( class="([^"]*)")?>/g,
      (tag, name, _attr, classes = '') => {
        const tokens = classes.split(' '),
          targets = variant.targets ?? {};
        let attributes = name === 'button' ? ' type="button"' : '';
        if (
          targets.root &&
          typeof targets.root === 'string' &&
          tokens.includes(targets.root)
        )
          attributes += ` id="${b.id}-behavior" data-behavior="${variant.behaviors!.join(' ')}" data-motion="${spec.tokens.motion ?? 'none'}"`;
        if (
          targets.control &&
          typeof targets.control === 'string' &&
          tokens.includes(targets.control)
        )
          attributes += ` data-behavior-control hidden aria-controls="${b.id}-behavior"`;
        if (
          typeof targets.status === 'string' &&
          tokens.includes(targets.status)
        )
          attributes +=
            ' data-behavior-status aria-live="polite" aria-atomic="true"';
        if (
          typeof targets.messages === 'string' &&
          tokens.includes(targets.messages)
        )
          attributes += ' hidden';
        for (const role of ['items', 'action'])
          if (
            targets[role] &&
            typeof targets[role] === 'string' &&
            tokens.includes(targets[role] as string)
          )
            attributes += marker(b.effects, role);
        return tag.slice(0, -1) + attributes + '>';
      },
    );
  };
  const social = page.seo.socialImage
    ? spec.assets.find((a) => a.id === page.seo.socialImage)!
    : undefined;
  return `<!doctype html><html lang="${escape(spec.language ?? 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.seo.title)}</title><meta name="description" content="${escape(page.seo.description)}">${social ? `<meta property="og:image" content="${root}assets/${social.sha256}.${social.format === 'jpeg' ? 'jpg' : social.format}">` : ''}<link rel="stylesheet" href="${root}catalog.css"><script src="${root}cms.js" defer></script>${used.behaviors.length ? `<script src="${root}site.js" defer></script>` : ''}</head><body${spec.tokens.layout === 'flush' ? ' class="layout-flush"' : ''}><a class="skip" href="#main">${escape(spec.shell?.skipLink ?? 'Skip to content')}</a><nav aria-label="${escape(spec.shell?.primaryNavigationLabel ?? 'Primary')}">${spec.navigation.primary.map(link).join(' ')}</nav><main id="main">${page.sections.some((s) => s.blocks.some((b) => b.component === 'hero')) ? '' : '<h1>' + escape(page.seo.title) + '</h1>'}${page.sections.map((s) => `<section id="${s.id}"${marker(s.effects, 'section')}>${spec.tokens.layout === 'flush' ? '<div class="section-inner">' : ''}${s.blocks.map((b) => `<div id="${b.id}" data-component="${b.component}" data-v="${b.component}:${b.variant}"${marker(b.effects, 'block')}>${render(b)}</div>`).join('')}${spec.tokens.layout === 'flush' ? '</div>' : ''}</section>`).join('')}</main><footer><nav aria-label="${escape(spec.shell?.footerNavigationLabel ?? 'Footer')}">${spec.navigation.footer.map(link).join(' ')}</nav></footer></body></html>\n`;
}
export function css(
  spec: SiteSpec,
  activeCatalog: LibraryCatalog = catalog,
): string {
  const fonts: Record<string, string> = {
    Inter: 'Inter, sans-serif',
    'EB Garamond': '"EB Garamond", serif',
    'system-sans': 'system-ui, sans-serif',
    'system-serif': 'Georgia, serif',
    'system-mono': 'ui-monospace, SFMono-Regular, monospace',
  };
  for (const p of Object.values(activeCatalog))
    if (p.type === 'font')
      fonts[p.family!] =
        (p.family!.includes(' ') ? JSON.stringify(p.family) : p.family) +
        ', ' +
        p.fallback;
  const tokens = Object.entries(spec.tokens.colors)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `--color-${key}:${value}`)
    .concat([
      `--font-body:${fonts[spec.tokens.fonts.body]}`,
      `--font-heading:${fonts[spec.tokens.fonts.heading]}`,
      `--space:${spec.tokens.spacing}px`,
      `--radius:${spec.tokens.radius}px`,
      ...[4, 8, 12, 16, 24, 32, 48, 64, 96].map((n) => `--space-${n}:${n}px`),
    ])
    .join(';');
  const used = [
    ...new Set(
      spec.pages.flatMap((p) =>
        p.sections.flatMap((s) =>
          s.blocks.map((b) => b.component + ':' + b.variant),
        ),
      ),
    ),
  ].sort();
  const base = `:root{${tokens}}@font-face{font-family:Inter;src:url('fonts/inter.woff2') format('woff2');font-display:swap}@font-face{font-family:"EB Garamond";src:url('fonts/eb-garamond.woff2') format('woff2');font-display:swap}*{box-sizing:border-box}body{margin:0;background:var(--color-background);color:var(--color-text);font-family:var(--font-body);line-height:1.6}h1,h2,h3{font-family:var(--font-heading);line-height:1.2}a{color:var(--color-primary)}nav,main,footer{max-width:1120px;margin:auto;padding:var(--space)}section{margin:var(--space-32) 0;padding:var(--space-24);background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius)}a:focus-visible,summary:focus-visible{outline:3px solid var(--color-accent);outline-offset:4px}.skip{position:absolute;left:-10000px}.skip:focus{left:8px;top:8px;background:var(--color-background);padding:8px}footer{color:var(--color-muted)}\n`;
  const chosenFonts = fontPackages(spec, activeCatalog);
  const legacyFonts =
    chosenFonts
      .map((p) => p.id)
      .sort()
      .join(',') === 'eb-garamond,inter';
  const fontFaces = chosenFonts
    .map((f) =>
      f
        .files!.map(
          (file) =>
            `@font-face{font-family:${f.family!.includes(' ') ? JSON.stringify(f.family) : f.family};src:url('fonts/${f.files!.length === 1 ? f.id + '.woff2' : file.file}') format('woff2');font-display:swap;font-weight:${file.weight};font-style:${file.style}}`,
        )
        .join(''),
    )
    .join('');
  const baseCss = legacyFonts
    ? base
    : base
        .replace(/@font-face\{[^}]*\}/g, '')
        .replace('*{box-sizing', fontFaces + '*{box-sizing');
  const selected = selectedPackages(spec, activeCatalog);
  const packageCss = [...selected.variants, ...selected.effects]
    .map((id) => activeCatalog[id].css ?? '')
    .join('');
  const hasMotion = /(?:animation|transition)/.test(packageCss);
  const extras =
    (spec.tokens.layout === 'flush'
      ? '.layout-flush main{max-width:none;padding:0}.layout-flush main>h1{max-width:1120px;margin:auto;padding:var(--space)}.layout-flush section{margin:0;padding:0;border:0;border-radius:0}.layout-flush .section-inner{max-width:1120px;margin:auto;padding:var(--space)}'
      : '') +
    (spec.tokens.fonts.mono ||
    packageCss.includes('--font-mono') ||
    hasMotion ||
    selected.effects.length ||
    selected.behaviors.length
      ? `:root{--font-mono:${fonts[spec.tokens.fonts.mono ?? 'system-mono']};--motion-duration:${spec.tokens.motion === 'expressive' ? '0.6s' : spec.tokens.motion === 'subtle' ? '0.2s' : '0s'}}`
      : '');
  const effectCss = selected.effects
    .map((id) => activeCatalog[id].css ?? '')
    .join('');
  const amplitude =
    packageCss.includes('--motion-distance') ||
    packageCss.includes('--motion-angle')
      ? `:root{--motion-distance:${spec.tokens.motion === 'expressive' ? '16px' : spec.tokens.motion === 'subtle' ? '6px' : '0px'};--motion-angle:${spec.tokens.motion === 'expressive' ? '360deg' : spec.tokens.motion === 'subtle' ? '90deg' : '0deg'}}`
      : '';
  const fallbackCss = selected.behaviors.length
    ? '[data-behavior] .copy-fallback{display:block;width:100%;max-width:100%;padding:var(--space-12);background:var(--color-surface);color:var(--color-text);font-family:var(--font-mono);border:1px solid var(--color-border)}[data-behavior] .copy-fallback:focus{outline:3px solid var(--color-accent);outline-offset:4px}'
    : '';
  const disable =
    hasMotion ||
    selected.effects.length ||
    selected.behaviors.length ||
    spec.tokens.motion
      ? `${spec.tokens.motion && spec.tokens.motion !== 'none' ? '@media (prefers-reduced-motion: reduce){' : ''}[data-v],[data-v] *,[data-v]::before,[data-v]::after,[data-v] *::before,[data-v] *::after,[data-fx],[data-fx] *,[data-fx]::before,[data-fx]::after,[data-fx] *::before,[data-fx] *::after{animation:none!important;transition:none!important}${spec.tokens.motion && spec.tokens.motion !== 'none' ? '}' : ''}`
      : '';
  return (
    baseCss +
    used
      .map((id) => {
        if (!Object.hasOwn(activeCatalog, id))
          throw new SiteError('out_of_catalog');
        return activeCatalog[id].css;
      })
      .join('') +
    effectCss +
    extras +
    amplitude +
    fallbackCss +
    disable
  );
}
function collectionScript(): string {
  const display=collectionDefinitions[0].publicDisplay;
  const common=collectionDefinitions.every(d => JSON.stringify(d.publicDisplay) === JSON.stringify(display));
  const fields=Object.fromEntries(collectionDefinitions.map(d => [d.id,d.publicDisplay]));
  return `${common ? '' : 'const fields='+JSON.stringify(fields)+';'}const cmsBase=new URL('./',document.currentScript.src);for(const target of document.querySelectorAll('[data-collection]')){const collection=target.dataset.collection;fetch(new URL('api/cms/api/collections/'+encodeURIComponent(collection)+'/records?filter=published%3Dtrue&sort=-created&perPage=${defaultPolicy.firstVersion.items.grid.value}',cmsBase),{credentials:'omit'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!data.items?.length)return;const list=document.createElement('ul');for(const item of data.items){const li=document.createElement('li'),heading=document.createElement('h3'),copy=document.createElement('p');heading.textContent=${common ? 'item.'+display.headingField : 'item[fields[collection].headingField]'};copy.textContent=${common ? 'item.'+display.bodyField : 'item[fields[collection].bodyField]'};li.append(heading,copy);list.append(li)}target.replaceChildren(list)}).catch(()=>{})}\n`;
}
const cmsScript = collectionScript();
