# Plan policies and site contracts

The current server-draft workflow uses [policy 2.0.0](../plans/versions/web-simple/2.0.0.policy.json) and site contract **2.0**. Both implementation flags default off. Nothing is for sale: no live checkout or active Paddle merchant of record. This manifest defines allowed catalog behavior, not a commercial offer or evidence of deployed operation. See [site operations](sites.md), [decision 013](decisions/013-server-drafts-and-preview.md) and [release evidence](release-verification.md).

## Source and generated artifacts

[plans/web-simple.policy.json](../plans/web-simple.policy.json) is the generating source. Every behavioral value retains a rationale. Node.js 22 `services` commands `site:generate` and `site:check` produce/check deterministic, immutable versioned artifacts:

- [Site schema](../contracts/site/2.0.0/site-spec.schema.json)
- [Disabled change schema](../contracts/site/2.0.0/change-request.schema.json)
- [Markdown manifest](../contracts/site/2.0.0/manifest.md)
- [JSON manifest](../contracts/site/2.0.0/manifest.json)
- [Complete fictional canonical example](../contracts/site/2.0.0/examples/site-spec.json)

The example contains fictional copy and a generated WebP pixel. It contains no approval or preview declaration. Runtime derives asset IDs/hash/bytes/dimensions/format from normalized upload output; clients can set alt text. The complete canonical spec is hashed using sorted-key JSON with array order preserved. Approval is recorded separately through verified browser membership and a single-use CSRF token.

Frozen [1.0.1 artifacts](../contracts/site/1.0.1/manifest.md), [1.0.0 artifacts](../contracts/site/v1/manifest.md) and policy snapshots remain historical references. They are not advertised or accepted as intake contracts, and the old submission route is removed. Do not regenerate frozen versions to apply current semantics. A same-version behavioral change must fail the immutable snapshot check; reviewed changes bump semver.

## Catalog boundaries

The fixed seven-page catalog, allowlisted design tokens/fonts, structured rich text, stable page/section/block IDs, component field/variant constraints and bounded configured CMS collections remain. There is no arbitrary HTML, CSS, scripts, SVG upload, remote image fetch, free-text interpretation, OCR, research or creative image editing in the site workflow. Missing draft content and forward references become preview blockers; invalid supplied values and aggregate budget excess fail immediately without partial writes.

Draft limits are 32 operations/64 KiB per batch and 256 KiB complete JSON. Normalized images are static WebP, at most 2560 px/side and 2 MiB each, 50 images/25 MiB total. Raw input may be JPEG/PNG/static WebP under bounded server normalization. Session, owner/global rolling quotas and expiry are detailed in [site operations](sites.md).

The historical monthly-change limits remain in policy/accounting records for continuity, but **`change.request` is unavailable** pending draft-based redesign. Its schema accepts nothing and capability metadata explains the restriction. CMS content editing remains available. Initial-site drafts refuse an already-live site's redeployment.

## Governance and verification

Current-head owner approval is required for policy changes. Prepare contracts/decisions/check evidence in Git, publish through the a2aviary Operator App only, and stop at the PR for Carlos's review. No manifest, build or PR establishes production activation. Migrations 001–006 remain unchanged; production's 006 mismatch requires separate reconciliation before rollout. Check relevant package behavior, deterministic generated artifacts, fictional-data boundaries and documentation links. Preserve Apache 2.0 and dependency licenses.
