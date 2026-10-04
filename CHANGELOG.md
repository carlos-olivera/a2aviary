# Changelog

## 2026-10-03

- Prepared the project foundation for code and documentation.
- Selected Apache 2.0 for the first commit.
- Recorded the vision, proposed architecture, roadmap, and pending decisions.
- Defined the separation between the technical repository and the progress-tracking Space.
- Incorporated the digital agency vision from the current Space introduction; the initial pilot retains its web scope.
- Translated the initial documentation into English and established English as the canonical documentation language.
- Organized eight original brand PNGs under `brand/`, documented the concept's palette and typography, and verified byte-for-byte preservation with SHA-256 checksums. No editable vector sources were available at import.

- Added editable SVG reconstructions of the full logo, bird, and wordmark under `brand/logos/svg/`, with outlined lettering, transparent backgrounds, and exact charcoal/teal fills. Verified SVG structure, rendered contours (99.28–99.50% silhouette overlap; maximum two source pixels of contour distance), and preservation of all original PNG checksums.

- Added the runnable static project landing in `website/` with Vite, vanilla JavaScript, and Three.js: five extruded source-bird components, a 2.8-second entrance, restrained idle animation, and capped pointer rotation.
- Added keyboard pause, reduced-motion still rendering, visibility suspension, mobile rendering limits, and independent SVG fallbacks for loading, WebGL failure, and context loss.
- Preserved the original brand assets and checksums; added separate inverse variants, favicon, licensed local fonts, and a 1200 × 630 social-preview image.
- Verified reproducible installation and production build, four viewport sizes, motion controls, pointer behavior, touch emulation, source loading failure, and real graphics context loss in headed Chrome 154. Recorded screenshots, a short animation, and measured frame cadence with device details in [landing verification](website/verification.md).
- Recorded the accepted landing-only implementation decision and documented setup and deployment prerequisites. The follow-build CTA is omitted until a real public destination is supplied; no hosting or DNS was configured.

No agency API has been implemented, no pilot website has been generated, and no service has been published. The landing has a local production preview; deployment remains unverified.

## Initial operating foundation — implementation in progress

- Integrated the existing English documentation changes and preserved the four original commits and Apache 2.0 provenance.
- Added the real GitHub follow-build CTA and Carlos Olivera attribution without replacing the Three.js landing or source brand assets.
- Implemented five CDK stacks, private S3/CloudFront OAC delivery, exact immutable GitHub OIDC trust, signed SES email intake, DynamoDB inbox/task/outbox and budget transactions, queued runtime/sender roles, and scheduled recovery.
- Implemented the Agents API adapter, scoped input/research tools, saved tool outcomes, schema-valid brief results, session cleanup, and ambiguous submission/send handling.
- Added the Email Transport v1 schemas, fictional signed example, signing/status client, accepted architecture records, private configuration setup, cost worksheet, and recovery runbooks.
- Added fixed-profile GitHub App credential brokers and an external trusted policy evaluator; autonomous merging remains disabled pending App/protection verification.
- Verified website asset checks/build, 18 behavioral service tests, four synthesized infrastructure security assertions, and a real Agents API smoke turn (6,759 input and 8 output tokens); deleted its session. The publication scan checked 162 current/history files and blobs with no matching credentials/private references. Subsequent files must be rescanned before publication.
- Deployed the website/CI infrastructure. Email deployment exposed duplicate CDK-generated MAIL FROM records; corrected source and removed only empty/bootstrap rollback resources and identified orphan records before retry.
- Recorded the CDK bundled dependency advisory as an unresolved tooling finding. Full launch and operating controls are not yet declared complete; [release evidence](docs/release-verification.md) is authoritative.
