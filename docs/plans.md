# Plan policies and site contracts

The current server-draft workflow uses [policy 2.3.0](../plans/versions/web-simple/2.3.0.policy.json) and site contract **2.3**. Both implementation flags default off. Nothing is for sale: no live checkout or active Paddle merchant of record. This manifest defines allowed catalog behavior, not a commercial offer or evidence of deployed operation. See [site operations](sites.md), [decision 013](decisions/013-server-drafts-and-preview.md) and [release evidence](release-verification.md).

[ADR 015](decisions/015-application-types-and-categories.md) records the owner's 2026-10-12 direction to separate the website runtime, data-only starters, shared library catalog and one plan for every website category. Categories never change limits or price or supply blockers; catalog rules, plan limits and verification govern all compositions. The ADR is accepted. [Decision 016](decisions/016-draft-based-live-edits.md) implements draft-based live edits; library field ownership remains a follow-up.

## Source and generated artifacts

[plans/web-simple.policy.json](../plans/web-simple.policy.json) is the generating source. Every behavioral value retains a rationale. Node.js 22.23.3 root commands `npm run site:generate` and `npm run site:check`, owned by [site-core](../packages/site-core/README.md), produce/check deterministic, immutable versioned artifacts:

- [Site schema](../contracts/site/2.3.0/site-spec.schema.json)
- [Markdown manifest](../contracts/site/2.3.0/manifest.md)
- [JSON manifest](../contracts/site/2.3.0/manifest.json)
- [Complete fictional canonical example](../contracts/site/2.3.0/examples/site-spec.json)

The example contains fictional copy and a generated WebP pixel. It contains no approval or preview declaration. Runtime derives asset IDs/hash/bytes/dimensions/format from normalized upload output; clients can set alt text. The complete canonical spec is hashed using sorted-key JSON with array order preserved. Approval is recorded separately through verified browser membership and a single-use CSRF token.

New drafts use 2.3.0. The frozen 2.2.0 policy, contracts and stored snapshots remain supported for exact-byte deployment. Older retired artifacts remain available at [pre-cleanup commit `27f642a`](https://github.com/carlos-olivera/a2aviary/tree/27f642acf462bb34afc7428cc5ca04852f205f96/contracts/site). Never rewrite either immutable policy version.

## Catalog boundaries

The fixed seven-page catalog, allowlisted design tokens/fonts, structured rich text, stable page/section/block IDs, component field/variant constraints and bounded configured CMS collections remain. There is no arbitrary HTML, CSS, scripts, SVG upload, remote image fetch, free-text interpretation, OCR, research or creative image editing in the site workflow. Missing draft content and forward references become preview blockers; invalid supplied values and aggregate budget excess fail immediately without partial writes.

Draft limits are 32 operations/64 KiB per batch and 256 KiB complete JSON. Normalized images are static WebP, at most 2560 px/side and 2 MiB each, 50 images/25 MiB total. Raw input may be JPEG/PNG/static WebP under bounded server normalization. Session, owner/global rolling quotas and expiry are detailed in [site operations](sites.md).

One successfully deployed edit counts toward the owner's four changes per UTC calendar month, with no rollover. All static composition changes use `site.edit.open`, drafts, verified snapshots, browser approval and confirmed deployment. The obsolete per-operation change caps and `change.request` API/schema/stub are removed in 2.3.0. Complete catalog and plan limits still apply. Initial deployments, failures, previews, unapproved snapshots, retries and CMS record edits do not count. Pending/unknown deployments hold capacity separately from successful usage.

Every new blank or starter draft requires explicit language, shell copy, colors, heading/body/mono fonts, spacing, radius, motion and layout. Missing values block quick/full preview. No historical English shell or presentation defaults enter new snapshots. Policy 2.2 stored bytes remain unchanged.

## Governance and verification

Current-head owner approval is required for policy changes. Prepare contracts/decisions/check evidence in Git, publish through the a2aviary Operator App only, and stop at the PR for Carlos's review. No manifest, build or PR establishes production activation. Migrations 001–006 remain unchanged; production's earlier 006 mismatch was reconciled by the owner on 2026-10-07 (owner-reported). Check relevant package behavior, deterministic generated artifacts, fictional-data boundaries and documentation links. Preserve Apache 2.0 and dependency licenses.

Versions older than 2.2 remain unsupported. See the [live-edit workflow](sites.md#live-edits-policy-23).
