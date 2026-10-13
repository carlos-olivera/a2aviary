import { behaviorLoader } from './behavior-loader.ts';
import { gzipSync } from 'node:zlib';
import { assertSupportedPolicyVersion, type Policy } from './policy.ts';
import type { LibraryContext, ValidationError } from './types.ts';
export interface LibraryPackage {
  id: string;
  type: 'component' | 'variant' | 'effect' | 'behavior' | 'font';
  version: string;
  status: 'stable' | 'experimental' | 'deprecated';
  purpose?: string;
  component?: string;
  variant?: string;
  fields?: Record<string, any>;
  behaviors?: string[];
  targets?: Record<
    string,
    string | { each: string; tag: 'li' } | { helper: 'link'; field: string }
  >;
  requiresShellContent?: boolean;
  contentRequirements?: { when?: string; fields: string[] }[];
  styleProperties?: Record<
    string,
    { unit: string; min: number; max: number; initial: number }
  >;
  target?: 'section' | 'block' | 'items' | 'action';
  compatibility?: string[];
  css?: string;
  code?: string;
  fixture?: any;
  fixtures?: any[];
  family?: string;
  fallback?: string;
  source?: {
    package: string;
    version: string;
    license: string;
    subset: string;
  };
  files?: {
    file: string;
    weight: number;
    style: string;
    sha256: string;
    data?: string;
  }[];
  license?: string;
}
export type LibraryCatalog = Record<string, LibraryPackage>;
export const gzipBytes = (s: string, level = 9) =>
  gzipSync(s, { level }).length;
// This reviewed loader is core code. Behaviors are syntactically validated function expressions.
export function behaviorBundle(
  catalog: LibraryCatalog,
  ids: string[],
  motion = 'none',
): string {
  if (!ids.length) return '';
  const entries = [...new Set(ids)]
    .sort()
    .map((id) => JSON.stringify(id) + ':' + catalog[id].code)
    .join(',');
  const properties = Object.fromEntries(
    [...new Set(ids)]
      .sort()
      .map((id) => [id, catalog[id].styleProperties ?? {}]),
  );
  return `(${behaviorLoader})({${entries}},${JSON.stringify(properties)},${JSON.stringify(motion)});\n`;
}
export function selectedPackages(spec: any, catalog: LibraryCatalog) {
  const variants = new Set<string>(),
    effects = new Set<string>(),
    behaviors = new Set<string>();
  for (const p of spec.pages ?? [])
    for (const s of p.sections ?? []) {
      for (const id of s.effects ?? []) effects.add(id);
      for (const b of s.blocks ?? []) {
        const id = b.component + ':' + b.variant;
        if (catalog[id]) {
          variants.add(id);
          for (const x of catalog[id].behaviors ?? []) behaviors.add(x);
        }
        for (const x of b.effects ?? []) effects.add(x);
      }
    }
  return {
    variants: [...variants].sort(),
    effects: [...effects].sort(),
    behaviors: [...behaviors].sort(),
  };
}
export function fontPackages(
  spec: any,
  catalog: LibraryCatalog,
): LibraryPackage[] {
  const fonts = Object.values(spec.tokens?.fonts ?? {});
  const selected = Object.values(catalog).filter(
    (p) => p.type === 'font' && fonts.includes(p.family),
  );
  // Legacy rendering emitted both pinned fonts, including when system fonts were selected.
  const legacy =
    !spec.language &&
    !spec.tokens?.mono &&
    !spec.tokens?.fonts?.mono &&
    !spec.tokens?.motion &&
    !spec.tokens?.layout &&
    !(spec.pages ?? []).some((p: any) =>
      (p.sections ?? []).some(
        (s: any) =>
          s.effects?.length ||
          (s.blocks ?? []).some((b: any) => b.effects?.length),
      ),
    ) &&
    fonts.every((f) =>
      ['Inter', 'EB Garamond', 'system-sans', 'system-serif'].includes(
        String(f),
      ),
    );
  return (
    legacy
      ? Object.values(catalog).filter(
          (p) =>
            p.type === 'font' && ['Inter', 'EB Garamond'].includes(p.family!),
        )
      : selected
  ).sort((a, b) => a.id.localeCompare(b.id));
}
export function validateLibrarySelection(
  spec: any,
  policy: Policy,
  catalog: LibraryCatalog,
  context: LibraryContext = {},
): ValidationError[] {
  assertSupportedPolicyVersion(policy.version.value);
  const errors: ValidationError[] = contentErrors(spec, catalog);
  const rules = policy.firstVersion.library,
    budget = rules.budgets;
  const add = (
    path: string,
    rule: string,
    limit: unknown,
    actual: unknown,
    suggestion: string,
  ) =>
    errors.push({
      path,
      rule,
      limit,
      actual,
      suggestion,
      policyPath: '/firstVersion/library',
    });
  const check = (id: string, path: string, type?: string) => {
    const p = catalog[id];
    if (!p || (type && p.type !== type)) {
      add(
        path,
        'library.package',
        Object.values(catalog)
          .filter((p) => !type || p.type === type)
          .map((p) => p.id),
        id,
        'Choose a package listed in the manifest.',
      );
      return undefined;
    }
    if (
      p.status === 'deprecated' ||
      (p.status === 'experimental' && !context.test)
    )
      add(
        path,
        'library.status',
        context.test ? ['stable', 'experimental'] : ['stable'],
        p.status,
        p.status === 'deprecated'
          ? 'Choose a non-deprecated package for a new draft.'
          : 'Experimental packages require an immutable test site.',
      );
    return p;
  };
  const effect = (
    id: string,
    path: string,
    section: boolean,
    blocks: any[],
  ) => {
    const fx = check(id, path, 'effect');
    if (!fx) return;
    if (!rules.effects.value.includes(id as never))
      add(
        path,
        'library.effect',
        rules.effects.value,
        id,
        'Choose an owner-reviewed effect.',
      );
    if (section ? fx.target !== 'section' : fx.target === 'section')
      add(
        path,
        'effect.target',
        section ? ['section'] : ['block', 'items', 'action'],
        fx.target,
        'Move this effect to a compatible section or block.',
      );
    for (const b of blocks) {
      if (!b.component || !b.variant) continue;
      const v = b.component + ':' + b.variant;
      if (fx.compatibility?.length && !fx.compatibility.includes(v))
        add(
          path,
          'effect.compatibility',
          fx.compatibility,
          v,
          'Choose a compatible variant.',
        );
      if (
        ['items', 'action'].includes(fx.target!) &&
        !catalog[v]?.targets?.[fx.target!]
      )
        add(
          path,
          'effect.targetMissing',
          fx.target,
          v,
          'Choose a variant exposing this target.',
        );
    }
  };
  for (const [pi, p] of (spec.pages ?? []).entries())
    for (const [si, s] of (p.sections ?? []).entries()) {
      const at = `/pages/${pi}/sections/${si}`;
      for (const [i, id] of (s.effects ?? []).entries())
        effect(id, at + '/effects/' + i, true, s.blocks ?? []);
      for (const [bi, b] of (s.blocks ?? []).entries()) {
        const path = at + '/blocks/' + bi;
        if (b.component) check(b.component, path + '/component', 'component');
        if (b.component && b.variant) {
          const v = check(
            b.component + ':' + b.variant,
            path + '/variant',
            'variant',
          );
          for (const id of v?.behaviors ?? [])
            check(id, path + '/variant', 'behavior');
        }
        for (const [i, id] of (b.effects ?? []).entries())
          effect(id, path + '/effects/' + i, false, [b]);
      }
    }
  for (const [slot, family] of Object.entries(spec.tokens?.fonts ?? {})) {
    const p = Object.values(catalog).find(
      (p) => p.type === 'font' && p.family === family,
    );
    if (p) check(p.id, '/tokens/fonts/' + slot, 'font');
  }
  const fonts = Object.values(catalog).filter(
      (p) =>
        p.type === 'font' &&
        Object.values(spec.tokens?.fonts ?? {}).includes(p.family),
    ),
    files = fonts.flatMap((f) => f.files ?? []);
  for (const [key, actual] of [
    ['fontFamilies', fonts.length],
    ['fontFiles', files.length],
    [
      'fontBytes',
      files.reduce((n, f) => n + Buffer.from(f.data ?? '', 'base64').length, 0),
    ],
  ] as const)
    if (actual > budget[key].value)
      add(
        '/tokens/fonts',
        'budget.' + key,
        budget[key].value,
        actual,
        'Use fewer or smaller curated font files.',
      );
  const used = selectedPackages(spec, catalog);
  const css = [...used.variants, ...used.effects]
    .map((id) => catalog[id]?.css ?? '')
    .join('');
  const js = behaviorBundle(
    catalog,
    used.behaviors,
    spec.tokens?.motion ?? 'none',
  );
  for (const [key, actual] of [
    ['pageCss', css ? gzipBytes(css) : 0],
    ['pageJs', js ? gzipBytes(js) : 0],
  ] as const)
    if (actual > budget[key].value)
      add(
        '/pages',
        'budget.' + key,
        budget[key].value,
        actual,
        'Reduce packages in the shared resources loaded by this page.',
      );
  return errors;
}

