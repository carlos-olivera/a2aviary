import { assertPolicy, canonicalJson, sha256, type Policy } from './policy.ts';

export type Schema = Record<string, any>;
const ptr = (path: string) => path.split('/').map(s => s.replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
export const artifactDirectory = (policy: Policy): string => policy.version.value === '1.0.0' ? 'v1' : policy.version.value;
export function assertPolicySnapshot(policy: Policy, snapshot: unknown): void {
  if (canonicalJson(snapshot) !== canonicalJson(policy)) throw new Error('Policy version already has a different immutable snapshot; bump semver.');
}
export function generateContracts(policy: Policy) {
  assertPolicy(policy);
  const f = policy.firstVersion, s = f.structure, c = f.copy;
  const tag = (schema: Schema, policyPath: string): Schema => ({ ...schema, 'x-policyPath': policyPath });
  const obj = (properties: Schema, required = Object.keys(properties)): Schema => ({ type: 'object', additionalProperties: false, required, properties });
  const ref = (name: string): Schema => ({ $ref: '#/definitions/' + name });
  const str = (max: number, policyPath: string): Schema => tag({ type: 'string', minLength: 1, maxLength: max, pattern: '\\S' }, policyPath);
  const copy = (kind: keyof typeof c): Schema => str(c[kind].value, '/firstVersion/copy/' + kind);
  const id = tag({ type: 'string', pattern: s.idPattern.value }, '/firstVersion/structure/idPattern');
  const hash: Schema = { type: 'string', pattern: '^[a-f0-9]{64}$', 'x-policyPath': '/firstVersion/images/hash' };
  const arr = (items: Schema, max: number, path: string, min = 0): Schema => tag({ type: 'array', minItems: min, maxItems: max, items }, path);
  const defs: Schema = {};
  defs.link = { oneOf: [obj({ label: copy('label'), pageId: id, sectionId: id }, ['label', 'pageId']), obj({ label: copy('label'), url: { type: 'string', maxLength: s.maxJsonBytes.value, format: 'site-link', 'x-policyPath': '/firstVersion/navigation/externalSchemes' } })] };
  defs.textItem = obj({ heading: copy('heading'), text: copy('paragraph') });
  defs.richNode = { oneOf: [obj({ type: { const: 'paragraph' }, text: copy('paragraph') }), obj({ type: { const: 'heading' }, text: copy('heading') }), obj({ type: { const: 'list' }, items: arr(copy('paragraph'), f.items.grid.value, '/firstVersion/items/grid', 1) })] };
  const fieldSchema = (kind: string): Schema => {
    if (kind === 'heading' || kind === 'shortCopy') return copy(kind);
    if (kind === 'image') return id;
    if (kind === 'link') return ref('link');
    if (kind === 'richText') return arr(ref('richNode'), f.items.grid.value, '/firstVersion/items/grid', 1);
    if (kind === 'textItems') return arr(ref('textItem'), f.items.grid.value, '/firstVersion/items/grid', 1);
    if (kind === 'linkItems') return arr(obj({ heading: copy('heading'), text: copy('paragraph'), link: ref('link') }), f.items.grid.value, '/firstVersion/items/grid', 1);
    if (kind === 'imageItems') return arr(id, f.items.grid.value, '/firstVersion/items/grid', 1);
    if (kind === 'faqItems') return arr(obj({ question: copy('heading'), answer: copy('paragraph') }), f.items.faq.value, '/firstVersion/items/faq', 1);
    if (kind === 'links') return arr(ref('link'), f.items.grid.value, '/firstVersion/items/grid', 1);
    if (kind.endsWith('Collection')) return tag({ const: kind.slice(0, -10) }, '/includes/cmsCollections');
    throw new Error('Unsupported component field kind: ' + kind);
  };
  const components = Object.entries(f.components);
  defs.block = {
    ...obj({ id, component: tag({ enum: components.map(([name]) => name) }, '/firstVersion/components'), variant: { type: 'string' }, props: { type: 'object' } }),
    allOf: components.map(([name, component]) => ({
      if: { properties: { component: { const: name } }, required: ['component'] },
      then: { properties: {
        variant: tag({ enum: component.variants.value }, '/firstVersion/components/' + ptr(name) + '/variants'),
        props: tag(obj(Object.fromEntries(Object.entries(component.fields).map(([key, field]) => [key, fieldSchema(field.kind)])), Object.entries(component.fields).filter(([, field]) => field.required).map(([key]) => key)), '/firstVersion/components/' + ptr(name) + '/fields')
      } }
    }))
  };
  defs.section = obj({ id, blocks: arr(ref('block'), s.maxBlocksPerSection.value, '/firstVersion/structure/maxBlocksPerSection', 1) });
  defs.seo = obj({ title: copy('seoTitle'), description: copy('seoDescription'), socialImage: id }, ['title', 'description']);
  defs.page = obj({ id, path: tag({ type: 'string', pattern: s.pagePathPattern.value }, '/firstVersion/structure/pagePathPattern'), seo: ref('seo'), sections: arr(ref('section'), s.maxSectionsPerPage.value, '/firstVersion/structure/maxSectionsPerPage', 1) });
  defs.tokens = obj({
    colors: tag(obj(Object.fromEntries(f.designTokens.colorSlots.value.map(slot => [slot, tag({ type: 'string', pattern: f.designTokens.colorPattern.value }, '/firstVersion/designTokens/colorPattern')]))), '/firstVersion/designTokens/colorSlots'),
    fonts: obj({ heading: tag({ enum: f.designTokens.fonts.value }, '/firstVersion/designTokens/fonts'), body: tag({ enum: f.designTokens.fonts.value }, '/firstVersion/designTokens/fonts') }),
    spacing: tag({ enum: f.designTokens.spacing.value }, '/firstVersion/designTokens/spacing'), radius: tag({ enum: f.designTokens.radius.value }, '/firstVersion/designTokens/radius')
  });
  defs.navigation = obj({ primary: arr(ref('link'), f.navigation.maxPrimary.value, '/firstVersion/navigation/maxPrimary'), footer: arr(ref('link'), f.navigation.maxFooter.value, '/firstVersion/navigation/maxFooter') });
  defs.asset = obj({ id, format: tag({ enum: f.images.formats.value }, '/firstVersion/images/formats'), bytes: tag({ type: 'integer', minimum: 1, maximum: f.images.maxBytes.value }, '/firstVersion/images/maxBytes'), width: tag({ type: 'integer', minimum: 1, maximum: f.images.maxWidth.value }, '/firstVersion/images/maxWidth'), height: tag({ type: 'integer', minimum: 1, maximum: f.images.maxHeight.value }, '/firstVersion/images/maxHeight'), alt: copy('alt'), sha256: hash });
  defs.assets = arr(ref('asset'), f.images.maxAssets.value, '/firstVersion/images/maxAssets');
  defs.approval = tag(obj({ approved: { const: true }, approvedAt: { type: 'string', format: 'approval-time' }, specSha256: hash }), '/firstVersion/approval/required');
  defs.preview = obj({ artifactId: id, sha256: hash });
  const identity = { contractVersion: { const: f.contractVersion.value }, planId: { const: policy.planId.value }, policyVersion: { const: policy.version.value } };
  const provenance = { policyVersion: policy.version.value, policySha256: sha256(canonicalJson(policy)) };
  const schema = (name: string, body: Schema): Schema => ({ $schema: 'http://json-schema.org/draft-07/schema#', $id: `https://a2aviary.io/contracts/site/${policy.version.value}/${name}`, ...body, definitions: defs, 'x-provenance': provenance });
  const siteSchema = schema('site-spec-v1', obj({ ...identity, pages: arr(ref('page'), policy.includes.maxPages.value, '/includes/maxPages', 1), tokens: ref('tokens'), navigation: ref('navigation'), assets: ref('assets'), cms: obj({ collections: tag({ type: 'array', uniqueItems: true, items: { enum: policy.includes.cmsCollections.value } }, '/includes/cmsCollections') }), approval: ref('approval'), preview: ref('preview') }, [...Object.keys(identity), 'pages', 'tokens', 'navigation', 'assets', 'cms', 'approval']));
  const operationShapes: Record<string, Schema> = {
    'add-block': { pageId: id, sectionId: id, index: { type: 'integer', minimum: 0, maximum: s.maxBlocksPerSection.value }, block: ref('block') },
    'update-block': { pageId: id, sectionId: id, blockId: id, block: ref('block') },
    'remove-block': { pageId: id, sectionId: id, blockId: id },
    'add-page': { page: ref('page') }, 'update-page-seo': { pageId: id, seo: ref('seo') },
    'update-tokens': { tokens: ref('tokens') }, 'update-navigation': { navigation: ref('navigation') }
  };
  defs.operation = {
    type: 'object', required: ['op'], properties: { op: tag({ enum: policy.changes.operations.value }, '/changes/operations') },
    allOf: policy.changes.operations.value.map(op => ({ if: { properties: { op: { const: op } }, required: ['op'] }, then: obj({ op: { const: op }, ...operationShapes[op] }) }))
  };
  const changeSchema = schema('change-request-v1', obj({ ...identity, baseSpecSha256: hash, operations: arr(ref('operation'), policy.changes.maxOperations.value, '/changes/maxOperations', 1), assets: ref('assets'), approval: ref('approval'), preview: ref('preview') }, [...Object.keys(identity), 'baseSpecSha256', 'operations', 'assets', 'approval']));
  return { siteSchema, changeSchema, provenance };
}

export function flattenRules(policy: Policy): { path: string; value: unknown; rationale: string }[] {
  const rows: { path: string; value: unknown; rationale: string }[] = [];
  const visit = (value: any, path: string) => {
    if (value && typeof value === 'object' && 'value' in value) rows.push({ path, value: value.value, rationale: value.rationale });
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) visit(child, path + '/' + key);
  };
  visit(policy, '');
  return rows;
}
