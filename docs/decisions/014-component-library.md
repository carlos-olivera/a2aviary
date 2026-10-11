# 014 — Component library foundation

- Date: 2026-10-11
- Status: proposed
- Basis: owner-requested foundation; PR review remains pending

## Context

The policy 2.0.0 catalog has twelve components with one `standard` variant each.
A generator switch and one stylesheet coupled content contracts to presentation.
We need a small, curated and versioned presentation library without accepting
client code or changing the validated site contract. Production activation and
the existing HTTP 503 remain separate work; see [release status](../release-verification.md).

## Decision

Keep the policy authoritative and add a top-level [library](../../library/README.md).
Define registry metadata for five package types:

| Type | Responsibility | Foundation |
| --- | --- | --- |
| component | Content contract only; no code | Twelve packages matching policy fields |
| variant | Logic-less template and scoped CSS for one component | Twelve `standard` packages |
| behavior | Small core-authored browser JS declared by a variant | Type reserved; no packages/loader |
| effect | CSS-only decoration selected per section/block | Type reserved; no packages/selection |
| font | Self-hosted WOFF2 plus OFL license | Type reserved; no packages/loader |

Initial packages are version `1.0.0`, status `stable`. The generated registry lists
ID, type, version, status and exact SHA-256 file hashes. The generator rejects stale
registry/compiled data, unknown packages/files, symlinks and policy disagreements.
Templates/CSS compile to data during the build; the credential-holding worker
never imports or evaluates package code. Packaging includes the library in the
Docker build stage and bundles its validated data into the runtime.

### Templates and core ownership

Grammar: `{{field}}`, `{{#each field}}…{{/each}}`, `{{#if field}}…{{/if}}`,
`{{> image field}}`, `{{> link field}}`, `{{> links field}}`,
`{{> richText field}}`, and `{{> collection field}}`. Interpolation always escapes
HTML and accepts only typed text. Loops resolve item fields; `this` references the
item itself. Helpers accept only the corresponding policy field kind. Collection
helpers preserve `data-collection`, live announcements and `emptyText` fallback.

Allow only `header`, `div`, `h1`, `h2`, `h3`, `p`, `ul`, `ol`, `li`, `details` and
`summary`; allow only quoted literal `class` tokens in authored markup. Core
helpers own URL/image/collection attributes. Reject unknown syntax, raw output,
attribute interpolation, property traversal, prototype access and unbalanced
control/HTML nesting. This excludes `script`, `style`, `iframe`, `object`, `embed`,
`form`, `svg`, inline styles and event handlers.

The core owns each wrapper's `id`, `data-component` and new
`data-v="<component>:<variant>"`. Templates render only its contents. Existing
relative navigation, prepared image references, rich text, font resources and
`cms.js` remain core behavior.

### Styles and determinism

Core base CSS owns layout, typography, navigation, sections, footer, skip link and
focus styles. Semantic custom properties expose the policy colors/fonts/spacing/
radius and fixed spacing scale. Every variant selector must remain under its
exact `data-v` selector; every comma branch is independently checked.

Use the restricted declaration and descendant-selector grammar documented in the
library README. Reject literal colors, URLs, at-rules, escapes, nesting and scope
escapes. `catalog.css` concatenates base styles and unique used variants sorted by
ID. The existing self-only script/style CSP is unchanged.

Generator version becomes `2.1.0`: an additive library capability with changed
output bytes, but no site policy/API contract change. Its existing version-bound
source hash and preview reuse keys distinguish newly generated output. Stored
approved snapshots still deploy their exact existing bytes without regeneration.

## Validation and consequences

Generator check/build/test and the existing CI services check reject stale or
invalid library data. No workflow permission change or new dependency is needed.
Parser/security tests, policy/registry checks, golden HTML, deterministic bundles,
local browser parity and real local CMS checks cover the boundary. Evidence and
commands are recorded in the [generator README](../../packages/generator/README.md)
and changelog; local verification is not production verification.

Templates cannot author arbitrary HTML/CSS features. Expanding the grammar needs
core review and tests. Registry digests detect stale content; they are not a
signature or an external package trust mechanism. The registry is built from
reviewed repository files, not downloaded client packages.

## Deferred

Contract 2.1, new components/variants, behavior/effect/font packages and execution,
section/block effect selection, budgets, experimental gating, contributions and
La Tarjeta presentation work remain later PRs. No policy, schema, migration, MCP,
payment, production configuration or hosted fixture change is included.
