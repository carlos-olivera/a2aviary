# 014 — Component library foundation

- Date: 2026-10-11
- Status: accepted (foundation); 2.2 amendment implemented for owner PR review
- Basis: foundation merged in PR #29 (`d4bd963`); owner-approved 2.1 and 2.2 implementation plans

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
specialized presentation work remain later PRs. No policy, schema, migration, MCP,
payment, production configuration or hosted fixture change is included.

## 2.1 amendment — 2026-10-11

The owner requested additive policy 2.1.0 / contract 2.1, implemented on the
existing compiler. The foundation remains accepted; this amendment is prepared
for the owner's PR review, not an activation claim. Generator provenance becomes
2.2.0 and binds package metadata plus emitted resources. Checker provenance binds
the browser-wide network guard as well as the verifier.

Add optional effects, language, mono font, motion and flush layout. Default boxed
output retains PR #29 bytes; flush moves the 1120px content constraint into each
section's core-owned wrapper, allowing full-width decoration. HTML language is
validated, not translated. Package status is enforced using immutable site test
classification through drafts, preview and build jobs. No schema migration is
needed. The 2.1 release originally kept 2.0 drafts readable/discardable and
historical stored snapshots deployable. The owner-authorized 2026-10-13 cleanup
retires that compatibility after a zero-use production inventory: only 2.2.0 is
supported, with `policy_version_unsupported` for all other versions. Historical
artifacts remain in Git at pre-cleanup commit `27f642a`.

Use a closed Acorn AST language for confined behavior references, a balanced
extension of the existing CSS allowlist, and core-owned interaction attributes.
Only selected variants declare behavior code. Curated Latin OFL font packages
replace generator dependencies on Fontsource; original bytes/licenses remain.
All runtime examples are isolated test fixtures, never selectable release IDs.
The authoring rules, explicit bounds and policy budgets are in the
[library guide](../../library/README.md#contract-21-amendment).

Keep discovery context bounded with a compact package manifest and a read-only
single-package tool visible only with site tools. Library browser checks remain
local; existing CI enforces static checks without workflow permission changes.
Caddy enables zstd/gzip on static serving without changing CSP or CMS routing.
Production HTTP 503, real hosted verification and owner-authorized rollout remain
separate gates. No new client code, migrations, production configuration,
specialized presentation packages or contribution process are included.


## 2.2 amendment — 2026-10-12

The owner approved twelve generic experimental packages through the existing MCP
draft flow: profile card/flip variant, timeline variant, flip/tilt/copy behaviors,
aurora/glow/reveal/shimmer effects and two curated fonts. Policy becomes 2.2.0,
contract 2.2, generator 2.3.0. Frozen 2.1 artifacts remain unchanged. Test-only
selection, unchanged budgets and server-owned classification apply transitively.
No migration, production change or hosted run is part of this amendment.

Owner-supplied shell content is conditionally required by effective language,
explicit shell presence and declarative package metadata. Variant metadata defines
conditional accessible control labels. Saving incomplete drafts remains possible;
apply/get summaries identify missing labels and preview/build reject them.
Legacy English compositions retain byte equivalence. Existing 2.1 drafts follow
the retirement behavior established for 2.0; approved snapshots retain stored
bytes. No automatic upgrade or translation is introduced.

Extend the existing compiler with validated repeated-item/helper targets,
core-owned status/message markup, confined pointer/clipboard capabilities and
bounded numeric custom properties. Keep global access, general async code,
timers, arbitrary style/DOM access and client code prohibited. Core owns manual
copy fallback, stale-completion suppression and initializer rollback. CSS adds
only the bounded grammar required by this batch. Reduced/disabled motion and
unsupported APIs keep complete readable content. Full authoring limits and
content requirements are in the [2.2 library guide](../../library/README.md#contract-22-amendment).

Three equal-status fictional compositions test English/Spanish, dark/light/high
contrast, font/system choices and optional/content-boundary combinations. Local
MCP and browser/full-verifier evidence remain distinct from hosted verification.
The hosted runner gains an allowlisted composition selector with unchanged
provider authorization gates. Generic packages contain no fixture copy, client
identity or predefined site compositions. Owner review, merge timing and a
separately authorized hosted run remain outside this implementation delivery.
