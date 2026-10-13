import {
  defaultPolicy,
  contentErrors,
  catalog,
  canonicalJson,
} from '@a2aviary/site-core';

import { blockers, identity } from './draft-content.ts';
import type { Drafts } from './drafts.ts';
export function summary(this: Drafts, d: any) {
  const result = {
    draftId: d.id,
    siteId: d.site_id,
    revision: d.revision,
    state: d.state,
    pages: d.content.pages.length,
    assets: d.content.assets.length,
    policyVersion: d.policy_version ?? defaultPolicy.version.value,
    language: d.content.language ?? 'en',
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
    missing: blockers(d.content, { test: d.test_mode }),
    missingLabels: Object.entries(
      contentErrors(d.content, catalog).reduce(
        (groups: Record<string, string[]>, e) => {
          const at = e.path.lastIndexOf('/'),
            prefix = e.path.slice(0, at);
          (groups[prefix] ??= []).push(e.path.slice(at + 1));
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
  while (
    Buffer.byteLength(JSON.stringify(result)) > 4096 &&
    result.missing.length
  )
    result.missing.pop();
  return result;
}
