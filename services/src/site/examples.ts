import type { Policy } from './policy.ts';
import { specDigest } from './policy.ts';
import type { Asset, Block, ChangeRequest, SiteSpec } from './types.ts';

export function makeExamples(policy: Policy, asset: Asset) {
  const f = policy.firstVersion;
  const text = (s: string, kind: keyof typeof f.copy) => [...s].slice(0, f.copy[kind].value).join('');
  const link = { label: text('Explore', 'label'), pageId: 'home' };
  const exampleValue = (kind: string): unknown => {
    if (kind === 'heading') return text('Fictional neighborhood guide', 'heading');
    if (kind === 'shortCopy') return text('Prepared by a fictional client for this offline example.', 'shortCopy');
    if (kind === 'image') return asset.id;
    if (kind === 'link') return link;
    if (kind === 'links') return [link];
    if (kind === 'imageItems') return [asset.id];
    if (kind === 'richText') return [{ type: 'paragraph', text: [...'Fictional community information.'].slice(0, Math.min(f.copy.paragraph.value, f.copy.richText.value)).join('') }];
    if (kind === 'textItems') return [{ heading: text('A prepared step', 'heading'), text: text('Use supplied facts.', 'paragraph') }];
    if (kind === 'linkItems') return [{ heading: text('Explore a neighborhood', 'heading'), text: text('An offline example.', 'paragraph'), link }];
    if (kind === 'faqItems') return [{ question: text('How do we start?', 'heading'), answer: text('Prepare the materials and approve the result.', 'paragraph') }];
    if (kind.endsWith('Collection')) return kind.slice(0, -10);
    throw new Error('Missing example field kind: ' + kind);
  };
  const block = (name: string, id: string): Block => {
    const definition = (f.components as Record<string, { variants: { value: string[] }; fields: Record<string, { kind: string }> }>)[name];
    return { id, component: name, variant: definition.variants.value[0], props: Object.fromEntries(Object.entries(definition.fields).map(([key, field]) => [key, exampleValue(field.kind)])) };
  };
  const names = Object.keys(f.components), count = Math.min(7, policy.includes.maxPages.value);
  const pageNames = ['home', 'about', 'north', 'south', 'west', 'privacy', 'contact'];
  const spec: SiteSpec = {
    contractVersion: f.contractVersion.value, planId: policy.planId.value, policyVersion: policy.version.value,
    pages: pageNames.slice(0, count).map((id, i) => ({ id, path: i === 0 ? '/' : '/' + id + '/', seo: { title: text('Fictional guide — ' + id, 'seoTitle'), description: text('Offline demonstration using fictional content and original generated pixels.', 'seoDescription') }, sections: (i === 0 ? names.slice(0, Math.min(f.structure.maxSectionsPerPage.value, f.structure.maxBlocksPerPage.value)) : [names[i % names.length]]).map((name, j) => ({ id: 'section-' + j, blocks: [block(name, 'block-' + j)] })) })),
    tokens: { colors: Object.fromEntries(f.designTokens.colorSlots.value.map((slot, i) => [slot, ['#FAFAFA', '#EEEEEE', '#222222', '#555555', '#334455', '#557799', '#CCCCCC'][i % 7]])), fonts: { heading: f.designTokens.fonts.value[0], body: f.designTokens.fonts.value[0] }, spacing: f.designTokens.spacing.value[0], radius: f.designTokens.radius.value[0] },
    navigation: { primary: [link], footer: [link] }, assets: [asset], cms: { collections: policy.includes.cmsCollections.value },
    approval: { approved: true, approvedAt: '2026-10-06T12:00:00.000Z', specSha256: '' }
  };
  spec.approval.specSha256 = specDigest(spec);
  const changed = structuredClone(spec), replacement = structuredClone(spec.pages[0].sections[0].blocks[0]);
  const firstField = Object.entries((f.components as Record<string, { fields: Record<string, { kind: string }> }>)[replacement.component].fields).find(([, v]) => v.kind === 'heading');
  if (!firstField) throw new Error('Example requires a heading field on the first catalog component');
  replacement.props[firstField[0]] = text('A revised fictional welcome', 'heading');
  changed.pages[0].sections[0].blocks[0] = replacement;
  const change: ChangeRequest = { contractVersion: spec.contractVersion, planId: spec.planId, policyVersion: spec.policyVersion, baseSpecSha256: specDigest(spec), operations: [{ op: 'update-block', pageId: 'home', sectionId: 'section-0', blockId: 'block-0', block: replacement }], assets: [], approval: { ...spec.approval, specSha256: specDigest(changed) } };
  return { spec, change };
}
