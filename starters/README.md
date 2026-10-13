# Website starters

Starters are reviewed, data-only starting points under
`<id>/<version>/starter.json`. They copy structure exactly once into a new draft.
The site records immutable `kind`, `starter_id` and `starter_version`. Existing
sites default to `website` with no starter. A different starter requires a new
site; no tool attaches or changes one later.

`profile` **1.0.0** is experimental and visible/selectable only to server-classified
testers. It uses existing profile, rich-text, timeline, work-link, gallery, CTA
and contact packages. It is not promoted to stable or deployed by this delivery.

## Data contract

The strict [schema](starter.schema.json) allows stable structural IDs, component/
variant selections, effects and empty block props. Seeds contain no site copy,
paths, language, palettes, font choices or token values. Optional token requirements
name inputs, never values. `inputs` gives English agent-facing descriptions and
JSON Pointers into the initial draft. `designIntent` and `suggestions` are also
English documentation for the client's agent and are never rendered on the site.
Pointers describe the copied structure; after customization the agent follows the
current draft and catalog requirements. There is no inheritance or starter code.

Every starter-created site requires explicit language, all six shell labels,
semantic colors, heading/body/mono fonts, spacing, radius, layout and motion.
Incomplete drafts remain editable; summaries report missing inputs and preview
refuses them. These uniform completeness requirements survive replacement of the
entire seed and prevent legacy presentation defaults. Blank drafts retain their
existing behavior. The shared catalog and plan validate values and composition.

After copying, the starter contributes suggestions only. Removing all seeded
blocks/pages, changing variants/effects/tokens and adding unrelated catalog
components is permitted. Suggestions never enter blockers, validation, preview
admission or rendering. Provenance does not describe the current appearance.

## Compilation and frozen versions

`npm run library:generate` and `library:check:static` validate starter schemas,
file ownership/symlinks, unique IDs, shared plan structure limits, selected and
suggested packages, compatibility and package budgets. Transitive experimental
packages prohibit stable starter status. Definitions compile into inert
[site-core data](../packages/site-core/src/starters-data.ts), bundled with the
runtime; no remote registry or executable loading is involved.

A reviewed version is frozen against `snapshots/<id>/<version>.json`. For a new
version add its definition and matching snapshot in the same review, then
regenerate. Never edit an existing snapshot to disguise a version change. Only
new sites select the latest visible numeric semver when version is omitted;
existing sites keep their pinned provenance and copied content. Deprecated
versions cannot seed new sites. Their historical suggestions remain readable.

## Verification

Run the starter compiler tests and platform suite using Node 22.23.3 and the
loopback-only database described in [site operations](../docs/sites.md).
`STARTER_VERIFIER_INPUT="$PWD/.local/starter-verifier" node --test
apps/platform/test/starters.test.mjs` saves one fictional MCP-prepared composition
and normalized image bytes for `node packages/generator/scripts/starter-verify.mjs`.
The latter runs the full local verifier, including real Astro/browser checks;
reports and screenshots stay in `.local/starter-verifier/`. Neither test invokes
hosted providers or production deployments.
