# Initial release verification

Latest evidence: 2026-10-06 five-stage architecture/local checks and owner-reported customer-site pilot deployment; earlier local checks and dated observations below are retained. **Configured** means source/settings exist; **deployed** means the provider accepted the resources; **verified** means the stated behavior was observed; **blocked** means a release gate remains unmet. The release is not fully complete. Website delivery and a real research brief task work; The Operator App is now registered and installed only on this repository; current-head approval success/routine merging, owner notifications and tagged-budget coverage remain blocked.

## Customer-site pilot — 2026-10-06, owner-reported deployment

Carlos Olivera Terrazas confirmed in this architecture review that the customer-site
build/hosting pilot is **in progress and deployed**, superseding its earlier
Planned presentation. This is owner-reported deployment status; this task has not
independently inspected an authenticated hosted build/deploy transcript, provider
resources or a customer site. The earlier locally verified generator/CMS evidence
and pending independent cloud verification remain distinct. Payments and future
customer apps, MCP products and plugins are not activated by this status update.
The implemented platform MCP connector is separate from those future products.

## Catalog site workflow — 2026-10-06, verified locally; cloud gate pending

- **Prerequisite source:** main at `455df4f` includes the Phase 2 reconciliation
  from [PR #18](https://github.com/carlos-olivera/a2aviary/pull/18). Carlos reported
  its deployment before authorizing Phase 3. This report does not establish a
  new authenticated connector transcript; earlier evidence remains below.
- **Configured source:** `packages/generator` covers the twelve fixed Astro
  catalog blocks, original image validation, approval/preview digests, deterministic
  source/output hashes, secret-free hosted Agents verification and bucket objects.
  Optional platform MCP jobs have owned access, confirmations, durable Postgres
  state, atomic audit admission and concurrent monthly reservations. Railway/PocketBase
  provisioning is guarded by workspace/project/environment/service identity and
  protected target lists. Site tools default off; no policy rules were changed.
- **Local checks:** Node.js 22.23.3 generator check/build and ten tests, platform
  check/build and 38 passing tests (one opt-in cloud test skipped), existing service
  check/build and 112 tests, website check/build, infrastructure build and seven
  tests, generated-contract consistency, documentation links and whitespace.
  Provider adapter/workflow tests use explicit doubles, not live cloud services.
- **Actual browser evidence:** the fictional seven-page Astro fixture passed all
  37 syntax/build/axe/link/Lighthouse/visual checks at 390 and 1280 px. Repeated
  builds produced output SHA-256
  `f10ccf6f9877b005f73652715ac4d963498705c93bf852e95047fb141ba52fb3`.
  A separately approved preview with a changed background failed both viewport
  comparisons while Astro build passed. These checks ran locally, not in OpenAI.
- **Actual containers:** platform image builds and runs as UID 1000; four SQL
  migrations, readiness/login/discovery, default-disabled site intake and the
  SHA-pinned Railway CLI passed. PocketBase 0.40.4 and Caddy 2.11.2 containers
  passed editor login, published-only reads, blocked signup/anonymous writes,
  bounded content edits without redeploy, proxy routes, 404 behavior and blocked
  settings/superuser routes. Backup schedule/encryption/rate-limit settings exist;
  a remote backup/restore has not been executed.
- **Cloud gate pending:** development OpenAI API, Railway API and bucket/backup
  credential references were unavailable. The real hosted-sandbox → bucket →
  isolated Railway fixture end-to-end test has not run; no Railway projects,
  services, volumes, buckets, domains or certificates were created by this Phase 3
  work. Provisioning API behavior, remote caps, private networking and HTTPS/SSL
  remain unverified. A successful local build or provider double is not deployment.
- **Remaining owner actions:** supply the private development environment reference
  for the live fixture gate; review the PR; separately authorize platform activation
  and any expanded trusted-policy enforcement. Review/merge does not itself enable
  `SITE_WORKFLOW_ENABLED`. The existing GitHub workflow covers legacy website/service/
  infrastructure checks; Phase 3 local and cloud checks are separate evidence.
  No production AWS configuration, DNS, platform service, Teco site or public
  website copy was changed. Payments, tester enrollment and chat admin tools remain
  outside this phase.

See [site operations](sites.md), [generator checks](../packages/generator/README.md)
and [decision 009](decisions/009-catalog-generation-and-client-hosting.md).

## Platform Origin repair — 2026-10-06, owner-reported retry

- **Observed public response:** the Railway staging login page returned HTTP 200
  with `Referrer-Policy: strict-origin` after the corrected deployment. The prior
  deployed Chrome form failure was reproduced as `Origin: null`, HTTP 403.
- **Owner evidence:** Carlos reported that the retry test passed. No authenticated
  ChatGPT/Claude admin-tool transcript or production audit record was inspected;
  do not infer a particular client's full OAuth/MCP compatibility from this report.
- **Source history:** [PR #15](https://github.com/carlos-olivera/a2aviary/pull/15)
  merged Phase 1 into main. [PR #16](https://github.com/carlos-olivera/a2aviary/pull/16)
  and [PR #17](https://github.com/carlos-olivera/a2aviary/pull/17) merged Phase 2
  and the form repair into `codex/web-simple-contracts`, at `134773a`. At this
  observation, main still contains Phase 1 only; source reconciliation needs owner
  review. No merge or deployment was performed by this evidence update.

Earlier local verification below remains historical. See [platform operations](platform.md).

## Discovery auth/MCP platform — 2026-10-06, verified locally

- **Configured source:** isolated `apps/platform` Node.js 22/TypeScript service,
  Better Auth 1.7.7 JWT/MCP/CIMD, official MCP server 2.3.1 with July 2026 strict
  POST serving, DCR disabled, Google login/consent and Postgres migrations.
  Discovery tools serve the Phase 1 artifacts; no website production or payments.
- **Locally verified:** Node.js 22.23.3 platform check/build and all 26 tests,
  including real Postgres OAuth discovery/consent/S256/token/refresh, audience and
  signature/issuer/expiry/scope and DPoP possession/replay boundaries, live roles, confirmations, public-key
  ownership, concurrent registration and rollback on audit failure. Google users
  and OAuth clients were fictional fixtures; only the Google redirect preparation
  was observed, not external identity authentication.
- **Container evidence:** Docker build, SQL migrations, non-root UID 1000 runtime,
  readiness, login page, discovery, unauthenticated challenge and POST-only gate
  passed. Production dependency tree and notices remain in the runtime image.
  Railway config was structurally validated against its published JSON Schema.
- **Regression checks:** existing service check/build and 111 tests, website
  checks/build, infrastructure build and seven tests, generated-contract checks,
  documentation links and whitespace passed. Public website files were unchanged.
  Better Auth's read-only schema planner warns about its generated rateLimit int8
  column; it reports no required schema changes. Numeric parsing and actual 429
  retry behavior are separately tested; no vendor schema patch was applied.
- **Preserved boundaries:** platform public-key registration does not enroll or
  revoke DynamoDB grants. No AWS credentials are used by the platform; the email
  transport/workers are unchanged. App/key mutations audit in the same transaction.
  Source sensitive-path additions for apps and Docker context rules were tested;
  no deployed evaluator activation was performed.
- **Still unverified/not activated:** Railway resources, Postgres backups/restore,
  domain/SSL, private Google client and actual callback, ChatGPT/Claude protocol
  compatibility and live enrollment. Already-issued JWT access tokens can survive
  OAuth revocation until their five-minute expiry; role revocations are live.
  No merge, cloud deployment, site approval binding, renderer, PocketBase,
  persistent monthly allowance accounting or payment integration.

See [platform operations](platform.md) and [decision 008](decisions/008-platform-auth-and-mcp.md).

## Pilot policy and site contracts — 2026-10-06, verified locally

- **Configured:** owner-reviewable web-simple policy 1.0.0 with rationale fields,
  write-once snapshot, generated site-spec/change-request schemas and client
  Markdown/JSON manifests. The seven-page examples and PNG pixels are fictional.
- **Locally verified:** Node.js 22.23.3 service check/build and all 110 tests;
  website checks/build; infrastructure TypeScript build and seven synthesized
  tests; policy/artifact consistency, documentation links and whitespace checks.
  New checks cover policy shape and version retention, catalog/token/copy limits,
  references, approvals, actual raster integrity/static-image restrictions and
  atomic bounded changes. Existing signed-email/AWS tests remain passing.
- **Prepared source only:** expanded trusted-policy matcher for plans and rename
  origins. No deployed evaluator activation was performed. Initial numerical
  limits await Carlos's current-head PR review; see [plans](plans.md).
- **Not implemented here:** auth/MCP integration, authenticated human approval,
  renderer or visual-fidelity verification, PocketBase provisioning/content
  editing, persistent/concurrent monthly accounting, site generation/deployment,
  checkout or sales. No legacy brief-analysis extension, merge or deployment.

## Architecture and local environment — 2026-10-06, prepared

- **Configured:** the editable architecture map, coverage metadata and generation
  provenance produce the prepared `/architecture` page. Archify 3.0.1 passed
  validation, delivery, geometry/source checks and browser gates at showcase
  quality against committed implementation source. The required source-fingerprint
  check rejects stale infrastructure/service evidence without installing Archify
  in CI. The session-only skill and its dependencies are excluded from Git;
  generated drawing notices preserve MIT alongside repository Apache 2.0.
- **Clean checkout verified:** Node.js 22.23.3 `local:quickstart` installed locked
  dependencies, started fresh Compose state, deployed and passed `local:test`.
  Cleanup through `local:down` succeeded. [Exact sanitized assertion output](architecture/local-test-output.txt)
  and [diagram screenshot](architecture/architecture-preview.png) are retained.
- **Local verification:** Community 4.12.0 deploys shared S3, DynamoDB/Streams,
  SNS/SQS/DLQs, Secrets Manager, Node.js 22 workers, EventBridge and supported
  logs/alarms. Production worker logic completes a fictional signed request,
  stores input/result, deletes the mock provider session, releases concurrency
  and emits an ES256-signed correlated result. Duplicate/tamper rejection and
  deployed broker/mock PR recording pass. Scheduled watchdog log activity,
  alarms and configured retention are checked; accelerated expiry, notification
  delivery and production IAM enforcement are not claimed.
- **Adapters:** Community CloudFormation does not materialize SES rules/configuration
  sets; local deployment creates them through SES v1 from synthesized CDK rules.
  The inbound adapter follows their S3/SNS actions. The outbound bridge preserves
  signed MIME while mapping SES v2 to v1. OpenAI/GitHub are deterministic local
  stand-ins. Real SMTP/delivery, CloudFront, public DNS/TLS, production OIDC/API
  hosting and billing budgets are cloud-only. See [local development](local-development.md).
- **Source checks:** website check/build and link checks; service check/build and
  all 49 behavioral tests; infrastructure build/synthesis and all nine tests pass.
  All five production templates are identical to remote main using the same
  worker artifact (production worker assets themselves change). Desktop/mobile
  browser verification under the production CSP passes keyboard activation,
  views/highlighting, source details and JavaScript-free evidence. Zero automatic
  requests to other domains and no CSP/console errors were observed.
- **Publication blocked:** live Operator App identity, repository-only scope,
  enabled development broker, protected main/required App checks and disabled
  auto-merge were verified. GitHub rejected the branch push because the existing
  App grant cannot create `.github/workflows/local-integration.yml` without
  workflow-write permission. No branch or PR was published; the token was revoked.
  Permissions were not expanded and no personal GitHub credentials were used.
  The owner must commit the prepared CI workflow through an authorized route
  before this branch can be rebased and published by the App.
- **CI/release gates:** the new read-only local integration job is initially
  advisory/non-blocking with bounded timeout and unconditional cleanup. Existing
  required checks/protection remain unchanged. Its real GitHub runner outcome is
  unverified until publication. Carlos Olivera Terrazas must review the exact
  PR head; merge and automatic website delivery follow approval. This page is
  prepared, not publicly released or verified. Infrastructure activation remains
  separately owner controlled; no production infrastructure deployment occurred.

## Human-support permission repair — 2026-10-05, activated

The owner merged PR #12 and separately authorized deployment and recovery of
both stored test messages. Approved source `ac73e6f4ca16612bc7fc9b0b2f1322ce251c3d0f`
matches merged main `73998a1c7ee11548a9106a7eead5e37d6204e430`.

- **Deployed:** the runtime stack reached UPDATE_COMPLETE. Change-set review
  confirmed one support-role permission change and eleven shared worker-code
  asset updates, with no resources added, removed or definitely replaced.
  SendRawEmail now accompanies SendEmail under the same identity, hello@ From
  and private owner-recipient restrictions. The worker update is Successful.
- **Recovery:** only the two receipts affected by the confirmed prior raw-send
  denial were conditionally released from delivery_unknown to ready. Entries
  required the recorded uncertainty reason, unexpired TTL and no SES acceptance
  ID. Original notifications retain their receipt IDs and timestamps; exhausted
  notifications are returned individually from the support DLQ. Unrelated
  uncertain outcomes remain held, and completed duplicates remain suppressed.
- **Delivery result:** both recovered receipts reached accepted_by_ses with
  distinct SES acceptance IDs. The support queue had zero visible/in-flight
  messages and the DLQ was empty after processing. Inbox arrival, original
  attachment integrity and reply delivery still require owner confirmation.
  Private receipt IDs, acceptance IDs, notifications and addresses remain in
  local evidence. No additional diagnostic email was sent during this recovery.

Earlier prepared/deployment observations below remain historical.

## Human-support send refusal — 2026-10-05, repair prepared

- **Received:** two real owner-reported test messages reached SES and private
  support storage. Their forwarding ledger entries are held as delivery_unknown;
  no SES acceptance IDs were recorded and neither original was replayed.
- **Confirmed blocker:** the deployed support role allows SendEmail but lacks
  SendRawEmail. A temporary diagnostic session restricted to that same sender,
  recipient and identity policy reproduced HTTP 403 AccessDeniedException for
  ses:SendRawEmail using an empty MIME payload. This confirms the API's raw-content
  permission requirement; IAM simulation of SendEmail alone was insufficient.
- **Diagnostic caveat:** after adding SendRawEmail only to the temporary diagnostic
  policy, SES unexpectedly accepted the second empty-MIME request. The expectation
  that empty MIME could not be delivered was incorrect; the owner may receive a
  blank test email. Its SES ID was not captured. No original test message was
  resent, and no inbox arrival is claimed. Temporary credential files were removed.
- **Repair prepared, not deployed:** add SendRawEmail to the support worker's
  existing identity/hello@ From/private-owner recipient restriction. Classify
  explicit AccessDeniedException as a definite refusal that can safely retry,
  and log the sanitized SES error name without addresses, message text or keys.
  Other uncertain sends remain held. Forty-eight service tests and seven
  synthesized infrastructure tests pass, including denial/retry and unchanged
  destination restrictions.
- **Owner gate:** review/approve the repair PR before separately authorized
  activation. Once the permission repair is deployed, reconcile the two held
  receipts against the established raw-send denial, conditionally reset only
  those eligible entries and perform one bounded replay. Real inbox/attachment/
  reply verification remains pending. Do not blindly replay other unknown sends.

## Human-support forwarding — 2026-10-05, deployed

The owner approved/merged PR #10 and separately authorized AWS activation in
this session. The deployed source is `6990b7384cc082671d109b5acec6de27028b4342`,
matching the merged main tree at `c3a5378873dfbb5a5f71af3d492c6cf3e4008c66`.

- **Deployed:** the email, runtime and controls stacks reached UPDATE_COMPLETE
  after their prepared change sets were inspected and explicitly executed.
  No existing resource removals, definite replacements or DNS template changes
  were accepted. Existing owner-attribution tags and shared worker code assets
  were updated alongside the new support resources.
- **Configuration verified:** active SES rule set a2aviary-prod contains enabled
  hello@ support routing before the preserved agent/test rules. The Node.js 22
  support worker is Active with a Successful update and its SQS trigger Enabled.
  Its destination matches the private owner configuration; no address is copied
  here. Support S3 remains private with seven-day expiration; ledger TTL is
  enabled; queue retries lead to the fourteen-day DLQ. Both support queues were
  empty at the verification read.
- **Sending prerequisites observed:** SES production sending is enabled; domain
  sending identity, DKIM and MAIL FROM report success. The existing owner-alert
  email subscription is confirmed. Support worker/log/DLQ alarms target that
  owner-alert topic; real alert receipt has not been tested in this delivery.
- **Unverified:** no external test email was sent. SES/routing/worker checks do
  not prove inbox arrival, attachment integrity at the inbox, or reply delivery.
  The owner should send a fictional message and attachment from a different
  mailbox to hello@, confirm inbox receipt, and reply to verify the return path.
  The forwarding loop guard rejects hello@/owner reply destinations; use a
  distinct test sender. Keep message content and receipt evidence private.

Private deployment/change-set and verification records are retained under
.local. Earlier prepared-only observations below remain historical. This
activation does not enable Basic checkout, site generation or hosting sales.

## Launch copy and human support — 2026-10-05, prepared locally

- **Configured:** Basic launch copy at $10/month · $100/year, automated future
  site-kit flow, neutral payment-provider references, software permissions in
  Terms, concise future cancellation/refund disclosures and disabled checkout
  CTA. The hero is unchanged. Credit amounts and subscription policies remain
  open. Basic website production/hosting and checkout are not live.
- **Prepared infrastructure:** explicit hello@ receipt rule, separate private
  support S3/SNS/SQS/DynamoDB resources and Node.js 22 forwarding worker. Its
  destination is private ownerEmail; it preserves original mail/attachments and
  grants no access to signed-agent state or secrets. Conditional delivery claims
  and seven-day receipt expiry prevent automatic duplicate/uncertain resends.
  Storage/ledger: seven days; redacted logs: thirty days; DLQ: fourteen days.
- **Locally verified:** website checks/build, emitted objects, development/preview
  GET/HEAD delivery, desktop/two-mobile public-page checks with JS off/on and
  local production CSP, disabled CTA, links, sitemap and metadata. Service
  check/build and 47 tests; infrastructure build/synthesis and seven tests passed.
  See [website evidence](../website/verification.md#launch-copy-and-human-support--2026-10-05-local-verification).
- **Read-only live observations:** active us-east-1 SES rule set still contains
  agent/test recipients only; production sending is enabled. Operator App
  5185075 / installation 167790436 remains repository-only and unsuspended with
  its existing grant, development enabled, protected main and disabled
  auto-merge. Administration-only protection details remain unavailable (403);
  no permissions were expanded. Remote main is
  `9c3d09a46a523760b6add23148df0b7f767587e8`; it has the same tree as the original
  local positioning baseline. These observations do not establish hello@ or
  public delivery of this update.
- **Owner actions:** review this PR, separately authorize merge/release and AWS
  activation, confirm private owner destination and alert subscription, then
  verify inbound/attachment/reply delivery and authentication. Exact activation
  and held-send recovery steps are in the
  [runbook](runbooks.md#human-support-and-public-commercial-pages).
  Read-only CDK diff/template comparison found support additions, agent-rule
  ordering and shared worker asset updates, plus pre-existing owner attribution
  tag drift and CDK metadata. No existing resource removals or DNS changes were
  found. Main's branch endpoint confirms App-bound required `checks` (15368)
  and `a2aviary-policy` (5185075). No merge, deployment or external test email
  is part of this delivery.

## Agent control positioning — 2026-10-05, local verification

- **Configured:** the exact primary “Your agent. Your control. Our build.” and secondary “Open-source software that turns assistant requests into live sites — and soon more.” now appear in the hero and corresponding search/social metadata; the structured website description uses the secondary. The old agency slogan was removed from landing/share metadata and regenerated 1200 × 630 share art. Website production remains coming soon; apps, MCP services, plugins, and other capabilities remain coming later.
- **Locally verified:** Node.js 22 website check/build, exact policy-page objects, development/preview GET/HEAD HTML MIME/body, footer/contact/internal links and anchors, six-route sitemap, metadata/JSON-LD, desktop/two mobile browser checks with JavaScript off/on and locally injected production CSP. Disabled Basic checkout activation caused no navigation or requests; only self-hosted resources were observed. SEO checks and visual inspection passed. See [website evidence](../website/verification.md#agent-control-positioning--2026-10-05-local-verification).
- **Existing content reverified:** `/terms`, `/privacy`, `/refunds`, `/pricing`, and `hello@a2aviary.io` human contact. Basic remains a proposed $10/month · $100/year software-access plan for one customer/local-agent-prepared curated-kit marketing site, with future validation/build/updates within monthly AI-token and bandwidth credits. Credit amounts remain open; nothing is for sale, the “Coming soon” CTA is disabled, and no live checkout or active Paddle merchant of record is claimed. No analytics, runtime, infrastructure, or payment integration was added.
- **Observed publication baseline:** Operator App 5185075 / installation 167790436, slug `a2aviary-operator`, is unsuspended, repository-only, and retains its existing permissions. The development broker is enabled, main is protected with required `checks` (App 15368) and `a2aviary-policy` (App 5185075), and repository auto-merge is disabled. Administration-only protection reads remain unavailable to this App (403); permissions were not expanded. [PR #8](https://github.com/carlos-olivera/a2aviary/pull/8) was observed merged; remote main reports `489c0d53e3477cd41aab703d4c15decf8a692bc7`. A read of the public release manifest still reports `7b7baf363ff4e9ab5f004c02ba1051a441c8ed1c`; neither merge nor local verification proves public delivery of the new copy.
- **Owner follow-up:** Carlos’s review/approval of this new delivery, separately authorized merge/release and public route/content/cache checks, hello@ delivery verification, and eventual catalog/payment readiness. This task performs no merge or deployment. Earlier sections are dated historical observations.

## Software platform and proposed Basic — 2026-10-05, local verification

- **Configured:** software-platform landing/metadata/JSON-LD copy, explicit agency
  metaphor, and proposed Basic prices of $10/month and $100/year beside a no-sales
  notice and native disabled coming-soon CTA. The proposed plan covers licensed
  platform access for one curated-kit marketing site, prepared by the customer or
  local agent and validated/built/updated within monthly AI-token and bandwidth
  credits. Credit amounts remain unspecified. Websites are the first planned
  catalog item; production is coming soon. Apps, MCP services, plugins, and other
  capabilities are coming later without prices. Terms/privacy/refunds describe
  future software access; subscription purchase/cancellation/refund details are
  deferred until before checkout opens. Existing navigation and six-URL sitemap
  remain valid. No analytics, checkout, runtime, or infrastructure changes.
- **Locally verified:** Node.js 22 website checks/build, exact emitted HTML and
  development/preview GET/HEAD MIME/body delivery, internal links/anchors/assets,
  sitemap and metadata/JSON-LD. Headed Chrome desktop/two mobile viewports passed
  with JavaScript disabled/enabled and production CSP injected locally; pointer
  and programmatic disabled-CTA activation caused no focus, navigation, submission,
  or checkout requests. Existing costs/SEO checks and visual inspection passed.
  See [website evidence](../website/verification.md#software-platform-and-proposed-basic--2026-10-05-local-verification).
- **Observed publication access:** Operator App 5185075 / installation 167790436,
  slug `a2aviary-operator`, is unsuspended and installed only on this repository.
  Its existing permissions and fixed development broker were verified; the live
  development flag is enabled, repository auto-merge is disabled, and main is
  protected with required `checks` (App 15368) and `a2aviary-policy` (App 5185075).
  The App's development token cannot read administration-only protection details
  (HTTP 403); permissions were not expanded. Publication uses the Operator App;
  owner review remains a separate gate.
- **Public baseline:** the earlier public-policy [PR #7](https://github.com/carlos-olivera/a2aviary/pull/7)
  was observed merged. Both remote main and the public release manifest report
  `7b7baf363ff4e9ab5f004c02ba1051a441c8ed1c`. This is evidence for that earlier
  release, not deployment of the new platform/Basic copy. This task has not merged
  or deployed this update. The earlier dated observations below remain historical.
- **Owner follow-up:** review/approval of this delivery, a separately authorized
  release and verification of its public content/route/cache behavior, hello@
  mailbox delivery, and eventual payment/catalog readiness. Nothing is for sale;
  no live checkout or active Paddle merchant of record is claimed.

## Public policies and contact — 2026-10-05, prepared locally

- **Configured:** exact static `/terms`, `/privacy`, `/refunds`, and `/pricing`
  objects, homepage/contact and footer navigation, six-URL sitemap, HTML MIME
  selection, page metadata and logo-free JSON-LD. Pricing contains no amounts,
  live catalog, checkout, or active merchant of record. Brief discovery is
  distinguished from future website/application/digital-service production.
  Full-name attribution is updated, including derived share art and the approved
  CDK owner-tag string; no infrastructure behavior was changed.
- **Locally verified:** Node.js 22 website checks/build, service check/build and
  all 24 tests; direct development/preview GET/HEAD HTML delivery and exact built
  objects; internal links/anchors/assets, sitemap, metadata and JSON-LD; headed
  Chrome desktop/two mobile viewports with JavaScript disabled/enabled and
  production CSP injected locally. Navigation, mailto, keyboard focus, skip
  links, responsive layout and exclusively self-hosted requests passed with
  clean diagnostics. Existing costs and SEO checks were repeated. See
  [website evidence](../website/verification.md#public-policies-and-contact--2026-10-05-local-verification).
- **Deployed:** no publication or deployment of this change set. Read-only
  baseline inspection found the public release at `ded2b8a1fc733243ba0da2ebb07f95dbb0e3af30`
  (workflow `37229373600`), matching remote main and including `/costs`.
  That baseline is distinct from these prepared pages and does not establish
  deployment of the earlier proposed infrastructure changes.
- **Blocked / owner follow-up:** the Operator development broker is disabled;
  branch push and App-authored PR creation await owner activation. Owner review,
  merge/release and public route/MIME/cache checks remain pending. Paddle seller
  submission/approval and eventual catalog prices are owner work; there is no
  claim of KYC, account setup or payment availability.
- **Human support:** a read-only active SES receipt-rule check found no explicit
  hello@ recipient or domain catchall. `hello@a2aviary.io` is published in source;
  forwarding/DNS setup and real inbound/reply delivery remain unverified owner
  tasks. The signed-agent address is not human support. No SES or forwarding
  implementation was performed; see [runbook](runbooks.md#human-support-and-public-commercial-pages).

## Landing SEO changes awaiting release

On 2026-10-04, canonical/Open Graph/X metadata, a logo-free JSON-LD graph,
robots/sitemap, square-crop-safe share art, derived ICO/Apple touch icons,
XML/ICO upload MIME mappings, and a standalone noindex 404 page were configured
in source and locally verified. The CloudFront 403/404-to-custom-404 change is
prepared for owner review; six synthesized infrastructure assertions pass.
No website publication or infrastructure deployment was performed for these changes.
Production SEO/404/MIME behavior and actual social-platform previews remain
unverified. Publish and verify the static error page before applying the approved
CloudFront update. See [local evidence](../website/verification.md#seo-additions--2026-10-04-local-verification)
and [release sequencing](../website/README.md#release-delivery).

## Published delivery

The first foundation commit is `1903229885f39244b937eaaff8280dfbcc4e5a72`. [Workflow 37169495312](https://github.com/carlos-olivera/a2aviary/actions/runs/37169495312) passed checks and OIDC website delivery. [Live revision](https://a2aviary.io/.well-known/release.json) is the authority for subsequent deliveries. Later fixes are delivered through the repository's PR/CI path; check the merged commit and its successful main workflow rather than equating a prepared change set with deployment.

All four original commits remain ancestors, including the Apache-licensed first commit. Bootstrap implementation commits identify Codex Bootstrap; publication uses Carlos's authenticated GitHub account. Origin and default `main` were verified. GitHub private vulnerability reporting was enabled and the API returned true. Current/history pattern scans found no matching credential/private-reference material; these are scoped scans and manual review, not a guarantee about every possible secret. Relative documentation links and `git diff --check` passed. Dependency licenses, bundled SDK vendor notices, and original brand checksums are preserved.

## Observed gates

| Area | Evidence and limits |
| --- | --- |
| Source checks | Website assets/production build; service TypeScript/build and 22 behavioral tests; infrastructure TypeScript/synth and five policy/alert assertions pass |
| Infrastructure | Five CloudFormation stacks: `a2aviary-prod-website`, `-ci`, `-email`, `-runtime`, `-controls`; imported zone/bootstrap/OIDC remain shared. Reviewed change sets deploy without data-resource replacement. Stack status is checked independently of CDK output |
| Website | Public DNS/TLS, HTTP→HTTPS, private origin anonymous 403, MIME/cache/CSP/HSTS/other security headers, CTA/attribution and preview assets verified. Final delivery checks every file checksum/MIME/cache against the private release snapshot |
| Browser | Headed Chrome 154.0.8037.98, 1440×900, 1280×720, 390×844, 360×640. Three.js entrance/motion, keyboard pause/resume, reduced motion and live preference changes, pointer limits, WebGL unavailable, real WEBGL_lose_context fallback, asset failure, and normal-path console/network diagnostics pass. Touch/coarse-pointer/DPR are emulated; visibility state is synthetic; these are not physical-device measurements |
| CI authorization | Actual main OIDC delivery succeeds with the verified immutable repository subject and audience. PR job has contents-read and no identity-token/deployment grant; exact main-only trust is asserted. A real foreign-fork credential denial has not been exercised |
| Email | Real SES receipt→private S3→SNS→SQS→validation→DynamoDB→runtime→outbox→sender→SES→controlled collector. Capabilities, acceptance, result, and status replies have valid ES256 signatures/correlation. Receipt authentication shows SPF/DKIM/DMARC pass. Identity/DKIM/MAIL FROM succeeded; DMARC enforcement deployed after alignment. Collector does not create tasks |
| Retention | Actual admission-limited signed submission created a pending-tagged private input but no task/model work; deployed S3 rule expires pending inputs after seven days. Existing bootstrap inputs were reconciled against task references; five abandoned inputs tagged pending and five referenced inputs accepted. A subsequent accepted input was promoted and its task completed; no-research result and provider deletion verified. Lifecycle/TTL expiration is asynchronous |
| Real task | A fictional garden brief completed with schema-valid goals/audience/pages/missing inputs/assumptions/criteria and six research citations. Two application calls, one research call. Saved state/result, distinct later Lambda invocations, signed reply, delivery event, and provider deletion verified after the initiating local submission process ended |
| Authorization | Behavioral tests cover tampering, scope/action/destination/schema/expiry/key/algorithm/size/attachment/research restrictions. Real signed duplicate/tamper/replay/conflicting-ID emails left one task and rejected unauthorised variants without additional responses/model work |
| Durable recovery | Real concurrent DynamoDB reservations admitted one contender and denied the other, without negative balance. A separate real transaction race across two fictional monthly ledgers admitted only one contender for one shared global slot. With stream dispatcher disabled, a real capabilities response was published by the scheduled watchdog and delivered; stream restored and Enabled/OK verified. A simulated interrupted-send ledger fixture became delivery_unknown without sending. The fixture is not a real SES timeout. Two actual stream-failure envelopes had exhausted six invocations during initial startup; their three original records were recovered from the stream, replayed through the corrected dispatcher with zero batch failures, and only their recovered envelopes removed. Dedicated stream/email DLQs now prevent mixed-envelope redrive. Actual SQS one-message redrive of an already-accepted outbox reference completed and preserved the SES acceptance record without resending. A controlled client-verification 503 triggered actual website snapshot restoration and CloudFront invalidation; the public previous revision/manifest was restored exactly. Every run now has a unique snapshot ID, including reruns of one commit |
| Alerts | Eight alarms, structured failure metrics, committed model-budget metric, AWS $15 notification budget deployed. Real CloudWatch data points observed for committed model dollars and logged worker failures. Owner SNS subscription still PendingConfirmation; notification receipt unverified. Project-tag AWS budget coverage awaits management/payer cost-allocation activation |
| GitHub identity | Manifest/callback/webhook, secret storage, fixed broker profiles and external policy evaluator deployed. Sensitive-path/current-head/rename approval behavior tested locally, including bundled licenses and architecture decisions. App 5185075 / installation 167790436 registered with the confirmed permissions, installed only on this repository, and checked against the whole installation grant. The live routine verification PR #2 passed CI and the App-emitted policy check. Development tokens received 403 for workflow edits, protection changes and forging a2aviary-policy. Development token issuance and repository auto-merge remain disabled; the enforced owner-review fallback remains while approval success is pending |

## Usage and cancellation recovery

The completed research task reported 22,556 Agents input tokens, 1,177 output tokens (23,733 total), including 14,398 cached input tokens and 49 reasoning output tokens. Its conservative application charge was $0.015257, including research/search. This is a ledger estimate, not an invoice. A separate bounded inference smoke turn reported 6,759 input/eight output tokens and its provider session was deleted.

A second real session was given an accelerated deadline through an owner-controlled fault injection. The service recorded `cancelled/deadline_exceeded`, committed its outbound notification, and retained its $1 reservation with zero active ledger tasks. OpenAI accepted cancellation but continued to report a waiting turn and returned 409 on deletion: execution was not confirmed settled. Cleanup now re-requests cancellation on that conflict, defers and emits a redacted failure signal. **The cleanup worker confirmed deletion 246 seconds after the application terminal state. An owner diagnostic re-requested cancellation during that first fixture. A second signed-email fixture on the final cleanup code verified cancellation and provider deletion without any local provider calls.** Admission was temporarily paused during the unsettled interval and resumed after deletion was verified; processing, sending, watchdog and cleanup stayed enabled. A third fixture on the global concurrency implementation verified that its service-wide slot stayed held through cancellation and was released only after provider deletion. All three cancellation fixtures retain their $1 unknown-usage reservations ($3 total, zero active ledger tasks). A later real research task on the combined-usage implementation completed with three citations, 12,671 research input tokens and 381 research output tokens ($0.011775 conservative research/search estimate), but its final Agents usage was unavailable. Its full $1 reservation also remains held after provider deletion. Do not release those reservations without final provider usage evidence. This tests the deadline boundary; it does not claim a naturally elapsed five-minute task or a hard billing cap.

The final no-research signed-email task completed on the retention/feedback changes with a schema-valid result, accepted input tag and provider deletion. Agents reported 14,228 input and 439 output tokens (14,667 total; 7,055 cached input), with a conservative $0.001998 ledger estimate. Four earlier $1 unknown-usage reservations remain held; no active execution slots remain. These launch amounts are not a monthly bill.

Other outstanding exercises are ambiguous session-creation recovery, saved tool-outcome retry injection, bounce/complaint suppression under real events. Source/runbooks exist, but those production fault paths are not marked verified. A successful normal deployment is not evidence for rollback.

## Owner actions and completion

1. Review the manifest/setup correction pull request as Carlos, approving its exact current head in GitHub. Verify that the external policy check reacts to the real approval before permitting routine autonomous merging. The App is registered and installation scope/token denials/routine policy success are verified. No automated use of Carlos's account may manufacture his approval.
2. Confirm the SNS subscription at the privately configured owner inbox, then observe an actual test notification.
3. Have the AWS management/payer owner activate the `Project` cost-allocation tag; this linked account's activation call was denied. Verify tagged-budget coverage afterwards.
4. Reconcile the held unknown-usage reservation against provider billing evidence without inventing a refund, and complete the remaining fault exercises. Delayed cancellation/deletion recovery is verified; admission has resumed.

The intended email autonomy and operational controls must all pass before full completion. The service implements brief analysis only; website generation, autonomous repository engineering, Teco and external A2A-standard compliance are outside this release.

## Tooling and private evidence

The pinned CDK library bundles `brace-expansion` 5.0.9 with a reported denial-of-service advisory. npm overrides do not replace that vendored dependency. Service dependency audit reports zero advisories. CDK remains in the owner-controlled path with trusted configuration; an upstream update removing the advisory remains outstanding. Infrastructure audit is not recorded as clean.

Private CloudFormation change-set/deployment logs, outputs, raw MIME, results, partner keys, owner contacts, and test records stay in `.local/` or private AWS resources. The duplicate MAIL FROM bootstrap failure was corrected; only empty/bootstrap rollback resources and positively identified orphan records were removed. No imported/shared domain, zone, bootstrap or OIDC provider was deleted. CDK prepare-change-set output is recorded separately from CloudFormation execution/completion. No monthly bill is inferred from launch smoke tests.

## Operator registration correction

The first manifest incorrectly selected `installation`; GitHub rejected it before registration. [GitHub sends installation events by default and forbids manual subscription](https://docs.github.com/en/webhooks/webhook-events-and-payloads#installation). Removing that entry made registration succeed. The owner-confirmed private App was installed only on carlos-olivera/a2aviary. Setup now enumerates the complete installation grant before issuing repository-restricted operational tokens and revokes its temporary verification token. Script syntax checks, real registration/installation and all 22 service tests passed.


## Testers and chat-only superadmin — 2026-10-06, local verification

- **Baseline:** PR #19 was observed merged into main at `d6b2d7d`; Phase 4 started from that main revision. This verifies the source dependency, not Phase 3 cloud operation.
- **Configured in source:** migration 005, durable seeded/chat-managed tester eligibility, free pinned-plan capability metadata, immutable site/spec/job test flags, staging-only dedicated fixture project guards, and tester use of the existing four-successful-changes allowance. Superadmin-only enrollment/admin revocation, bounded site inventory/inspection and redacted audit queries use the existing OAuth connector. No policy/OAuth trust mutation or admin web UI was added.
- **Reset:** exact site confirmation, pre-action/outcome audit, active-job and protected-resource refusal, single-fixture-project identity checks, prefix-bounded bucket cleanup, durable partial-reset retry and retained account/enrollment/audit records. Site history and accepted artifacts are removed, while the site identity is archived. Off-volume backups and object versions remain archived under owner-controlled retention; no shared backup bucket deletion is attempted.
- **Locally verified:** Node.js 22 check/build and 12 generator tests, 51 platform tests with real loopback Postgres/OAuth/MCP and explicit provider doubles, 112 existing service tests and seven infrastructure tests. Website checks/build, immutable generated artifacts, dependency notices, relative documentation links/anchors, whitespace and scoped secret-pattern review passed. A real local container ran as UID 1000 with all five migrations, tester seed, health, login/discovery and disabled-by-default site workflow.
- **Not verified/deployed:** one hosted cloud test remains explicitly skipped without private development credentials. Source includes an opt-in real tester/CMS/reset extension, but no remote fixture projects or assets were created/deleted and no DNS, production AWS configuration or production MCP deployment was changed. Local doubles are not Railway deletion or hosted sandbox evidence.
- **Owner follow-up:** review/merge the Operator-authored PR, run the normal staging migrator/rollout, retain the private owner identity/protected project settings, grant narrowly scoped fixture deletion and artifact list/delete rights, configure backup/object-version retention, then run the real staging tester/reset smoke and authenticated Claude/ChatGPT tool checks. See [operations](testers-and-admin.md).

## Two-level architecture — 2026-10-06, verified locally and prepared

- Refreshed the isolated architecture branch against remote main `1ee5c71`;
  the owner's other checkout remains untouched. The five-stage map includes
  current auth/MCP, Astro, Railway/PocketBase/Caddy and tester/admin source,
  with signed email labeled as a legacy pathway. Customer-site deployment is
  owner-reported, as recorded above; independent hosted verification is separate.
- Archify 3.0.1 finalized the overview and five focused drawings against committed
  source `b37f8419`. All four gates pass for each. The stage manifest assigns
  44 technical nodes once; coverage/status and expanded source fingerprints are
  recorded in [provenance](architecture/provenance.json). The hosting readiness
  detour was traced visually and accepted; the engine's empty gap was compacted.
- [Browser assertions](architecture/browser-verification.json) passed against
  the normal build redeployed to local S3 with production CSP: exactly five
  initial macro-stages and no technical panel/grid; every macro, tab and technical
  node; focused evidence, reset/close behavior, keyboard/focus/live announcements,
  local highlighting, native local accordion, desktop/mobile and JavaScript-free
  evidence. No automatic cross-domain requests or CSP/console errors were observed.
  Updated [overview](architecture/architecture-preview.png),
  [mobile](architecture/architecture-mobile.png) and
  [hosting](architecture/architecture-hosting.png) screenshots are retained.
- Node.js 22.23.3 website checks/build and internal links, documentation targets,
  service check/build and 113 tests, infrastructure build and nine tests,
  generator check/build and 12 tests, platform check/build and 51 tests passed.
  One credential-dependent hosted test remained explicitly skipped. All five
  production templates match remote main using the same worker artifact.
- Redeployed the shared local CDK environment and passed `local:test` again;
  [exact sanitized output](architecture/local-test-output.txt) records queued
  processing, storage, cleanup, concurrency, signed/correlated replies,
  duplicate/tamper rejection, mock broker recording, watchdog, alarms and retention.
  This rerun used the existing disposable environment; the earlier clean-checkout
  quickstart evidence remains a separate observation. The AWS quickstart does
  not start the newer platform/generator/CMS tooling. Public files, build assets,
  fixtures and sanitized evidence passed scoped prohibited-identifier/credential
  scans; reviewed screenshots contain only generic labels and public sources.
- Production is unchanged. `/architecture` is prepared until owner review,
  approved merge, the website release workflow and public behavior verification.
  App publication remains blocked by the existing workflow-write boundary: Carlos
  must supply the prepared CI workflow through an authorized route before App
  publication. Permissions were not expanded and no personal publishing fallback
  was used. The integration CI job remains advisory/non-blocking and unverified
  on a real GitHub runner.
