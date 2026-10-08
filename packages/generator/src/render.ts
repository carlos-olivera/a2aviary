import {
  canonicalJson,
  defaultPolicy,
  sha256,
  specDigest,
} from '../../../services/src/site/policy.ts';
import {
  validateSiteSpec,
  validateAssets,
} from '../../../services/src/site/validator.ts';
import type {
  Block,
  Link,
  SiteSpec,
  ValidationError,
} from '../../../services/src/site/types.ts';
import { normalizedDimensions } from './webp.ts';
import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { createRequire } from 'node:module';

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
export const GENERATOR_VERSION = '2.0.0';
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
  options: { serverNormalized?: boolean } = {},
): Promise<SourceBundle> {
  const checked = validateSiteSpec(input);
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
    const checkedAssets = await validateAssets(checked.value.assets, assets);
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
    'verify.mjs': await readFile(new URL('verify.mjs', resource), 'utf8'),
    'astro.config.mjs':
      "import {defineConfig} from 'astro/config'; export default defineConfig({output:'static',trailingSlash:'always',compressHTML:false,build:{format:'directory'}});\n",
    'public/catalog.css': css(spec),
    'public/cms.js': cmsScript,
    'src/pages/404.astro':
      '<!doctype html><html lang="en"><head><title>Page not found</title><meta name="viewport" content="width=device-width,initial-scale=1" /></head><body><main><h1>Page not found</h1><a href="./">Home</a></main></body></html>\n',
  };
  for (const page of spec.pages) {
    const file =
      'src/pages/' +
      (page.path === '/' ? 'index' : page.path.slice(1, -1) + '/index') +
      '.astro';
    // Trusted renderer emits escaped data, never client-supplied Astro expressions.
    const html = renderPage(spec, page.id);
    files[file] =
      `---\nconst html = ${JSON.stringify(html)};\n---\n<Fragment set:html={html} />\n`;
  }
  const binaryFiles: Record<string, string> = {};
  for (const asset of spec.assets)
    binaryFiles[
      `public/assets/${asset.sha256}.${asset.format === 'jpeg' ? 'jpg' : asset.format}`
    ] = Buffer.from(assets.get(asset.id)!).toString('base64');
  const require = createRequire(import.meta.url);
  for (const [packageName, file, output] of [
    ['inter', 'inter-latin-400-normal.woff2', 'inter'],
    ['eb-garamond', 'eb-garamond-latin-400-normal.woff2', 'eb-garamond'],
  ]) {
    binaryFiles['public/fonts/' + output + '.woff2'] = (
      await readFile(
        require.resolve('@fontsource/' + packageName + '/files/' + file),
      )
    ).toString('base64');
    files['public/fonts/' + output + '-LICENSE.txt'] = await readFile(
      require.resolve('@fontsource/' + packageName + '/LICENSE'),
      'utf8',
    );
  }
  const specSha256 = specDigest(spec);
  const sourceSha256 = sha256(
    canonicalJson({
      version: GENERATOR_VERSION,
      policySha256: sha256(canonicalJson(defaultPolicy)),
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
  return [
    ...new Set(
      spec.pages.flatMap((p) =>
        p.sections.flatMap((s) =>
          s.blocks
            .filter((b) =>
              ['catalog', 'blog', 'announcements'].includes(b.component),
            )
            .map((b) => String(b.props.collection)),
        ),
      ),
    ),
  ].sort();
}
export function renderPage(spec: SiteSpec, pageId: string): string {
  const page = spec.pages.find((p) => p.id === pageId);
  if (!page) throw new SiteError('page_not_found');
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
    const p = b.props as any,
      heading = p.heading ? `<h2>${escape(p.heading)}</h2>` : '';
    switch (b.component) {
      case 'hero':
        return `<header class="hero"><h1>${escape(p.heading)}</h1><p>${escape(p.text)}</p>${p.image ? image(p.image) : ''}${p.action ? link(p.action) : ''}</header>`;
      case 'rich-text':
        return p.content
          .map((n: any) =>
            n.type === 'paragraph'
              ? `<p>${escape(n.text)}</p>`
              : n.type === 'heading'
                ? `<h2>${escape(n.text)}</h2>`
                : `<ul>${n.items.map((t: string) => `<li>${escape(t)}</li>`).join('')}</ul>`,
          )
          .join('');
      case 'feature-grid':
      case 'steps':
        return (
          heading +
          `<${b.component === 'steps' ? 'ol' : 'ul'} class="grid">${p.items.map((i: any) => `<li><h3>${escape(i.heading)}</h3><p>${escape(i.text)}</p></li>`).join('')}</${b.component === 'steps' ? 'ol' : 'ul'}>`
        );
      case 'link-cards':
        return (
          heading +
          `<ul class="grid">${p.items.map((i: any) => `<li><h3>${escape(i.heading)}</h3><p>${escape(i.text)}</p>${link(i.link)}</li>`).join('')}</ul>`
        );
      case 'gallery':
        return (
          heading + `<div class="grid">${p.images.map(image).join('')}</div>`
        );
      case 'faq':
        return (
          heading +
          p.items
            .map(
              (i: any) =>
                `<details><summary>${escape(i.question)}</summary><p>${escape(i.answer)}</p></details>`,
            )
            .join('')
        );
      case 'cta':
        return heading + `<p>${escape(p.text)}</p>` + link(p.action);
      case 'contact':
        return (
          heading +
          `<p>${escape(p.text)}</p><ul>${p.links.map((l: Link) => `<li>${link(l)}</li>`).join('')}</ul>`
        );
      case 'catalog':
      case 'blog':
      case 'announcements':
        return (
          heading +
          `<div data-collection="${escape(p.collection)}" aria-live="polite"><p>${escape(p.emptyText)}</p></div>`
        );
      default:
        throw new SiteError('out_of_catalog');
    }
  };
  const social = page.seo.socialImage
    ? spec.assets.find((a) => a.id === page.seo.socialImage)!
    : undefined;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(page.seo.title)}</title><meta name="description" content="${escape(page.seo.description)}">${social ? `<meta property="og:image" content="${root}assets/${social.sha256}.${social.format === 'jpeg' ? 'jpg' : social.format}">` : ''}<link rel="stylesheet" href="${root}catalog.css"><script src="${root}cms.js" defer></script></head><body><a class="skip" href="#main">Skip to content</a><nav aria-label="Primary">${spec.navigation.primary.map(link).join(' ')}</nav><main id="main">${page.sections.some((s) => s.blocks.some((b) => b.component === 'hero')) ? '' : '<h1>' + escape(page.seo.title) + '</h1>'}${page.sections.map((s) => `<section id="${s.id}">${s.blocks.map((b) => `<div id="${b.id}" data-component="${b.component}">${render(b)}</div>`).join('')}</section>`).join('')}</main><footer><nav aria-label="Footer">${spec.navigation.footer.map(link).join(' ')}</nav></footer></body></html>\n`;
}
function css(spec: SiteSpec): string {
  const c = spec.tokens.colors,
    fonts: Record<string, string> = {
      Inter: 'Inter, sans-serif',
      'EB Garamond': '"EB Garamond", serif',
      'system-sans': 'system-ui, sans-serif',
      'system-serif': 'Georgia, serif',
    };
  return `@font-face{font-family:Inter;src:url('fonts/inter.woff2') format('woff2');font-display:swap}@font-face{font-family:"EB Garamond";src:url('fonts/eb-garamond.woff2') format('woff2');font-display:swap}*{box-sizing:border-box}body{margin:0;background:${c.background};color:${c.text};font-family:${fonts[spec.tokens.fonts.body]};line-height:1.6}h1,h2,h3{font-family:${fonts[spec.tokens.fonts.heading]};line-height:1.2}a{color:${c.primary}}nav,main,footer{max-width:1120px;margin:auto;padding:${spec.tokens.spacing}px}section{margin:32px 0;padding:24px;background:${c.surface};border:1px solid ${c.border};border-radius:${spec.tokens.radius}px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:24px;list-style:none;padding:0}.grid li{padding:16px}img{display:block;max-width:100%;height:auto}summary{cursor:pointer}a:focus-visible,summary:focus-visible{outline:3px solid ${c.accent};outline-offset:4px}.skip{position:absolute;left:-10000px}.skip:focus{left:8px;top:8px;background:${c.background};padding:8px}footer{color:${c.muted}}\n`;
}
const cmsScript = `const cmsBase=new URL('./',document.currentScript.src);for(const target of document.querySelectorAll('[data-collection]')){const collection=target.dataset.collection;fetch(new URL('api/cms/api/collections/'+encodeURIComponent(collection)+'/records?filter=published%3Dtrue&sort=-created&perPage=${defaultPolicy.firstVersion.items.grid.value}',cmsBase),{credentials:'omit'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(data=>{if(!data.items?.length)return;const list=document.createElement('ul');for(const item of data.items){const li=document.createElement('li'),heading=document.createElement('h3'),copy=document.createElement('p');heading.textContent=item.title;copy.textContent=item.body;li.append(heading,copy);list.append(li)}target.replaceChildren(list)}).catch(()=>{})}\n`;
