import { Ajv } from 'ajv';
import { generateContracts } from '@a2aviary/generator';
import {
  canonicalJson,
  defaultPolicy,
  SiteError,
  validateSiteSpec,
  type SiteSpec,
  type ValidationError,
} from '@a2aviary/generator';
export type DraftContent = Partial<
  Omit<SiteSpec, 'contractVersion' | 'planId' | 'policyVersion'>
> & { pages: any[]; assets: any[] };
export const identity = () => ({
  contractVersion: '2.0',
  planId: defaultPolicy.planId.value,
  policyVersion: defaultPolicy.version.value,
});
const schema = structuredClone(generateContracts(defaultPolicy).siteSchema);
function partial(value: any) {
  if (!value || typeof value !== 'object') return;
  delete value.required;
  delete value.minItems;
  for (const child of Object.values(value))
    if (Array.isArray(child)) child.forEach(partial);
    else partial(child);
}
partial(schema);
const ajv = new Ajv({ allErrors: true, strict: false, verbose: true });
ajv.addFormat('site-link', (s: string) => {
  try {
    const u = new URL(s);
    return (
      !/[\s\u0000-\u001f\\]/u.test(s) &&
      !u.username &&
      !u.password &&
      (u.protocol === 'https:' ||
        (u.protocol === 'mailto:' &&
          !u.search &&
          !u.hash &&
          /^[^\s@]+@[^\s@]+$/.test(u.pathname)) ||
        (u.protocol === 'tel:' && /^\+?[0-9()-]+$/.test(u.pathname)))
    );
  } catch {
    return false;
  }
});
const validate = ajv.compile(schema);
export const problem = (
  path: string,
  rule: string,
  limit: unknown,
  actual: unknown,
  suggestion: string,
): ValidationError => ({
  path,
  rule,
  limit,
  actual:
    typeof actual === 'string' && actual.length > 120
      ? { characters: [...actual].length }
      : actual && typeof actual === 'object'
        ? Array.isArray(actual)
          ? { items: actual.length }
          : { keys: Object.keys(actual).slice(0, 20) }
        : (actual ?? null),
  suggestion,
});
export function validateDraft(content: DraftContent): ValidationError[] {
  const spec = { ...identity(), ...content },
    errors: ValidationError[] = [];
  if (!validate(spec))
    for (const e of validate.errors ?? [])
      errors.push(
        problem(
          e.instancePath +
            (e.params.additionalProperty
              ? '/' + e.params.additionalProperty
              : ''),
          'schema.' + e.keyword,
          e.params,
          e.data,
          e.message ?? 'Correct this value.',
        ),
      );
  // Budget traversal assumes schema-shaped containers. Return structured errors
  // before inspecting malformed nested values such as null sections or props.
  if (errors.length) return errors.slice(0, 20);
  const bytes = Buffer.byteLength(canonicalJson(spec));
  if (bytes > 262144)
    errors.push(problem('', 'draft.bytes', 262144, bytes, 'Reduce content.'));
  const unique = (ids: any[], path: string) => {
    if (
      new Set(ids.filter((v) => v !== undefined)).size !==
      ids.filter((v) => v !== undefined).length
    )
      errors.push(
        problem(
          path,
          'reference.duplicate',
          'unique IDs',
          ids,
          'Use distinct stable IDs.',
        ),
      );
  };
  unique(
    content.pages.map((p) => p.id),
    '/pages',
  );
  unique(
    content.pages.map((p) => p.path),
    '/pages/path',
  );
  unique(
    content.assets.map((a) => a.id),
    '/assets',
  );
  for (const [i, p] of content.pages.entries()) {
    if (
      typeof p.path === 'string' &&
      defaultPolicy.firstVersion.structure.reservedPaths.value.some((v) =>
        p.path.startsWith(v),
      )
    )
      errors.push(
        problem(
          '/pages/' + i + '/path',
          'page.reserved',
          defaultPolicy.firstVersion.structure.reservedPaths.value,
          p.path,
          'Use a non-system path.',
        ),
      );
    unique(
      (p.sections ?? []).map((s: any) => s.id),
      '/pages/' + i + '/sections',
    );
    const blocks = (p.sections ?? []).flatMap((s: any) => s.blocks ?? []);
    unique(
      blocks.map((b: any) => b.id),
      '/pages/' + i + '/blocks',
    );
    if (
      blocks.length >
      defaultPolicy.firstVersion.structure.maxBlocksPerPage.value
    )
      errors.push(
        problem(
          '/pages/' + i,
          'page.blocks',
          defaultPolicy.firstVersion.structure.maxBlocksPerPage.value,
          blocks.length,
          'Remove blocks.',
        ),
      );
    for (const b of blocks) {
      const fields =
        (defaultPolicy.firstVersion.components as any)[b.component]?.fields ??
        {};
      for (const [key, field] of Object.entries(fields) as [string, any][]) {
        if (field.kind === 'richText' && Array.isArray(b.props?.[key])) {
          const count = b.props[key].reduce(
            (n: number, node: any) =>
              n +
              [...(node.text ?? '')].length +
              (node.items ?? []).reduce(
                (m: number, t: string) => m + [...t].length,
                0,
              ),
            0,
          );
          if (count > defaultPolicy.firstVersion.copy.richText.value)
            errors.push(
              problem(
                '/pages/' + i + '/blocks/' + b.id + '/' + key,
                'copy.richText',
                defaultPolicy.firstVersion.copy.richText.value,
                count,
                'Shorten combined rich text.',
              ),
            );
        }
      }
    }
  }
  const total = content.assets.reduce((n, a) => n + (a.bytes ?? 0), 0);
  if (total > 25 * 1024 * 1024)
    errors.push(
      problem(
        '/assets',
        'assets.totalBytes',
        25 * 1024 * 1024,
        total,
        'Remove images.',
      ),
    );
  return errors.slice(0, 20);
}
export function blockers(content: DraftContent) {
  const r = validateSiteSpec({ ...identity(), ...content });
  return r.ok
    ? []
    : r.errors.slice(0, 20).map((e) => ({ ...e, actual: e.actual ?? null }));
}
export function applyContent(
  content: DraftContent,
  operations: any[],
): DraftContent {
  if (
    !Array.isArray(operations) ||
    !operations.length ||
    operations.length > 32 ||
    Buffer.byteLength(canonicalJson(operations)) > 65536
  )
    throw new SiteError('draft_batch_limit');
  const next = structuredClone(content);
  const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
  const allowed: Record<string, string[]> = {
    settings: ['op', 'settings'],
    'upsert-page': ['op', 'page', 'index'],
    'remove-page': ['op', 'pageId'],
    'upsert-section': ['op', 'pageId', 'section', 'index'],
    'remove-section': ['op', 'pageId', 'sectionId'],
    'upsert-block': ['op', 'pageId', 'sectionId', 'block', 'index'],
    'remove-block': ['op', 'pageId', 'sectionId', 'blockId'],
    'asset-metadata': ['op', 'assetId', 'alt'],
    'remove-asset': ['op', 'assetId'],
  };
  const upsert = (list: any[], value: any, index: any) => {
    if (!object(value) || typeof value.id !== 'string')
      throw new SiteError('draft_object_required');
    const old = list.findIndex((v) => v.id === value.id);
    if (
      (old < 0 || index !== undefined) &&
      (!Number.isInteger(index) ||
        index < 0 ||
        index > list.length - (old >= 0 ? 1 : 0))
    )
      throw new SiteError('draft_index');
    if (old >= 0) {
      if (index === undefined) list[old] = value;
      else {
        list.splice(old, 1);
        list.splice(index, 0, value);
      }
    } else list.splice(index, 0, value);
  };
  const remove = (list: any[], id: any) => {
    const i = list.findIndex((v) => v.id === id);
    if (i < 0) throw new SiteError('draft_target');
    list.splice(i, 1);
  };
  for (const [operationIndex, op] of operations.entries())
    try {
      if (
        !object(op) ||
        !allowed[op.op] ||
        Object.keys(op).some((k) => !allowed[op.op].includes(k))
      )
        throw new SiteError('draft_operation');
      if (op.op === 'settings') {
        if (
          !object(op.settings) ||
          Object.keys(op.settings).some(
            (k) => !['tokens', 'navigation', 'cms'].includes(k),
          )
        )
          throw new SiteError('draft_settings');
        Object.assign(next, op.settings);
      } else if (op.op === 'upsert-page') upsert(next.pages, op.page, op.index);
      else if (op.op === 'remove-page') remove(next.pages, op.pageId);
      else if (op.op === 'asset-metadata') {
        const asset = next.assets.find((a) => a.id === op.assetId);
        if (!asset) throw new SiteError('draft_target');
        asset.alt = op.alt;
      } else if (op.op === 'remove-asset') remove(next.assets, op.assetId);
      else {
        const page = next.pages.find((p) => p.id === op.pageId);
        if (!page) throw new SiteError('draft_target');
        page.sections ??= [];
        if (op.op === 'upsert-section')
          upsert(page.sections, op.section, op.index);
        else if (op.op === 'remove-section')
          remove(page.sections, op.sectionId);
        else {
          const section = page.sections.find((s: any) => s.id === op.sectionId);
          if (!section) throw new SiteError('draft_target');
          section.blocks ??= [];
          if (op.op === 'upsert-block')
            upsert(section.blocks, op.block, op.index);
          else remove(section.blocks, op.blockId);
        }
      }
      const errors = validateDraft(next);
      if (errors.length) throw new SiteError('draft_validation', errors);
    } catch (error) {
      if (error instanceof SiteError)
        throw new SiteError(
          error.code,
          (error.errors.length
            ? error.errors
            : [
                problem(
                  '/operations/' + operationIndex,
                  error.code,
                  null,
                  op,
                  'Correct the operation.',
                ),
              ]
          ).map((e) => ({ ...e, operationIndex })),
        );
      throw error;
    }
  return next;
}
