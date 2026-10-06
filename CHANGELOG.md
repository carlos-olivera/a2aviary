# Changelog

## 2026-10-06 — web-simple policy and site contracts verified locally

- Added an owner-reviewable versioned web-simple policy with rationale fields, immutable version snapshot, generated site/change schemas, Markdown/JSON client manifests, and fictional seven-page examples with original PNG pixels. Read-only artifact drift checks run in the service check path.
- Added standalone schema/reference/approval validators, actual raster byte/hash/dimension/decode/static-image checks, and atomic change projection with bounded page/block/global/monthly accounting. No auth, MCP, rendering, CMS provisioning, deployment or legacy brief-analysis extension was added.
- Proposed seven authored pages, four applied changes per UTC month, two pages/ten blocks/one shared configuration operation per request, and the full limits in [plans](docs/plans.md). Added source protection and tests for plans and rename origins; activation of the deployed evaluator requires separate authorization.
- Node.js 22.23.3 service check/build and 110 tests, website checks/build, seven infrastructure tests, generated-artifact consistency, documentation links and whitespace checks passed locally. Dependency notices are preserved, including optional native-package inventory handling. Operator App publication and current-head owner review remain separate from merge, deployment, authenticated approval, visual fidelity and persistent concurrent accounting.

## 2026-10-05 — changelog and author profile validated locally

