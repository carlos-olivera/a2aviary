# Component library (foundation)

The library is repository-authored data consumed by the trusted generator. The
[policy 2.0.0](../plans/versions/web-simple/2.0.0.policy.json) remains the content
contract. This foundation has twelve components and one `standard` variant each;
it does not add client CSS, JavaScript, HTML or a public contribution workflow.
See [proposed decision 014](../docs/decisions/014-component-library.md).

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
