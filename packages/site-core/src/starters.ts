import { starters } from './starters-data.ts';
import type { Block, ValidationError } from './types.ts';
export interface Starter {
  id: string;
  version: string;
  status: 'experimental' | 'stable' | 'deprecated';
  kind: 'website';
  seed: {
    pages: { id: string; sections: { id: string; effects?: string[]; blocks: Block[] }[] }[];
    tokenRequirements?: string[];
  };
  inputs: { id: string; description: string; pointers: string[] }[];
  designIntent: string[];
  suggestions?: { component: string; variant: string; placement: string; rationale: string }[];
}
const visible = (s: Starter, test: boolean) => s.status === 'stable' || (test && s.status === 'experimental');
export function listStarters(test = false) {
  return starters.filter(s => visible(s, test)).map(({ id, version, status, kind }) => ({ id, version, status, kind }));
}
export function getStarter(id: string, version?: string, test = false): Starter | undefined {
  const candidates = starters.filter(s => s.id === id && (!version || s.version === version) && visible(s, test));
  candidates.sort((a,b) => {
    const x = a.version.split('.').map(Number), y = b.version.split('.').map(Number);
    return y[0]-x[0] || y[1]-x[1] || y[2]-x[2];
  });
  return candidates[0] ? structuredClone(candidates[0]) : undefined;
}
// Provenance remains readable after a starter is retired; never used to reseed.
export function starterSuggestions(id?: string | null, version?: string | null) {
  return structuredClone(starters.find(s => s.id === id && s.version === version)?.suggestions ?? []);
}
// Uniform completeness rule for all starter-created sites, independent of their
// original structure. It prevents legacy rendering defaults even after every
// seeded package is removed. Values still obey the shared catalog and plan.
export function explicitPresentationErrors(content: any): ValidationError[] {
  const paths = ['/language', ...['skipLink','primaryNavigationLabel','footerNavigationLabel','notFoundTitle','notFoundText','notFoundHomeLabel'].map(k => '/shell/' + k),
    ...['background','surface','text','muted','primary','accent','border'].map(k => '/tokens/colors/' + k),
    ...['heading','body','mono'].map(k => '/tokens/fonts/' + k),
    ...['spacing','radius','layout','motion'].map(k => '/tokens/' + k)];
  return paths.filter(path => {
    const value = path.slice(1).split('/').reduce((v,k) => v?.[k], content);
    return value === undefined || value === null || (typeof value === 'string' && !value.trim());
  }).map(path => ({path, rule:'content.required', limit:'explicit owner input', actual:null, suggestion:'Supply this value from the human; starter drafts have no presentation defaults.'}));
}
