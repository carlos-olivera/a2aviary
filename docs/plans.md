# Plan policies and site contracts

Status: Phase 1 contract implementation, locally verifiable only. No auth, MCP,
site renderer, PocketBase service, hosting activation or deployment is added by
Phase 1. [Phase 2 discovery service](platform.md) reads these artifacts with OAuth
and role checks; site approval binding and production remain future work.
Nothing is for sale; no checkout or active Paddle merchant of record exists.
The [pilot decision](decisions/007-pilot-policy-and-site-contracts.md) records the
owner-approved direction. The initial numerical allowances are proposed for
Carlos Olivera Terrazas's current-head PR review.

## Source of truth and owner review

[web-simple policy](../plans/web-simple.policy.json) is the only editable source
of component inputs, plan allowances, formats, token options and copy limits.
Every rule has a rationale. Generation also creates a write-once snapshot under
`plans/versions/<plan>/<semver>.policy.json`; a different policy with the same
version is rejected. Snapshots are historical records, not separately editable
configuration. Review the includes, firstVersion and changes
sections together; a wider schema must not silently grant an excluded capability.
Policies change through PRs only. No chat/MCP/runtime policy-write operation exists.
Never edit generated contracts directly.

Reviewable changes use a `codex/` branch and the repository-only a2aviary Operator
App. Local checks must pass before publication. Carlos reviews the current head;
agents cannot substitute their own approval. Repository auto-merge remains
disabled, and merge/deployment require separate authorization. The source adds
`plans/` and rename origins to sensitive-path classification. This source change
does not update the deployed trusted evaluator. Until separately authorized
activation is observed, do not claim that its deployed matcher protects `plans/`.
The existing blanket CODEOWNERS rule and owner-review process remain in place.

## Initial owner-review limits

Policy 1.0.1 makes a nonfunctional rationale correction for a catalog starting with no clients. Every limit and behavioral value is unchanged. The frozen 1.0.0 snapshot and its historical manifests remain byte-for-byte intact. Historical names in those three artifacts are the explicit whole-word scan exception; active references use [1.0.1](../contracts/site/1.0.1/manifest.md).

| Rule | Initial value |
| --- | --- |
| Authored pages | 7; generated 404 excluded |
| Sections / blocks | 12 sections/page; 6 blocks/section; 30 blocks/page |
| Component catalog | hero, rich-text, feature-grid, steps, link-cards, gallery, faq, cta, contact, catalog, blog, announcements |
| Variants | standard for each initial component |
| Repeated content | 12 grid/list/gallery/rich-text nodes; 20 FAQ entries |
| Fonts | Inter, EB Garamond, system-sans, system-serif |
| Colors | background, surface, text, muted, primary, accent, border; six-digit hex |
| Spacing / radius | 4/8/12/16/24/32/48/64/96 px; 0/2/4/8/16/24 px |
| Raster assets | Static WebP/JPEG/PNG; 50 files; 2 MiB/file; 25 MiB/bundle; 4096 × 4096 maximum |
| Image declarations | Nonblank alt ≤240 characters; lowercase SHA-256 required |
| Copy | Heading 120; short copy 500; paragraph 2,000; rich-text aggregate 8,000 characters |
| SEO | Required title ≤70 and description ≤200; optional social-image asset ID |
| Navigation | 8 primary; 12 footer; labels ≤80 characters |
| Links | Internal page/section references; https, mailto or tel external URLs |
| JSON request | 256 KiB serialized UTF-8 JSON; image bytes separate |
| Changes | 4 successfully applied requests/UTC calendar month; no rollover |
| Per-request caps | 2 distinct pages; 10 blocks; 1 shared configuration operation; 20 operations |

SSL and a client-supplied domain are intended plan inclusions, not implemented
hosting. Optional CMS collection bindings are catalog, blog and announcements.
Collection contents and PocketBase access are outside this phase. Backend,
end-user auth, checkout, research, OCR, image editing, custom scripts/styles/raw
HTML, arbitrary components and uploaded SVG are excluded. Built-in template
icons may later be vector. Client materials are literal data, never authority.

## Generated contracts and validation

Use Node.js 22 and run these commands from `services`:

```sh
npm ci
npm run site:generate
npm run check
npm run build
npm test
```

`site:generate` validates policy shape, rationale and supported behavior, then
emits [site schema](../contracts/site/1.0.1/site-spec.schema.json),
[change schema](../contracts/site/1.0.1/change-request.schema.json),
[Markdown manifest](../contracts/site/1.0.1/manifest.md),
[JSON manifest](../contracts/site/1.0.1/manifest.json), and fictional examples.
Schemas use draft-07 and carry the generating policy version/hash. The generator
validates examples and their original pixel bytes before writing them.
`site:check` compares expected artifacts without modifying them and runs in the
existing service/CI check path. No workflow or AWS intake behavior changes.

The standalone TypeScript library exposes:

