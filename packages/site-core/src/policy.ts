import { collectionIds } from './collections.ts';
import { createHash } from 'node:crypto';
import legacy from '../../../plans/versions/web-simple/2.2.0.policy.json' with { type: 'json' };
import source from '../../../plans/web-simple.policy.json' with { type: 'json' };

export type Policy = typeof source;
export const defaultPolicy: Policy = source;
export const SUPPORTED_POLICY_VERSIONS: readonly string[] = Object.freeze(['2.2.0', '2.3.0']);
export function assertSupportedPolicyVersion(version: unknown): void {
  if (typeof version !== 'string' || !SUPPORTED_POLICY_VERSIONS.includes(version))
    throw new Error('policy_version_unsupported');
}
export function canonicalJson(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Not a finite JSON number');
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson((value as Record<string, unknown>)[key])).join(',') + '}';
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('Not a JSON value');
  return encoded;
}
export const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export function specDigest(spec: object): string {
  return sha256(canonicalJson(spec));
}

const kinds = new Set(['heading', 'shortCopy', 'image', 'link', 'richText', 'textItems', 'linkItems', 'imageItems', 'faqItems', 'links', ...collectionIds.map(id => id + 'Collection')]);
// Engine shape/capabilities are independent of the editable policy. Numeric limits
// remain exclusively in policy; unknown new rules cannot silently be ignored.
const rule = (kind: string) => ({ value: kind === 'number' ? 1 : kind === 'boolean' ? true : kind === 'strings' ? ['string'] : kind === 'numbers' ? [1] : 'string', rationale: 'shape' });
const rules = (keys: string, kind: string) => Object.fromEntries(keys.split(' ').map(k => [k, rule(kind)]));
const shape = {
  ...rules('planId version effectiveDate', 'string'),
  includes: { ...rules('capabilities cmsCollections excludes', 'strings'), ...rules('maxPages', 'number'), ...rules('ssl system404Counts', 'boolean'), ...rules('domain', 'string') },
  firstVersion: {
    ...rules('contractVersion', 'string'),
    structure: { ...rules('maxSectionsPerPage maxBlocksPerSection maxBlocksPerPage maxJsonBytes', 'number'), ...rules('idPattern pagePathPattern', 'string'), ...rules('reservedPaths', 'strings') },
    copy: rules('heading shortCopy paragraph richText label alt seoTitle seoDescription', 'number'),
    items: rules('grid faq', 'number'), components: {},
    designTokens: { ...rules('colorSlots fonts', 'strings'), ...rules('colorPattern', 'string'), ...rules('spacing radius', 'numbers'), ...rules('motion layout', 'strings') },
    navigation: { ...rules('maxPrimary maxFooter', 'number'), ...rules('externalSchemes', 'strings') },
    images: { ...rules('formats', 'strings'), ...rules('maxAssets maxBytes maxTotalBytes maxWidth maxHeight', 'number'), ...rules('animated altRequired', 'boolean'), ...rules('hash', 'string') },
    language: rule('string'),
    library: { ...rules('effects fonts', 'strings'), budgets: rules('variantCss effectCss behaviorJs pageCss pageJs fontFamilies fontFiles fontBytes components variants behaviors effects fonts gzipLevel', 'number') },
    approval: { ...rules('required previewRequired', 'boolean'), ...rules('digest', 'string') }
  },
  changes: { ...rules('perMonth', 'number'), ...rules('calendar countsWhen', 'string'), ...rules('rollover', 'boolean'), ...rules('operations doesNotCount', 'strings') }
};
const fixedProfile: Record<string, unknown> = {
  planId: 'web-simple', 'firstVersion.contractVersion': '2.3',
  'includes.capabilities': ['static-astro', 'pocketbase-cms'], 'includes.system404Counts': false,
  'includes.ssl': true, 'includes.domain': 'client-supplied',
  'includes.excludes': ['custom-backend', 'end-user-auth', 'checkout', 'research', 'ocr', 'image-editing', 'custom-script', 'custom-style', 'raw-html', 'arbitrary-component', 'uploaded-svg'],
  'includes.cmsCollections': collectionIds,
  'firstVersion.navigation.externalSchemes': ['https:', 'mailto:', 'tel:'], 'firstVersion.images.formats': ['webp'],
  'firstVersion.images.animated': false, 'firstVersion.images.altRequired': true, 'firstVersion.images.hash': 'sha256',
  'firstVersion.approval.required': true, 'firstVersion.approval.digest': 'sha256-sorted-json', 'firstVersion.approval.previewRequired': true,
  'changes.calendar': 'UTC', 'changes.rollover': false, 'changes.countsWhen': 'successfully-deployed-edit',
  'changes.operations': ['draft-edit'],
  'changes.doesNotCount': ['pocketbase-content-edit','validation-failure','quick-preview','unapproved-snapshot','retry','initial-deployment']
};
export function assertPolicy(input: unknown): asserts input is Policy {
  if ((input as Policy)?.version?.value === '2.2.0') {
    if (canonicalJson(input) !== canonicalJson(legacy)) throw new Error('Immutable legacy policy mismatch');
    return;
  }
  const fail = (path: string): never => { throw new Error('Unsupported or invalid policy at ' + path); };
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const visit = (actual: unknown, template: unknown, path: string): void => {
    if (!object(template) || !object(actual)) fail(path);
    const a = actual as Record<string, unknown>, t = template as Record<string, unknown>;
    if (path === '/firstVersion/components') {
      if (!Object.keys(a).length) fail(path);
      for (const [name, component] of Object.entries(a)) {
        if (!/^[a-z][a-z-]*$/.test(name) || !object(component) || Object.keys(component).sort().join() !== 'fields,rationale,variants') fail(path + '/' + name);
        const c = component as Record<string, unknown>;
        if (typeof c.rationale !== 'string' || !c.rationale.trim()) fail(path);
        visit(c.variants, rule('strings'), path + '/' + name + '/variants');
        if (!object(c.fields) || !Object.keys(c.fields).length) fail(path);
        for (const [key, f] of Object.entries(c.fields as Record<string, unknown>)) {
          if (!/^[a-z][a-zA-Z]*$/.test(key) || !object(f) || Object.keys(f).sort().join() !== 'kind,rationale,required' || !kinds.has(String(f.kind)) || typeof f.required !== 'boolean' || typeof f.rationale !== 'string' || !f.rationale.trim()) fail(path + '/' + name + '/fields/' + key);
        }
      }
      return;
    }
    if (Object.keys(a).sort().join() !== Object.keys(t).sort().join()) fail(path);
    if ('value' in t) {
      if (typeof a.rationale !== 'string' || !a.rationale.trim()) fail(path + '/rationale');
      if (Array.isArray(t.value)) {
        if (!Array.isArray(a.value) || (!a.value.length && path !== '/firstVersion/library/effects') || new Set(a.value).size !== a.value.length || a.value.some(v => typeof v !== typeof (t.value as unknown[])[0] || (typeof v === 'number' && (!Number.isSafeInteger(v) || v < 0)) || (typeof v === 'string' && !v.trim()))) fail(path + '/value');
      } else if (typeof a.value !== typeof t.value || (typeof a.value === 'number' && (!Number.isSafeInteger(a.value) || a.value < 1)) || (typeof a.value === 'string' && !a.value.trim())) fail(path + '/value');
      return;
    }
    for (const key of Object.keys(t)) visit(a[key], t[key], path + '/' + key);
  };
  assertSupportedPolicyVersion((input as Policy)?.version?.value);
  visit(input, shape, '');
  const p = input as Policy;
  if (p.firstVersion.library.budgets.gzipLevel.value !== 9) fail('/firstVersion/library/budgets/gzipLevel');
  if (!/^\d+\.\d+\.\d+$/.test(p.version.value) || !/^\d{4}-\d{2}-\d{2}$/.test(p.effectiveDate.value) || new Date(p.effectiveDate.value).toISOString().slice(0, 10) !== p.effectiveDate.value) fail('/version-or-effectiveDate');
  // The engine cannot advertise behavior it does not implement.
  for (const [path, supported] of Object.entries(fixedProfile)) {
    const lookup = (v: unknown) => path.split('.').reduce((o, k) => (o as Record<string, unknown>)[k], v) as { value: unknown };
    if (canonicalJson(lookup(p).value) !== canonicalJson(supported)) fail('/' + path.replaceAll('.', '/'));
  }
  for (const pattern of [p.firstVersion.structure.idPattern.value, p.firstVersion.structure.pagePathPattern.value, p.firstVersion.designTokens.colorPattern.value]) {
    if (!pattern.startsWith('^') || !pattern.endsWith('$')) fail('/patterns');
    new RegExp(pattern);
  }
}

/** Select only repository-pinned policies, never a client policy document. */
export function policyForVersion(version: string): Policy {
  assertSupportedPolicyVersion(version);
  return version === '2.2.0' ? legacy as Policy : defaultPolicy;
}
