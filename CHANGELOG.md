# Changelog

## 2026-10-04 — landing SEO improvements prepared locally

- Added the root canonical URL, complete Open Graph/X metadata with Carlos Olivera's creator handle, and a linked website/organization/person/source-code JSON-LD graph without an unapproved logo.
- Added crawler discovery and a canonical-only sitemap, a standalone noindex 404 page, and XML/ICO upload MIME mappings. Prepared CloudFront origin 403/404 handling that returns the custom page with HTTP 404; owner review and infrastructure deployment remain pending.
- Replaced the stale share screenshot with a reproducible 1200 × 630 composition whose headline, complete bird, identity, and updated attribution survive the centered square crop. Added derived 16/32/48-pixel ICO and 180-pixel Apple touch assets without modifying original artwork.
- Verified website asset checks/build, browser metadata/XML/icon checks, desktop/mobile 404 behavior without JavaScript under locally injected production CSP, script syntax, and six synthesized infrastructure assertions. Recorded local evidence and the assets-before-CloudFront release sequence in the website documentation. No website delivery, infrastructure deployment, or social-platform preview validation was performed.

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

The entries above describe the original local landing delivery. The operating foundation and public deployment are recorded below; no pilot website has been generated.

## 2026-10-04 — published operating foundation, remaining release gates

- Integrated the existing English documentation changes and preserved the four original commits and Apache 2.0 provenance.
- Added the real GitHub follow-build CTA and Carlos Olivera attribution without replacing the Three.js landing or source brand assets.
- Implemented five CDK stacks, private S3/CloudFront OAC delivery, exact immutable GitHub OIDC trust, signed SES email intake, DynamoDB inbox/task/outbox and budget transactions, queued runtime/sender roles, and scheduled recovery.
- Implemented the Agents API adapter, scoped input/research tools, saved tool outcomes, schema-valid brief results, session cleanup, and ambiguous submission/send handling.
- Added the Email Transport v1 schemas, fictional signed example, signing/status client, accepted architecture records, private configuration setup, cost worksheet, and recovery runbooks.
- Added fixed-profile GitHub App credential brokers and an external trusted policy evaluator; autonomous merging remains disabled pending App/protection verification.
- Verified website asset checks/build, 22 behavioral service tests, five synthesized infrastructure security/alert assertions, and a real Agents API smoke turn (6,759 input and 8 output tokens); deleted its session. Publication scans cover current files and outgoing history and found no matching credentials/private references; each delivery is rescanned.
- Deployed the website/CI infrastructure. Email deployment exposed duplicate CDK-generated MAIL FROM records; corrected source and removed only empty/bootstrap rollback resources and identified orphan records before retry.
- Recorded the CDK bundled dependency advisory as an unresolved tooling finding. Full launch and operating controls are not yet declared complete; [release evidence](docs/release-verification.md) is authoritative.

- Published the preserved history to the public repository, enabled private vulnerability reporting, and verified GitHub OIDC website delivery and public DNS/TLS/private-origin/security/cache behavior. Repeated headed desktop/mobile-emulation browser verification passed.
- Deployed authenticated SES transport and durable task/outbox state. A real fictional brief completed with six research citations and a signed correlated result; reported Agents usage was 22,556 input/1,177 output tokens. The conservative application estimate including search was $0.015257, not a measured bill.
- Verified stream-publication recovery with the dispatcher disabled, real concurrent DynamoDB budget reservations, and simulated interrupted-send handling. Restored the dispatcher. Added structured logging/metric checks, configurable owner/partner limit reductions, feedback retry/DLQ, attachment binding, vendor notices, and complete website file verification.
- An accelerated real-session deadline persisted cancellation but exposed provider cancellation settlement/deletion delays. Added cleanup cancellation retries and held the unknown $1 usage reservation; admission was paused during the delay and resumed after the independent worker confirmed deletion.
- Prepared the owner-review fallback while App registration is pending. Owner alert email confirmation and management-account cost-tag activation remain required. [Release verification](docs/release-verification.md) explicitly distinguishes deployed behavior, unresolved gates, and owner actions.
- Exercised actual website rollback after an injected deployment-client verification failure and preserved the prior public release exactly. Release snapshots now use unique IDs so same-commit reruns retain independent rollback evidence.
- Verified delayed deadline cleanup deleted its real provider session after 246 seconds; a second fixture on the final cleanup code verified cancellation/deletion without local provider calls. Unknown usage remains reserved. A bounded actual SQS redrive of an accepted outbox reference preserved its SES acceptance without resend.
- Recovered two actual retry-exhausted stream failure envelopes by replaying their three original records through the corrected dispatcher; verified zero batch failures and removed only recovered messages. Added a separate stream DLQ/alert and explicit envelope-aware recovery instructions.
- Kept unsettled provider execution in a service-wide concurrency slot independent of monthly ledgers; a real two-ledger race verified only one contender could acquire one shared slot. Unknown dollar reservations remain held after provider cleanup.
- Verified a real cancelled provider task retained its service-wide concurrency slot until deletion and released it afterwards. Three cancellation fixtures retain $3 in unknown-usage reservations pending billing reconciliation.
- Included brokered research inference in cumulative task token/dollar monitoring and added boundary tests; the service suite now has 22 passing behavioral tests.

- Added seven-day expiry for rejected/abandoned staged inputs, promotion after durable admission, and outbox-only delivery feedback correlation. Accepted content keeps thirty-day retention.
- Verified an admission-limited signed email left task count unchanged and its staged input tagged for seven-day expiry; reconciled only fictional bootstrap input references.
- Verified a final accepted no-research email task completed, retained its input under the accepted policy, released its concurrency slot after provider deletion, and reported 14,667 tokens ($0.001998 conservative ledger estimate). Four earlier unknown-usage reservations remain held.

- Corrected GitHub App registration by removing the automatically delivered installation event from selected manifest events. Verified private App creation and repository-only installation after owner confirmation; installation reconciliation now checks the complete grant and revokes its verification token.
- Verified live routine policy success and development-token denial for workflow edits, branch protection administration, and forging the App-bound trusted check. Owner review fallback and disabled development issuance remain until current-head approval success is verified.
