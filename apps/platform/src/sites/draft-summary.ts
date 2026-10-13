import {
  starterSuggestions,
  explicitPresentationErrors,
  defaultPolicy,
  contentErrors,
  catalog,
  canonicalJson,
} from '@a2aviary/site-core';

import { blockers, identity } from './draft-content.ts';
import type { Drafts } from './drafts.ts';
export function summary(this: Drafts, d: any) {
  const result = {
    kind: d.kind ?? 'website',
    starter: d.starter_id ? { id: d.starter_id, version: d.starter_version } : null,
    requiredInputs: explicitPresentationErrors(d.content).map(e => e.path),
    suggestions: starterSuggestions(d.starter_id, d.starter_version),
    draftId: d.id,
    baseSpecId: d.base_spec_id ?? null,
    siteId: d.site_id,
    revision: d.revision,
    state: d.state,
    pages: d.content.pages.length,
    assets: d.content.assets.length,
    policyVersion: d.policy_version ?? defaultPolicy.version.value,
    language: d.content.language ?? null,
    tokens: d.content.tokens,
    effects: [
      ...new Set<string>(
        d.content.pages.flatMap((p: any) =>
          (p.sections ?? []).flatMap((s: any) => [
            ...(s.effects ?? []),
            ...(s.blocks ?? []).flatMap((b: any) => b.effects ?? []),
          ]),
        ),
      ),
    ],
    blockers: blockers(d.content, { test: d.test_mode }, Boolean(d.starter_id)),
    missingLabels: Object.entries(
      [...contentErrors(d.content, catalog), ...explicitPresentationErrors(d.content).filter(e => e.path.startsWith('/shell/'))].reduce(
        (groups: Record<string, string[]>, e) => {
          const at = e.path.lastIndexOf('/'),
            prefix = e.path.slice(0, at);
          const fields = groups[prefix] ??= [];
          if (!fields.includes(e.path.slice(at + 1))) fields.push(e.path.slice(at + 1));
          return groups;
        },
        {},
      ),
    ).map(([path, fields]) => ({ path, fields })),
    budget: {
      jsonBytesRemaining:
        262144 -
        Buffer.byteLength(canonicalJson({ ...identity(), ...d.content })),
      imagesRemaining: 50 - d.content.assets.length,
      imageBytesRemaining:
        25 * 1024 * 1024 -
        d.content.assets.reduce((n: number, a: any) => n + a.bytes, 0),
    },
    expiresAt: d.expires_at,
  };
  // Keep the previous missing field as a compatibility alias. Report truncation
  // explicitly, and retain at least one blocker when a draft is incomplete.
  const response = { ...result, missing: result.blockers,
    omitted: { blockers: 0, suggestions: 0, missingLabels: 0 } };
  while (Buffer.byteLength(JSON.stringify(response)) > 4096) {
    if (result.blockers.length > 1) {
      result.blockers.pop(); response.omitted.blockers++;
    } else if (result.missingLabels.length) {
      result.missingLabels.pop(); response.omitted.missingLabels++;
    } else if (result.suggestions.length) {
      result.suggestions.pop(); response.omitted.suggestions++;
    } else break;
  }
  return response;
}