- Added a decorative GitHub SVG beside “Follow the build,” using the existing 15px social-icon sizing and teal color. Node.js 22 checks/build and focused desktop/mobile browser verification passed, including keyboard focus and the unchanged repository destination.
- Added header navigation to the new post-hero Change Log, native glass timeline cards with three initial posts and an earlier-post disclosure, and a desktop-sticky author profile with the supplied portrait, exact biography and social links. Matched the existing palette/fonts and added reduced-motion-aware scrolling/reveals; moved stylesheet loading into HTML for styled development without JavaScript.
- Captured five real owner-supplied `@carlos_olivera` / `#a2aviary` posts into a validated, escaped, build-time JSON snapshot with UTC dates, thread references and expanded URLs. The feed is curated, with no live X fetch or embed; dated intentions remain distinct from implemented capabilities.
- Node.js 22.22.3 checks/build, exact output and development/preview GET/HEAD checks passed. Chrome desktop/tablet/two-mobile checks passed with JavaScript disabled/enabled, keyboard disclosure/navigation, reduced motion and locally applied production CSP. Existing Three.js, public-page, costs and SEO browser checks passed; see [local evidence](website/verification.md#changelog-and-author-profile--2026-10-05-local-verification). Verification was local. Operator App publication was requested separately after validation; owner review, merge and deployment remain separate gates.

## 2026-10-05 — support permission repair activated and receipts recovered

- After the owner merged PR #12 and authorized activation/recovery, inspected and executed the runtime change set; UPDATE_COMPLETE confirms deployment. Added only the approved raw-send permission under unchanged sender/recipient/identity restrictions and shared worker-code updates, with no resources added or removed.
- Conditionally released only the two prior-denial receipts for processing of their original notifications, preserving receipt IDs/timestamps and duplicate protection. Actual SES acceptance is recorded in [activation evidence](docs/release-verification.md#human-support-permission-repair--2026-10-05-activated); inbox, original attachment and reply delivery remain owner verification steps.

## 2026-10-05 — raw support-send permission repair prepared

- Traced two missing support messages to successful SES receipt/storage and held forwarding records. The worker lacked ses:SendRawEmail; a same-restriction live diagnostic reproduced a 403 denial naming that action. Prepared the missing raw-send permission without broadening sender, identity or recipient restrictions, plus definite access-denial handling and redacted send-error logging.
- A second empty-MIME diagnostic under corrected temporary permissions was unexpectedly accepted; the owner may receive a blank test email. The no-delivery assumption was wrong, the SES ID was not captured, and neither original receipt was replayed. Real inbox/reply delivery remains unverified; diagnostic credentials were removed.
- Service check/build and all 48 tests, infrastructure build/synthesis and all seven tests passed. Permission repair and bounded held-message recovery await owner review and separate activation; see [incident evidence](docs/release-verification.md#human-support-send-refusal--2026-10-05-repair-prepared).

## 2026-10-05 — human-support forwarding activated

- After owner approval/merge of PR #10 and separate deployment authorization, inspected and executed the email/runtime/controls change sets; all three stacks reached UPDATE_COMPLETE. Existing owner-attribution tags and shared worker assets were updated; no existing resources were removed, definitely replaced, or given DNS template changes.
- Verified active hello@ receipt routing, preserved agent/test rules, the Active Node.js 22 forwarding worker, Enabled SQS trigger, fixed private destination, support retention/TTL, and empty support queue/DLQ. SES sending identity/DKIM/MAIL FROM and production sending are enabled; owner-alert subscription is confirmed and support alarms are connected. See [deployment evidence](docs/release-verification.md#human-support-forwarding--2026-10-05-deployed).
- No external test message was sent; actual inbox arrival, received attachment bytes, reply delivery and real alert receipt remain unverified. Basic checkout and site production/hosting are unaffected.

## 2026-10-05 — launch copy and human-support forwarding prepared

- Presented Basic as the upcoming $10/month · $100/year software subscription with an ordered automated site-kit flow, one pricing launch status and a disabled “Coming soon” CTA. Preserved the hero and distinguished upcoming site production/hosting from verified brief analysis. Removed public Paddle names/links, repeated no-sales and mailbox disclaimers, and commissioned-work terms; deferred credit quantities and subscription/refund conditions until before checkout opens.
- Prepared an isolated SES hello@ forwarding route, private storage, receipt queue/DLQ, delivery ledger and Node.js 22 worker targeting private ownerEmail. Original MIME and attachments are preserved; scan failures, invalid input, loops and oversize mail are quarantined. Conditional claims and receipt expiry suppress duplicates and hold uncertain sends. Added support-only permissions, bounded retention, alarms, and owner activation/recovery instructions.
- Node.js 22.22.3 website check/build, development/preview GET/HEAD, emitted objects, links/sitemap/metadata and desktop/two-mobile public-page browser checks passed. Service check/build and 47 tests; infrastructure build/synthesis and seven tests passed. See [local evidence](website/verification.md#launch-copy-and-human-support--2026-10-05-local-verification). No live forwarding, payment activation, merge, deployment or external test message was performed.

## 2026-10-05 — agent control positioning

- Set the exact hero to “Your agent. Your control. Our build.” and “Open-source software that turns assistant requests into live sites — and soon more.” Replaced the old agency slogan in search/Open Graph/X metadata, structured website description, shared policy-page image descriptions, repository introduction, and regenerated social-preview art. Kept coming-soon website production and later apps/MCP/plugins explicit.
- Reverified the existing `/terms`, `/privacy`, `/refunds`, and `/pricing` pages, footer/contact links, and six-URL sitemap. Basic remains proposed at $10/month · $100/year with a native disabled “Coming soon” CTA, one curated-kit marketing site, and monthly AI-token/bandwidth credits. Legal pages describe future licensed platform access; nothing is for sale, no live checkout or active Paddle merchant of record is claimed, and no analytics were added.
- Node.js 22 website check/build, development/preview GET/HEAD and exact emitted objects, internal links/anchors/assets, sitemap, browser navigation/disabled checkout, and SEO/CSP checks passed. Desktop/mobile screenshots and square-safe share art were inspected. See [local evidence](website/verification.md#agent-control-positioning--2026-10-05-local-verification).
- Live Operator identity/repository-only scope, enabled development broker, protected main, and disabled auto-merge were checked. PR #8 was observed merged; remote main is `489c0d53e3477cd41aab703d4c15decf8a692bc7`, while the public release manifest still reports `7b7baf363ff4e9ab5f004c02ba1051a441c8ed1c`. This update awaits Carlos’s PR approval and a separately authorized release; no merge, deployment, payment setup, or mailbox configuration was performed.

## 2026-10-05 — software platform and proposed Basic plan

- Reframed the landing, search/social descriptions, structured data, and product documentation around an open-source software platform for agent-to-agent digital work. Retained the slogan and visual design, with “agency” explicitly described as a brand metaphor.
- Updated `/pricing` with proposed a2aviary Basic prices of $10/month and $100/year, one curated-kit marketing site, customer/local-agent kit preparation, and future validation/build/updates within monthly AI-token and bandwidth credits. The visible no-sales notice and native disabled “Coming soon” button accompany the prices; credit amounts remain unspecified. Websites are the first planned catalog item; apps, MCP services, plugins, and other capabilities are coming later without prices.
- Updated terms/privacy/refunds for future licensed platform access, preserved Apache 2.0 source rights and current data disclosures, and deferred purchase/cancellation/refund conditions until before checkout opens. No analytics, checkout, payment integration, runtime, or infrastructure changes were added. Existing footer/contact links and the six-URL sitemap remain valid.
- Verified Node.js 22 website checks/build, exact emitted HTML and development/preview GET/HEAD, links/anchors/assets, sitemap, metadata and JSON-LD. Headed Chrome desktop/two mobile checks passed with JavaScript disabled/enabled, locally injected production CSP, self-hosted requests, and clean diagnostics. Disabled CTA activation, existing costs/SEO checks, visual inspection, repository documentation links/anchors, source syntax, and whitespace checks passed; see [dated evidence](website/verification.md#software-platform-and-proposed-basic--2026-10-05-local-verification).
- Rechecked Operator identity, repository-only installation, fixed development access, disabled auto-merge, and protected main with App-bound required checks. The earlier public-page PR #7 is merged and the live release manifest reports `7b7baf363ff4e9ab5f004c02ba1051a441c8ed1c`; this update remains a separate review delivery. No owner approval, merge, deployment, payment setup, or mailbox configuration was performed by this task.

## 2026-10-05 — public policies and contact prepared locally

- Added exact static `/terms`, `/privacy`, `/refunds`, and `/pricing` pages, shared accessible navigation, a visible hello@ human contact block, HTML MIME handling, page metadata/logo-free JSON-LD, and the new sitemap URLs while preserving `/costs` and its supplied figures.
- Documented human authorization, discovery versus execution, budget limits, Apache 2.0 source versus future commercial services, data/retention boundaries, and future refund rules. Pricing publishes no amounts, catalog or checkout and states Paddle is not yet merchant of record.
- Updated Carlos Olivera Terrazas attribution throughout project text and regenerated the social image. The only CDK change is the approved owner-tag spelling; original brand assets and dependency licenses are preserved.
- Verified Node.js 22 website checks/build, service check/build and all 24 tests, infrastructure TypeScript build, exact emitted HTML/MIME and development/preview GET/HEAD, links/anchors/assets, sitemap and metadata/JSON-LD. Headed Chrome desktop/two mobile checks passed with JavaScript disabled/enabled under locally injected production CSP, clean diagnostics and self-hosted requests. Existing costs/SEO checks, source syntax, relative documentation links and whitespace checks passed; see [dated website evidence](website/verification.md#public-policies-and-contact--2026-10-05-local-verification).
- Recorded disabled Operator broker publication access and unverified hello@ delivery as owner follow-ups. No branch publication, PR creation, main push, merge, deployment, SES forwarding or payment setup was performed; Paddle submission and eventual catalog prices remain owner work.

## 2026-10-04 — cost transparency prepared for review

- Added the supplied root `COSTS.md` and `website/public/costs.json` unchanged, preserving every figure, status, source, note, and the conflicting domain confirmation note.
- Added a build-time `/costs` page with all JSON rows and supplied totals, explicit unknown amounts, precise small dollar values, invoice/budget caveats, accessible table navigation, and self-hosted CSS. The page has no browser JavaScript, analytics, or tracking.
- Added README/footer links and the canonical costs URL to the sitemap. The build emits the exact extensionless `costs` object; the upload script gives it HTML MIME without changing `infra/`.
- Verified byte-for-byte draft copies, website asset checks/production build, renderer escaping/precision/unknown/range checks, service TypeScript/build and all 24 behavioral tests including upload MIME cases, and direct development/preview GET/HEAD HTML delivery. Documentation links, source-link targets, built JSON bytes, and whitespace checks passed.
- Verified the costs page in headed Chrome 154.0.8037.98 at 1280 × 900, 390 × 844, and 360 × 640 with JavaScript disabled and enabled under the production CSP injected locally. All JSON fields/totals, keyboard access, responsive scrolling, home/footer/JSON navigation, and exclusively self-hosted resource requests passed with clean browser/network/CSP diagnostics. Existing SEO/homepage/404 browser checks also passed with the updated sitemap. Local evidence is recorded in [website verification](website/verification.md#cost-transparency--2026-10-04-local-verification).
- Prepared for an Operator App PR and current-head owner review. No website or infrastructure deployment was performed; public S3/CloudFront costs delivery remains unverified.

## 2026-10-04 — landing SEO improvements prepared locally

- Added the root canonical URL, complete Open Graph/X metadata with Carlos Olivera Terrazas's creator handle, and a linked website/organization/person/source-code JSON-LD graph without an unapproved logo.
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
- Added the real GitHub follow-build CTA and Carlos Olivera Terrazas attribution without replacing the Three.js landing or source brand assets.
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
