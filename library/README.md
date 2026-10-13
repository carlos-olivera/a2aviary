# Component library

Current source implements the [contract 2.2 amendment](#contract-22-amendment).
The following foundation section preserves the PR #29 model and is extended below.

The library is repository-authored data consumed by the trusted generator. The
[policy 2.2.0](../plans/versions/web-simple/2.2.0.policy.json) is the current content
contract; the following foundation narrative describes the original PR #29 model. This foundation has twelve components and one `standard` variant each;
it does not add client CSS, JavaScript, HTML or a public contribution workflow.
See [decision 014](../docs/decisions/014-component-library.md).

## Packages and registry

Each `<component>/component.json` contains its identity, type, semver, status and
exact policy fields. `variants/standard/` contains `variant.json`, `template.html`,
`style.css`, and `fixtures/default.json`. Fixtures contain fictional blocks and
reuse asset/page references from the contract's seven-page example; they are not
standalone site submissions. Components own their manifest; variants own their
manifest, template, stylesheet and fixtures. No executable package files or
symlinks are accepted.

`registry.schema.json` defines the registry envelope and common metadata for five
types: `component` (content), `variant` (presentation), `behavior` (core-authored
browser JS declared by a variant), `effect` (CSS decoration) and `font`
(self-hosted WOFF2 with an OFL license). Only the first two have packages or loaders
in this release. Existing font assets and CMS JavaScript remain core resources.

`registry.json` records sorted package IDs, type, version, status
(`experimental`, `stable`, `deprecated`) and SHA-256 of each owned file's exact
bytes, keyed by library-relative path. Initial packages are `1.0.0`, `stable`.
The generated TypeScript catalog contains only validated AST and CSS data.

```sh
npm run library:generate
npm run library:check
```

Generation validates before writing; checking never repairs stale artifacts.
Generator check/build/test and root `library:check:static` enforce the same
registry, policy, template and CSS checks. The workspace CI patch is pending
owner application; it restores these relocated checks in the existing checks job. A generator build bundles the catalog;
the deployed runtime needs no source `library/` directory. No dependency was added.

## Template grammar

- `{{field}}`: HTML-escaped typed text, only in text content.
- `{{#if field}}…{{/if}}`: truthy value; no `else`, expressions or comparisons.
- `{{#each field}}…{{/each}}`: iterate typed lists. Inside, names refer to the
  current item; `this` refers to the entire item (including primitive image IDs).
- `{{> image field}}`, `{{> link field}}`, `{{> links field}}`,
  `{{> richText field}}`, `{{> collection field}}`: core helpers enforce compatible
  field kinds. Collection markup uses the block's `emptyText` as its fallback.

Controls may nest, but HTML elements must balance within each control branch.
Allowed tags are `header`, `div`, `h1`, `h2`, `h3`, `p`, `ul`, `ol`, `li`, `details`
and `summary`. The only package-authored attribute is a quoted, literal `class`
containing space-separated identifier tokens. Core helpers emit links, images and
collection attributes. No comments, raw output, attribute interpolation, dynamic
tags, property traversal, prototype access, scripts, styles, SVG or forms are
supported. The core emits the outer `div` with `id`, `data-component` and `data-v`.

## CSS rules

Every selector, including each comma-separated selector, must start with its
exact `[data-v="<component>:<variant>"]` scope. Only descendant tag/class selectors
are allowed after it. No sibling combinators, pseudo-functions, nesting, escapes,
comments, at-rules, imports, URLs or `!important` are accepted.

The initial declaration grammar is intentionally narrow: block/grid display,
the existing responsive grid columns, token-based gap/padding, zero padding,
`list-style:none`, `max-width:100%`, `height:auto`, `cursor:pointer`, semantic-token
color/background, token fonts and token radius. Unsupported syntax fails closed;
this is not a general-purpose CSS sanitizer.

Core tokens include `--color-<policy-slot>`, `--font-heading`, `--font-body`,
`--space` (the selected spacing), `--radius`, and `--space-4/8/12/16/24/32/48/64/96`
for the existing fixed scale. Color literals belong only in the core token map.
Empty stylesheets are valid when the component only needs base styles.

`catalog.css` contains base styles followed by only the unique variants used on
any page, sorted by package ID. `cms.js`, font filenames, licenses, relative URLs
and the deployed CSP retain their existing behavior.

## Contract 2.1 amendment

The foundation description above records PR #29. Policy **2.1.0**, contract **2.1**
and generator **2.2.0** add the capabilities below. Historical policies/contracts
are frozen. This is prepared source, not production activation. The shipped
catalog retains twelve standard variants, adds two curated font packages, and
contains no effect or behavior packages. Fictional executable/decorative packages
exist exclusively in the test fixture builder.

### Package ownership and selection

`package.schema.json` validates each manifest. Keep component/variant directories
unchanged. Effects use `effects/<id>/{effect.json,style.css,fixtures/*.json}`;
behaviors use `behaviors/<id>/{behavior.json,index.js}`; fonts use
`fonts/<id>/{font.json,LICENSE,<Latin WOFF2 files>}`. Registry entries record exact
file hashes and CSS/JS measurements; generated TypeScript is inert data. Unknown
files, symlinks, unsafe names, stale generated data, and policy disagreement fail.

An effect declares `target` (`section`, `block`, `items`, `action`) and an explicit
variant `compatibility` list; an empty compatibility list permits all variants.
Section selections target the section and require every enclosed variant to be
compatible. Other effects are selected on blocks. Items/action effects require
the matching variant target. Multiple effects use core-owned token-list
`data-fx` attributes. Clients never select behaviors: a variant declares their IDs.

Variants may add `targets`, mapping `root`, `control`, `items`, or `action` to
literal class tokens present in the template. A behavior requires a root; its
control must be a button. The core owns behavior/effect attributes, button type,
control IDs/accessibility attributes and initial hidden controls. Templates still
cannot author these attributes. `button` and `span` join the existing tag grammar.
Meaningful content remains visible without JS. A failed initializer leaves its
controls hidden and does not interrupt another initializer.

All package types have stable/experimental/deprecated status. The server passes
immutable site test classification to validation; missing trusted context means
non-test. Experimental packages, including transitive behavior dependencies,
require test sites. Deprecated packages cannot be selected in new drafts.

### CSS extension

Keep the existing property/value patterns and exact variant scope. Effect
selectors start with `[data-fx~="<id>"]`. Descendants and the simple `:hover`,
`:focus-visible`, `:focus-within`, `::before`, and `::after` suffixes are allowed.
No sibling selectors, arbitrary pseudo-functions, escapes, imports, URLs, nesting,
literal colors, `!important`, or fixed positioning are accepted.

Supported additions include relative/absolute/sticky positioning, inset, z-index
0–99, opacity 0–1, bounded dimensions, aspect ratio, translate/rotate/scale,
transform-style/perspective/backface visibility, blur, token-colored borders,
outlines, and linear/radial/conic gradients. Color stops may use semantic token
variables, transparent/currentColor, or `color-mix(in srgb,...)` over those colors.
Lengths use at most three integer digits in px/rem/em/%/vh/vw/svh/svw, or approved
spacing variables. Blur is capped at 64px; rotation at three integer digits;
animation timing at 60 seconds and transition timing at five seconds.

Only these at-rules exist: `@keyframes pkg-<id>-<name>` (a variant colon becomes
`--`), reduced-motion media, simple min/max-width breakpoints (10–2000px),
`@supports (animation-timeline: view())` and its negation, and namespaced
`@property` with angle/percentage/length/number syntax, `inherits:false`, and a
bounded initial value. Custom properties must be declared before use. Each
animated selector, including pseudos and conditional branches, needs a matching
reduced-motion override that disables its animation/transition. The core also
forces all package motion off for `motion:none` (the default). Packages may use
`--motion-duration` (0s/0.2s/0.6s for none/subtle/expressive) and `--font-mono`.

### Restricted behavior language

A behavior is exactly `export default (element, context) => { ... };`. Acorn parses
it before compilation. Supported syntax is const bindings, scalar expressions,
conditionals, bare returns, and bounded `querySelectorAll(...).forEach` callbacks.
DOM references are tracked from `element`; queries accept only a simple literal
class or approved tag. Allowed operations cover classList, focus, hidden/inert,
textContent, selected ARIA attributes, click/key/focus listeners, event key/code,
and preventDefault. `context.reducedMotion` combines the site token with the
user preference at initialization. Unsupported syntax and unprovable references
fail closed. This deliberately excludes otherwise harmless general JavaScript.

No imports, network/storage globals, dynamic code, timers, HTML injection,
navigation, document/window/globalThis, ancestor traversal, computed access,
prototype access, arbitrary event targets, or detached method calls are allowed.
The worker never evaluates package code. The emitted self-hosted `site.js` runs
only in the browser, is loaded with defer on pages using behaviors, and contains
one copy of each used initializer plus the reviewed core loader. The CSP is
unchanged. This is a reviewed-code authoring boundary, not a general JS sandbox.

### Fonts and budgets

Font packages must record a pinned `@fontsource` origin, OFL-1.1 license, Latin
subset, family/fallback, weights/styles and exact WOFF2 hashes. Include the full
OFL file. Inter and EB Garamond retain their existing bytes. No client upload,
external font CDN or runtime font download is permitted. System sans/serif/mono
choices need no downloadable package. The legacy default retains the existing
font resource output for byte compatibility; opt-in presentation selects fonts
from the package catalog. Space Grotesk and JetBrains Mono are not added here.

Policy owns limits and rationales: 4 KiB gzip per variant/effect, 2 KiB min+gzip per
behavior, 30 KiB package CSS and 8 KiB behavior JS including loader per page,
three downloadable families, four WOFF2 files, and 150 KiB font bytes. Inventory
caps are 20 components / 40 variants / 12 behaviors / 12 effects / six fonts.
Gzip level 9 and pinned minification provide deterministic reference sizes;
network transfer sizes vary with negotiated zstd/gzip. Shared bundle contents are
counted, not just references on one route. New components with an existing field
signature fail; only the historical feature-grid/steps pair is grandfathered.
Normalized declaration overlap of at least 80% produces a warning.

### Checks and evidence

`library:generate` validates and writes artifacts. `library:check` validates and
renders every production and fictional variant/effect fixture at 390/1280px,
normal/reduced motion, with axe and screenshots in ignored `.local/library-check/`.
Generator check/test invoke the full matrix. `library:check:static` is the explicit
non-browser gate used by builds and the prepared workspace CI patch.
That patch also includes browser/platform suites, pending owner application;
current hosted CI execution and App permissions are unchanged.
The compiler resolves its pinned development dependencies from the root workspace
installation. Services no longer hosts the compiler or site domain.

See [runtime tests](../packages/generator/test/library-runtime.test.mjs),
[network tests](../packages/generator/test/network-guard.test.mjs), and
[platform tests](../apps/platform/test/library-runtime.test.mjs). Unknown status,
compatibility, budgets and malformed values return structured correction guidance.


## Contract 2.2 amendment

Policy **2.2.0**, contract **2.2**, and generator **2.3.0** add the first generic
presentation batch. All twelve new entries are `1.0.0`, `experimental`, and
selectable only with immutable server-owned test classification:

| Type | IDs |
| --- | --- |
| Component | `profile-card` |
| Variants | `profile-card:flip-3d`, `steps:timeline` |
| Behaviors | `flip`, `tilt`, `copy-text` |
| Effects | `aurora`, `glow-border`, `reveal`, `shimmer` |
| Fonts | `space-grotesk`, `jetbrains-mono` |

The target-enabled `feature-grid:standard`, `link-cards:standard`, and
`cta:standard` remain stable and become `1.1.0`. Without selected effects they
emit the original markup. Existing budgets are unchanged; oversize compositions
are rejected. None of these packages becomes a default or customer template.

### Owner content and incomplete drafts

MCP `settings` accepts a site-level `shell`: `skipLink`,
`primaryNavigationLabel`, `footerNavigationLabel`, `notFoundTitle`,
`notFoundText`, and `notFoundHomeLabel`. These reuse label (80), heading (120),
and short-copy (500) limits. All six are mandatory when effective language is
not exactly `en`, any selected package or transitive dependency declares
`requiresShellContent: true`, or any shell object is explicitly supplied.
Omitted language is still `en`. Only legacy English compositions without new
packages or explicit shell content retain the original English shell bytes.
No translation or silent fallback is performed.

`profile-card` requires `name`, `role`, and `links`; `image` and `primaryContact`
are optional. Its `flip-3d` variant declares `contentRequirements` for
`flipLabel`/`backLabel`, plus `copyLabel`/`copiedLabel`/`manualCopyLabel` when
`primaryContact` exists. All are owner-supplied short copy. Empty optional text
emits no element or substitute copy. New package templates reject literal text;
accessible controls and fallback messages must come from typed content.

Incomplete drafts can be saved. Every apply/get summary includes compact
`missingLabels` groups with an exact JSON Pointer parent and missing field names;
combine them to locate each field. Preview/build reject missing or blank required
labels. The compact summary does not return supplied private copy. Historical 2.1 and 2.0 drafts and snapshots are now unsupported and return
`policy_version_unsupported`, including reads, discard, approval and deployment.
No upgrade path or database migration is introduced. Historical records survive
in Git at the pre-cleanup revision; current 2.2.0 artifacts remain frozen.

### Targets and confined runtime capabilities

In addition to literal class targets, `items: {each: "items", tag: "li"}`
references repeated template items and `action: {helper: "link", field: "action"}`
references the actual helper anchor. The compiler validates their existence and
field kinds; core adds effect attributes only when selected. `status` and
`messages` class targets identify an initially empty polite live region and
hidden owner-supplied message content. Core owns IDs, button type, ARIA,
enhancement visibility, helper output and the selected manual-copy input.

The behavior language adds tracked pointer listeners, numeric `clientX`/`clientY`,
root rectangle numeric fields, and live `context.finePointer`,
`context.reducedMotion`, and `context.motionIntensity`. Behaviors declare
`styleProperties` with their `--pkg-<id>-` namespace, fixed unit, finite initial
value and numeric bounds. Only provably numeric writes to declared properties
compile. Core rejects non-finite values and clamps to bounds; variants can consume
these variables only through declared behavior dependencies. Preference changes
reset tilt immediately. Expressive tilt is bounded to ±8 degrees; subtle uses
35% amplitude; none/reduced/coarse-pointer input disables tilt.

`context.copyText(link, manualCopyLabel, callback)` accepts only a tracked anchor
inside the root during a trusted user interaction. Core extracts a mailto/tel
address or resolved URL. The callback receives success/failure after clipboard
completion. Denied/unavailable access exposes a visible, focused, selected
readonly address with the supplied accessible label. Blur/new interaction
invalidates prior completion messages. Packages receive no promises, URL parser,
globals, timers, animation frames, arbitrary styles or untracked DOM access.
Failed initialization aborts package listeners and restores readable markup.

### Presentation and CSS additions

The restricted grammar adds bounded `rotateX`/`rotateY`, scoped class combinations,
overlapping grid faces, safe wrapping/clipping, `clip-path: inset()`, `steps()`
(1–120), motion-duration multiplication (1–8), conic starting angles, and literal
`nth-child()` positions (1–40). It still rejects arbitrary selectors, URL values,
literal colors, unscoped state rules and undeclared custom properties.

Flip uses real controls, synchronized `aria-pressed`, focus transfer and inert,
ARIA-hidden inactive faces after enhancement. Both faces are stacked/readable
without JS. None/reduced motion swaps instantly. The expressive-only role reveal
clips visual rendering while retaining the full accessible text and wrapping.
Subtle/none retain static role text. Timeline has a complete static connecting
line when scroll animation is unsupported or disabled. Opaque text surfaces,
one-pass hover/focus decorations, token-derived speed/amplitude (`--motion-distance` is 0/6/16px and
`--motion-angle` is 0/90/360 degrees for none/subtle/expressive) and entrance
animations under five seconds preserve readable fallback content.

Space Grotesk 400/700 and JetBrains Mono 400 use pinned Fontsource **5.3.0** Latin
WOFF2, original OFL licenses, registry hashes and generated resource notices.
Neither changes defaults. The high-contrast reference uses system fonts only.

### Local verification and hosted selection

Three equal-status fictional test inputs live in
[the presentation fixtures](../packages/site-core/fixtures/presentation/README.md):
dark English, light Spanish and high-contrast Spanish. They exercise every
non-font package, both new fonts across palettes, content boundaries, optional
image/contact combinations, keyboard/focus, no JS, initialization failure,
pointer/preferences and asynchronous clipboard outcomes. They are not defaults.
`library:check` includes the 390/1280 normal/reduced front/back browser matrix,
axe including contrast, overflow and external-request checks. Reports/screenshots
stay in `.local/library-check/` and `.local/presentation-check/`.

Run `node packages/generator/scripts/presentation-verify.mjs` with Node 22 after a
generator build for all three full local verifier runs. Measured resource sizes,
Lighthouse, axe, reduced-motion/network checks and captures are written under
`.local/presentation-verifier/`. Platform tests use isolated loopback Postgres and
exercise real MCP draft tools, normal uploads, preview/build and server gating.
The hosted fixture runner accepts only `--composition dark-en|light-es|contrast-es`;
its existing authorization gates remain intact. Pure selection is tested locally;
this option does not authorize provider operations or a hosted run.

## CMS collection data

[Collections](../collections/README.md) compile through `library:generate` and
`library:check` into inert site-core data. They are not executable library packages.
