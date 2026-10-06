# 007 — Pilot policy and site contracts

Date: 2026-10-06. Status: Direction accepted by Carlos Olivera Terrazas in the
Phase 1 implementation request. Initial numerical values await current-head PR
review. Acceptance is separate from deployment or operational verification.

## Context

The client agent understands intent, researches, prepares images and copy, and
presents an HTML preview for human approval before sending website work.
a2aviary publishes rules, validates structured specifications, and will produce
sites faithfully through a fixed Astro component/token library. It does not
interpret free text, research, OCR or edit images for this pilot.
`website.brief.analyze` remains a supported legacy capability without extension.

The owner selected a future Node/TypeScript Railway service, Better Auth OAuth,
the official MCP server, human-bound ES256 agent keys, per-client PocketBase,
and client-domain Railway deployments. Those choices are design direction only;
none of that integration is implemented or deployed by this phase. Existing AWS
workers, signed email transport v1 and their security boundaries are preserved.

## Decision

Use one versioned owner-reviewable JSON policy per plan, with includes,
firstVersion and changes sections and rationale fields. Generate schemas,
Markdown/JSON manifests and fictional examples from it. Policies change only
through PR review; no runtime policy-writing tool is introduced.

V1 accepts only catalog-expressible previews and static WebP/JPEG/PNG images,
with actual-byte verification. Require an approval declaration bound to the
result digest, while explicitly deferring authenticated proof to later auth.
Use four monthly applied changes, two pages and ten blocks per request, plus
one separate shared configuration operation. CMS content-only edits do not
consume that allowance. These proposed initial values appear in [plans](../plans.md).

Implement standalone deterministic validation and atomic change projection.
Do not add auth, MCP, rendering, infrastructure, payment integration or deployment.
Nothing is for sale; no live checkout or active Paddle merchant of record exists.

## Consequences

Template gaps are rejected with corrective errors in v1. Arbitrary extensions
and AI-filled gaps require a later reviewed contract, not a silent escape hatch.
Schemas alone cannot enforce references, approval digests, actual image bytes
or change accounting; the library performs those additional checks. Visual
fidelity, authenticated approval and persistent application/accounting remain
future integration responsibilities.

The pilot uses fixed change requests rather than AI-token credits. Earlier
dated Basic/credit descriptions are historical and do not govern this policy.
Public website copy remains unchanged in Phase 1. Policies remain pinned for
existing clients; adoption of later versions requires explicit migration.
Source protection for `plans/` is added without activating the deployed evaluator.