/** Incomplete draft content is accepted, but these requirements block preview/build. */
export function contentErrors(
  spec: any,
  catalog: LibraryCatalog,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const requireText = (path: string, value: unknown) => {
    if (typeof value !== 'string' || !value.trim())
      errors.push({
        path,
        rule: 'content.required',
        limit: 'non-empty owner-supplied text',
        actual: null,
        suggestion:
          'Supply ' +
          path +
          ' in the site language; no default text is substituted.',
      });
  };
  let needsShell = spec.shell !== undefined || (spec.language ?? 'en') !== 'en';
  const use = (id: string) => {
    if (catalog[id]?.requiresShellContent) needsShell = true;
  };
  for (const [pi, p] of (spec.pages ?? []).entries())
    for (const [si, s] of (p.sections ?? []).entries()) {
      for (const id of s.effects ?? []) use(id);
      for (const [bi, b] of (s.blocks ?? []).entries()) {
        use(b.component);
        const id = b.component + ':' + b.variant;
        use(id);
        const variant = catalog[id];
        for (const id of [...(b.effects ?? []), ...(variant?.behaviors ?? [])])
          use(id);
        for (const requirement of variant?.contentRequirements ?? [])
          if (!requirement.when || b.props?.[requirement.when]) {
            for (const key of requirement.fields)
              requireText(
                `/pages/${pi}/sections/${si}/blocks/${bi}/props/${key}`,
                b.props?.[key],
              );
          }
      }
    }
  for (const p of Object.values(catalog))
    if (
      p.type === 'font' &&
      Object.values(spec.tokens?.fonts ?? {}).includes(p.family)
    )
      use(p.id);
  if (needsShell)
    for (const key of [
      'skipLink',
      'primaryNavigationLabel',
      'footerNavigationLabel',
      'notFoundTitle',
      'notFoundText',
      'notFoundHomeLabel',
    ])
      requireText('/shell/' + key, spec.shell?.[key]);
  return errors;
}
