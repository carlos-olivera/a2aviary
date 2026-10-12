# Component library

Current source implements the [contract 2.1 amendment](#contract-21-amendment).
The following foundation section preserves the PR #29 model and is extended below.

The library is repository-authored data consumed by the trusted generator. The
[policy 2.0.0](../plans/versions/web-simple/2.0.0.policy.json) remains the content
contract. This foundation has twelve components and one `standard` variant each;
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
npm run library:generate --prefix packages/generator
npm run library:check --prefix packages/generator
```

Generation validates before writing; checking never repairs stale artifacts.
Generator check/build/test and services check (already run in CI) enforce the same
registry, policy, template and CSS checks. A generator build bundles the catalog;
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
non-browser gate used by builds and the existing services CI path. CI does not
claim the browser/platform suites; workflow files and permissions are unchanged.
The compiler resolves its development dependencies from the explicit services
host in CI, so it does not require generator node_modules there.

See [runtime tests](../packages/generator/test/library-runtime.test.mjs),
[network tests](../packages/generator/test/network-guard.test.mjs), and
[platform tests](../apps/platform/test/library-runtime.test.mjs). Unknown status,
compatibility, budgets and malformed values return structured correction guidance.