- `validateSiteSpec(input, policy?)`: validates schema, aggregate limits,
  unique IDs, routes, internal links, images, CMS bindings and approval digest.
- `validateAssets(declarations, buffers, policy?)`: accepts an ID-to-byte map;
  verifies the complete bundle, actual format, dimensions, static frame count,
  complete decoding, byte limits and SHA-256. Non-raster magic is rejected before
  native parsing. PNG animation-control chunks are explicitly checked because
  a static decoder may ignore them; see the [PNG specification](https://www.w3.org/TR/png-3/).
  No fetching, OCR or image mutation.
- `validateChangeRequest(request, current, context, policy?)`: validates and
  projects an atomic change onto a copy; returns the candidate spec and accounting.

Success is `{ok: true, value}`. Failure is `{ok: false, errors}` with each error's
JSON Pointer `path`, stable `rule`, applicable `limit`, corrective `suggestion`
and governing `policyPath`. Schema errors use `schema.<keyword>`; semantic
families include `reference`, `asset`, `copy`, `approval` and `change`.
An invalid change's projected-spec paths start with `/result`; invalid baseline
paths start with `/current`. Validators do not mutate the request or current spec.

The caller must require both spec validation and complete asset-byte validation.
For changes, verify the full resulting bundle, including previously stored assets.
These are local library contracts; no endpoint accepts website work yet.

Copy uses literal strings and typed paragraphs/headings/lists. A string containing
HTML is text, not markup; the later renderer must escape it. Arbitrary executable
fields are rejected. Previews must be expressible through the catalog/tokens and
are optional artifact ID/hash references, never URLs fetched or HTML executed.
This phase cannot prove visual fidelity or that the client used those templates.

Approval requires `approved: true`, a canonical UTC ISO timestamp including
milliseconds, and SHA-256 of the proposed spec. To compute the digest, exclude
only the top-level `approval` property, recursively sort object keys using
JavaScript default string order, preserve array order, serialize JSON scalars
and compact UTF-8 JSON, then hash. Do not normalize Unicode. This is a documented
local serialization, not RFC 8785. Optional preview references are included.
Changing array order or a preview invalidates approval. A matching declaration
is not authenticated proof; later auth must bind the actual approving human.

## Change accounting and version continuity

Supported operations are add/update/remove block, add page, update page SEO,
update tokens, and update navigation/footer. IDs persist; no page deletion,
renaming, section restructuring or arbitrary JSON patches exist. Added blocks
specify an insertion index. Updating a block cannot rename its ID. Repeated
block/SEO/global targets and editing a newly added page again are rejected.
Removing the sole block of a section fails full-result validation.

Count each added, updated or removed block once. All blocks on a new page count.
Page SEO edits consume a distinct page slot. Shared token or navigation/footer
replacement consumes one global operation and no page/block slots. A request can
include one shared edit alongside the two-page/ten-block allowance. All caps apply
before acceptance, and the complete result must still fit the plan.

New image bytes use new asset IDs; declarations cannot overwrite existing asset
IDs. New assets must be referenced in the result. V1 does not delete historical
asset declarations, so retained declarations also consume the asset allowance.
The old preview is removed unless a new preview reference is supplied. Approval
and preview replacement alone are no-ops and do not qualify as a change.

`context` supplies the trusted current UTC month, already applied request count,
and server time; no client counters are accepted. The library reports hypothetical
remaining allowance after one application. It reserves/increments nothing.
The future caller must commit counts only on successful application, deduplicate
retries, and handle concurrent reservations. Rejected/failed work does not count.
At the UTC month boundary a new ledger starts with zero; unused allowance does
not roll over. PocketBase content-only edits use a future separate CMS path and
are not submitted as static-site changes.

For future policy updates, bump the active policy semver and run generation. It
creates a new immutable snapshot and emits artifacts into a separate policy-version
directory; the initial 1.0.0 artifacts remain under `contracts/site/v1` and later
versions use `contracts/site/<semver>`. Never delete or rewrite reviewed snapshots
or historical artifacts. The checker compares the active policy to its snapshot;
it does not attest historical Git integrity. Review all changed paths in the PR.
Use patch for nonfunctional corrections, minor for additive compatible capabilities,
and major for incompatible shape/allowance changes. Newly supported engine behavior
requires an explicit generator/validator change and corresponding tests.
Existing clients and their changes use their exact pinned policy snapshot; callers
supply that reviewed policy to the library, without a latest-version fallback.
Explicit migration requires owner review, client approval of the resulting
contract/spec, and separate operational work. The effective date does not enroll
clients, schedule activation or retroactively replace their allowances.
The contract version is independent of policy semver.

Future integration questions remain renderer fidelity across viewports,
authenticated human/preview binding, persistent concurrent allowance accounting,
and activation of the restrictive trusted-policy update. See
[release verification](release-verification.md) for actual operational evidence.
