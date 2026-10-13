import { assertSupportedPolicyVersion } from './policy.ts';
import { collections } from './collections-data.ts';
import type { SiteSpec } from './types.ts';
import { catalog } from './library-data.ts';

export { collections };
export interface CollectionDefinition {
  id: string;
  order: number;
  fields: readonly {
    name: string;
    type: 'text' | 'bool';
    required?: boolean;
    max?: number;
    editor: { label: string; control: 'input' | 'textarea' | 'checkbox' };
  }[];
  publicReadRules: { list: string; view: string };
  editorRules: { create: string; update: string; delete: string };
  editorRecordLabel: string;
  publicDisplay: { headingField: string; bodyField: string };
}
export const collectionIds = Object.keys(collections);
export const collectionDefinitions: readonly CollectionDefinition[] = Object.values(collections);
export function collectionDefinition(id: string) {
  if (!Object.hasOwn(collections, id)) throw new Error('collection_unsupported');
  return collections[id as keyof typeof collections];
}
// Encounter order is part of the existing Caddy output; render metadata sorts separately.
export function boundCollectionIds(spec: SiteSpec): string[] {
  assertSupportedPolicyVersion(spec.policyVersion);
  return [...new Set(spec.pages.flatMap(page => page.sections.flatMap(section =>
    section.blocks.flatMap(block => Object.entries(catalog[block.component]?.fields ?? {})
      .filter(([,field]) => field.kind.endsWith('Collection'))
      .map(([field]) => String(block.props[field]))
      .filter(id => collectionIds.includes(id)),
    ),
  )))];
}
