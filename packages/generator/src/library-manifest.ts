import { catalog } from '@a2aviary/site-core';
import {
  defaultPolicy,
  canonicalJson,
  sha256,
} from '@a2aviary/site-core';
import { SiteError } from './render.ts';
export function compactLibraryManifest() {
  const manifest = {
    planId: 'web-simple',
    policyVersion: defaultPolicy.version.value,
    policySha256: sha256(canonicalJson(defaultPolicy)),
    contractVersion: '2.2',
    defaults: { language: 'en', motion: 'none', layout: 'boxed', effects: [] },
    budgets: defaultPolicy.firstVersion.library.budgets,
    packages: Object.values(catalog)
      .filter((p) => p.type !== 'behavior')
      .map((p) => ({
        id: p.id,
        type: p.type,
        status: p.status,
        ...(p.requiresShellContent ? { requiresShellContent: true } : {}),
        ...(p.contentRequirements
          ? { contentRequirements: p.contentRequirements }
          : {}),
        purpose:
          p.purpose ??
          (p.type === 'component'
            ? 'Content contract for ' + p.id
            : 'Presentation for ' + p.component),
        ...(p.fields
          ? {
              fields: Object.entries(p.fields).map(
                ([name, f]) => name + ':' + f.kind + (f.required ? '!' : ''),
              ),
            }
          : {}),
        ...(p.type === 'variant'
          ? { compatibility: [p.component], behaviors: p.behaviors }
          : {}),
        ...(p.compatibility
          ? { compatibility: p.compatibility, target: p.target }
          : {}),
        ...(p.family ? { family: p.family } : {}),
      })),
    guidance:
      'Nothing is for sale. Use plan.get_schemas for the complete contract and library.get for package details. Experimental packages require an immutable test site; deprecated packages are unavailable for new drafts.',
  };
  if (Buffer.byteLength(JSON.stringify(manifest)) > 24576)
    throw new SiteError('manifest_budget');
  return { manifest };
}
export function libraryDetail(id: string) {
  const p = Object.hasOwn(catalog, id) ? catalog[id] : undefined;
  if (!p) throw new SiteError('library_package_not_found');
  const { code, css, license, files, fixtures, fixture, ...detail } = p;
  return {
    ...detail,
    ...(p.type === 'variant' ? { fields: catalog[p.component!].fields } : {}),
    ...(files ? { files: files.map(({ data, ...f }) => f) } : {}),
    ...(p.requiresShellContent
      ? {
          examples: (
            p.fixtures ??
            Object.values(catalog)
              .filter((v) => v.component === p.id)
              .flatMap((v) => v.fixtures ?? [])
          ).map((f) => ({ props: f.props })),
        }
      : {}),
    exampleProps: p.requiresShellContent
      ? undefined
      : (p.fixture?.props ??
        (p.type === 'component'
          ? catalog[p.id + ':standard']?.fixture?.props
          : undefined)),
  };
}
