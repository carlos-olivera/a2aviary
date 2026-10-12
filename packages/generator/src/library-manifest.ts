import { catalog } from '../../../services/src/site/library-data.ts';
import { defaultPolicy, canonicalJson, sha256 } from '../../../services/src/site/policy.ts';
import { SiteError } from './render.ts';
export function compactLibraryManifest() {
  const manifest = {
    planId: 'web-simple',
    policyVersion: defaultPolicy.version.value,
    policySha256: sha256(canonicalJson(defaultPolicy)),
    contractVersion: '2.1',
    defaults: { language: 'en', motion: 'none', layout: 'boxed', effects: [] },
    budgets: defaultPolicy.firstVersion.library.budgets,
    packages: Object.values(catalog)
      .filter((p) => p.type !== 'behavior')
      .map((p) => ({
        id: p.id,
        type: p.type,
        status: p.status,
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
  const p = catalog[id];
  if (!p) throw new SiteError('library_package_not_found');
  const { code, css, license, files, fixtures, ...detail } = p;
  return {
    ...detail,
    ...(p.type==='variant'?{fields:catalog[p.component!].fields}:{}),
    ...(files ? { files: files.map(({ data, ...f }) => f) } : {}),
    exampleProps:
      p.fixture?.props ??
      (p.type === 'variant'
        ? catalog[p.component!]?.fixture?.props
        : undefined),
  };
}
