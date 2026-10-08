import { Ajv, type ErrorObject } from 'ajv';
import type { Policy } from './policy.ts';
import { canonicalJson, defaultPolicy, sha256, specDigest } from './policy.ts';
import { generateContracts, type Schema } from './generator.ts';
import type { Asset, ChangeAccounting, Link, SiteSpec, ValidationError, ValidationResult } from './types.ts';
export type * from './types.ts';
export { specDigest, defaultPolicy } from './policy.ts';

const escape = (s: string) => s.replaceAll('~', '~0').replaceAll('/', '~1');
const failure = (path: string, rule: string, limit: unknown, suggestion: string, policyPath?: string): ValidationError => ({ path, rule, limit, suggestion, policyPath: policyPath ?? (rule.startsWith('change.') ? '/changes' : rule.startsWith('asset') ? '/firstVersion/images' : '/firstVersion/structure') });
const failed = <T>(errors: ValidationError[]): ValidationResult<T> => ({ ok: false, errors });
const caches = new Map<string, ReturnType<typeof compile>>();
function compile(policy: Policy) {
  const generated = generateContracts(policy);
  const ajv = new Ajv({ allErrors: true, strict: false, verbose: true });
  ajv.addFormat('site-link', (v: string) => {
    try {
      if (/[\s\u0000-\u001f\u007f\\]/u.test(v)) return false;
      const url = new URL(v);
      if (!policy.firstVersion.navigation.externalSchemes.value.includes(url.protocol) || url.username || url.password) return false;
      if (url.protocol === 'https:') return Boolean(url.hostname);
      if (url.protocol === 'mailto:') return /^[^\s@]+@[^\s@]+$/.test(url.pathname) && !url.search && !url.hash;
      return /^\+?[0-9()-]+$/.test(url.pathname) && !url.search && !url.hash;
    } catch { return false; }
  });
  return { site: ajv.compile(generated.siteSchema), change: ajv.compile(generated.changeSchema), asset: ajv.compile({ definitions: generated.siteSchema.definitions, $ref: '#/definitions/assets' }), ...generated };
}
function compiled(policy: Policy) {
  const key = sha256(canonicalJson(policy));
  let found = caches.get(key);
  if (!found) {
    found = compile(policy);
    // Bounded cache: callers select owner-reviewed policies, never client policy documents.
    if (caches.size >= 16) caches.delete(caches.keys().next().value!);
    caches.set(key, found);
  }
  return found;
}
function schemaErrors(errors: ErrorObject[], schema: Schema): ValidationError[] {
  return errors.filter(e => e.keyword !== 'if').map(e => {
    let path = e.instancePath;
    if (e.keyword === 'required') path += '/' + escape(e.params.missingProperty);
    if (e.keyword === 'additionalProperties') path += '/' + escape(e.params.additionalProperty);
    let node: any = schema, policyPath: string | undefined = e.parentSchema?.['x-policyPath'];
    for (const key of e.schemaPath.replace(/^#\//, '').split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'))) {
      node = node?.[key];
      if (node?.['x-policyPath']) policyPath = node['x-policyPath'];
    }
    return failure(path, 'schema.' + e.keyword, Object.values(e.params).length === 1 ? Object.values(e.params)[0] : e.params, `Correct this value: ${e.message ?? e.keyword}. Consult the generated schema.`, policyPath);
  });
}
function jsonBound(value: unknown, policy: Policy): ValidationError[] {
  try {
    const text = JSON.stringify(value);
    if (text === undefined) throw new Error();
    if (Buffer.byteLength(text) > policy.firstVersion.structure.maxJsonBytes.value) return [failure('', 'submission.bytes', policy.firstVersion.structure.maxJsonBytes.value, 'Reduce the JSON payload; send images separately.', '/firstVersion/structure/maxJsonBytes')];
    // Reject values which JSON would silently drop or coerce (including NaN).
    if (canonicalJson(value) !== canonicalJson(JSON.parse(text))) throw new Error();
    return [];
  } catch { return [failure('', 'submission.json', 'JSON values only', 'Supply a finite, serializable JSON document.')]; }
}

export function validateSiteSpec(input: unknown, policy: Policy = defaultPolicy): ValidationResult<SiteSpec> {
  const bounded = jsonBound(input, policy);
  if (bounded.length) return failed(bounded);
  const validators = compiled(policy);
  if (!validators.site(input)) return failed(schemaErrors(validators.site.errors!, validators.siteSchema));
  const spec = input as SiteSpec, errors: ValidationError[] = [];
  const add = (path: string, rule: string, limit: unknown, suggestion: string, policyPath?: string) => errors.push(failure(path, rule, limit, suggestion, policyPath));
  const unique = (ids: string[], paths: string[], scope: string) => {
    const seen = new Set<string>();
    ids.forEach((id, i) => { if (seen.has(id)) add(paths[i], 'reference.duplicate', 'unique within ' + scope, 'Choose a distinct stable identifier.'); seen.add(id); });
  };
  unique(spec.pages.map(p => p.id), spec.pages.map((_, i) => `/pages/${i}/id`), 'site pages');
  unique(spec.pages.map(p => p.path), spec.pages.map((_, i) => `/pages/${i}/path`), 'site paths');
  unique(spec.assets.map(a => a.id), spec.assets.map((_, i) => `/assets/${i}/id`), 'assets');
  const assetIds = new Set(spec.assets.map(a => a.id));
  const image = (id: string, path: string) => { if (!assetIds.has(id)) add(path, 'reference.asset', 'declared asset ID', 'Supply the prepared asset declaration and bytes, or change this reference.'); };
  const link = (l: Link, path: string) => {
    if ('pageId' in l) {
      const p = spec.pages.find(p => p.id === l.pageId);
      if (!p) add(path + '/pageId', 'reference.page', 'existing page ID', 'Link to an existing page.');
      else if (l.sectionId && !p.sections.some(s => s.id === l.sectionId)) add(path + '/sectionId', 'reference.section', 'section in target page', 'Link to an existing section on the referenced page.');
    }
  };
  for (const group of ['primary', 'footer'] as const) spec.navigation[group].forEach((l, i) => link(l, `/navigation/${group}/${i}`));
  for (const [pi, p] of spec.pages.entries()) {
    const pp = '/pages/' + pi;
    if (policy.firstVersion.structure.reservedPaths.value.some(v => p.path.startsWith(v))) add(pp + '/path', 'page.reserved', policy.firstVersion.structure.reservedPaths.value, 'Use a route outside system namespaces.', '/firstVersion/structure/reservedPaths');
    unique(p.sections.map(s => s.id), p.sections.map((_, i) => `${pp}/sections/${i}/id`), 'page sections');
    const blocks = p.sections.flatMap((s, si) => s.blocks.map((b, bi) => ({ b, path: `${pp}/sections/${si}/blocks/${bi}` })));
    unique(blocks.map(({ b }) => b.id), blocks.map(({ path }) => path + '/id'), 'page blocks');
    if (blocks.length > policy.firstVersion.structure.maxBlocksPerPage.value) add(pp + '/sections', 'page.blocks', policy.firstVersion.structure.maxBlocksPerPage.value, 'Reduce the total blocks on this page.', '/firstVersion/structure/maxBlocksPerPage');
    if (p.seo.socialImage) image(p.seo.socialImage, pp + '/seo/socialImage');
    for (const { b, path } of blocks) {
      const fields = (policy.firstVersion.components as Record<string, { fields: Record<string, { kind: string }> }>)[b.component].fields;
      for (const [key, field] of Object.entries(fields)) {
        const value = b.props[key], at = path + '/props/' + escape(key);
        if (value === undefined) continue;
        if (field.kind === 'image') image(value as string, at);
        if (field.kind === 'imageItems') (value as string[]).forEach((v, i) => image(v, at + '/' + i));
        if (field.kind === 'link') link(value as Link, at);
        if (field.kind === 'links') (value as Link[]).forEach((v, i) => link(v, at + '/' + i));
        if (field.kind === 'linkItems') (value as { link: Link }[]).forEach((v, i) => link(v.link, at + '/' + i + '/link'));
        if (field.kind.endsWith('Collection') && !spec.cms.collections.includes(value as string)) add(at, 'cms.binding', spec.cms.collections, 'Enable this allowed collection in cms.collections.', '/includes/cmsCollections');
        if (field.kind === 'richText') {
          const nodes = value as { text?: string; items?: string[] }[];
          const length = nodes.reduce((total, n) => total + [...(n.text ?? '')].length + (n.items ?? []).reduce((sum, t) => sum + [...t].length, 0), 0);
          if (length > policy.firstVersion.copy.richText.value) add(at, 'copy.richText', policy.firstVersion.copy.richText.value, 'Shorten the combined rich-text content.', '/firstVersion/copy/richText');
        }
      }
    }
  }
  const total = spec.assets.reduce((sum, a) => sum + a.bytes, 0);
  if (total > policy.firstVersion.images.maxTotalBytes.value) add('/assets', 'assets.totalBytes', policy.firstVersion.images.maxTotalBytes.value, 'Prepare a smaller asset bundle on the client side.', '/firstVersion/images/maxTotalBytes');
  return errors.length ? failed(errors) : { ok: true, value: structuredClone(spec) };
}

export async function validateAssets(declarations: unknown, buffers: ReadonlyMap<string, Uint8Array>, policy: Policy = defaultPolicy): Promise<ValidationResult<Asset[]>> {
  const v = compiled(policy);
  if (!v.asset(declarations)) return failed(schemaErrors(v.asset.errors!, { definitions: v.siteSchema.definitions }).map(e => ({ ...e, path: '/assets' + e.path })));
  const assets = declarations as Asset[], errors: ValidationError[] = [];
  const ids = new Set<string>();
  let total = 0;
  const { default: sharp } = await import('sharp');
  for (const [i, a] of assets.entries()) {
    const path = '/assets/' + i;
    if (ids.has(a.id)) errors.push(failure(path + '/id', 'reference.duplicate', 'unique asset IDs', 'Use a distinct asset ID.'));
    ids.add(a.id);
    const bytes = buffers.get(a.id);
    if (!bytes) { errors.push(failure(path, 'asset.missing', a.id, 'Supply bytes for this asset ID.')); continue; }
    total += bytes.byteLength;
    if (bytes.byteLength > policy.firstVersion.images.maxBytes.value) { errors.push(failure(path + '/bytes', 'asset.bytes', policy.firstVersion.images.maxBytes.value, 'Optimize the image on the client side.', '/firstVersion/images/maxBytes')); continue; }
    if (bytes.byteLength !== a.bytes) errors.push(failure(path + '/bytes', 'asset.bytesMismatch', bytes.byteLength, 'Declare the actual byte count.'));
    if (sha256(bytes) !== a.sha256) errors.push(failure(path + '/sha256', 'asset.hash', sha256(bytes), 'Declare SHA-256 of the exact supplied bytes.', '/firstVersion/images/hash'));
    const encoded = Buffer.from(bytes);
    // Reject non-raster input before any native parser sees SVG/XML or URLs.
    const magic = encoded.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : encoded[0] === 255 && encoded[1] === 216 && encoded[2] === 255 ? 'jpeg'
      : encoded.toString('ascii', 0, 4) === 'RIFF' && encoded.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : undefined;
    if (!magic) { errors.push(failure(path + '/format', 'asset.format', policy.firstVersion.images.formats.value, 'Supply an allowed raster file.', '/firstVersion/images/formats')); continue; }
    // APNG can otherwise decode as a single static PNG. Inspect chunk boundaries,
    // not arbitrary text inside pixels: https://www.w3.org/TR/png-3/#acTL-chunk
    let animated = false;
    if (magic === 'png') for (let offset = 8; offset + 12 <= encoded.length;) {
      const size = encoded.readUInt32BE(offset), kind = encoded.toString('ascii', offset + 4, offset + 8);
      if (offset + size + 12 > encoded.length) break;
      if (['acTL', 'fcTL', 'fdAT'].includes(kind)) animated = true;
      offset += size + 12;
    }
    if (magic === 'webp') for (let offset = 12; offset + 8 <= encoded.length;) {
      const size = encoded.readUInt32LE(offset + 4), kind = encoded.toString('ascii', offset, offset + 4);
      if (offset + size + 8 > encoded.length) break;
      if (kind === 'ANIM' || kind === 'ANMF' || (kind === 'VP8X' && size && (encoded[offset + 8] & 2))) animated = true;
      offset += 8 + size + (size % 2);
    }
    if (animated) { errors.push(failure(path, 'asset.animated', false, 'Supply a static image.', '/firstVersion/images/animated')); continue; }
    try {
      // Header checks precede full decoding. No output image is generated or persisted.
      const decoder = sharp(encoded, { limitInputPixels: policy.firstVersion.images.maxWidth.value * policy.firstVersion.images.maxHeight.value, failOn: 'warning' });
      const m = await decoder.metadata();
      if (!m.format || !policy.firstVersion.images.formats.value.includes(m.format)) { errors.push(failure(path + '/format', 'asset.format', policy.firstVersion.images.formats.value, 'Prepare an allowed raster image.', '/firstVersion/images/formats')); continue; }
      if (m.format !== a.format) errors.push(failure(path + '/format', 'asset.formatMismatch', m.format, 'Declare the actual encoded format.'));
      if ((m.pages ?? 1) !== 1) { errors.push(failure(path, 'asset.animated', false, 'Supply a static image.', '/firstVersion/images/animated')); continue; }
      if (!m.width || !m.height || m.width > policy.firstVersion.images.maxWidth.value || m.height > policy.firstVersion.images.maxHeight.value) {
        errors.push(failure(path, 'asset.dimensions', { width: policy.firstVersion.images.maxWidth.value, height: policy.firstVersion.images.maxHeight.value }, 'Resize on the client side.', '/firstVersion/images/maxWidth')); continue;
      }
      if (m.width !== a.width) errors.push(failure(path + '/width', 'asset.widthMismatch', m.width, 'Declare actual image width.'));
      if (m.height !== a.height) errors.push(failure(path + '/height', 'asset.heightMismatch', m.height, 'Declare actual image height.'));
      await decoder.raw().toBuffer();
    } catch { errors.push(failure(path, 'asset.decode', 'complete decodable raster', 'Prepare a valid, complete raster within the pixel limits.')); }
  }
  for (const id of buffers.keys()) if (!ids.has(id)) errors.push(failure('/assets', 'asset.extra', id, 'Remove undeclared bytes or declare the asset.'));
  if (total > policy.firstVersion.images.maxTotalBytes.value) errors.push(failure('/assets', 'assets.totalBytes', policy.firstVersion.images.maxTotalBytes.value, 'Prepare a smaller bundle on the client side.', '/firstVersion/images/maxTotalBytes'));
  return errors.length ? failed(errors) : { ok: true, value: structuredClone(assets) };
}

export function validateChangeRequest(..._args: unknown[]): ValidationResult<{ spec: SiteSpec; accounting: ChangeAccounting }> {
  return failed([failure('', 'change_requests_unavailable', null, 'Changes will use draft, preview and browser approval in a later release.')]);
}
