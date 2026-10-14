# Changelog

## 2026-10-14 — Collaborator readiness and default-sensitive policy

- Make every changed path sensitive except routine `docs/**` (excluding
  decisions, evidence, history and release verification) and root CHANGELOG,
  README and COSTS. Preserve rename-origin evaluation and Carlos's current-head
  approval rule; unknown paths and production assets now require approval.
- Keep blanket owner CODEOWNERS and clarify its permanent collaborator guard.
  Define write-access collaborators, their own-account agent publication,
  required 2FA, owner-only merge/approval, tag restrictions and prior agreement
  for `.github/` changes. Refresh AGENTS context from dated release evidence.
- Correct platform runtime dependency licenses using locked/installed metadata
  and notice-copy verification after production pruning. Verify sharp's separate
  libvips LGPL-3.0-or-later packages, including lockfile-matching Linux archives;
  document missing LGPL text and excluded axe-core third-party notice collection
  without changing the build. See [dependency findings](apps/platform/THIRD_PARTY.md).
- On Node 22.23.3, services check/build and all 150 tests pass; infrastructure
  build and nine tests pass. The required disposable LocalStack integration
  passes queued processing, signed/correlated reply, duplicate/tamper rejection,
  mock Operator and scheduled-control assertions. Website check/build, modified
  Markdown relative links/anchors and whitespace checks pass. Regenerate
  architecture provenance from six existing matching finalized drawings/receipts;
  retain their validated source revision and unchanged page/layout.
- Live default Operator profile preflight confirms repository-only access with
  no workflows permission, five required main checks and auto-merge disabled.
  No merge, production deployment, configuration, collaborator invitation or tags changed.
  After review/merge, the owner must deploy the runtime evaluator and verify a
  library-only PR fails policy until Carlos approves its current head.

## 2026-10-13 — Draft-based live edits (prepared for review)

- Add `site.edit.open`, retained draft history, live baseline/revision approval
  checks, normalized asset reuse and web-only redeployment in the same project.
- Reuse accounting columns for one successful edit per UTC monthly change;
  reservations, failures and retries remain distinct. Add edit inventory/reporting
  and retained reset summaries, including archived monthly report counts.
- Keep cached-preview artifact hashes in the snapshot transaction, and bind
  deployment audits to the job snapshot even when earlier content is reused.
- Generate immutable policy 2.3.0 / contract 2.3, require explicit presentation
  inputs for all new drafts and remove the change tool/schema/stub. Preserve 2.2.
- Verify lifecycle/concurrency locally with provider doubles and record survival
  through Docker PocketBase/Caddy edits and stored-byte restoration. Public
  rollback and library field deduplication remain explicit follow-ups.
- See [evidence and separately authorized hosted gates](docs/evidence/site-edits/README.md).

## 2026-10-13 — PR #41 platform CI browser prerequisite

- Install Chromium and its system dependencies through platform `pretest` before
  running the preview browser tests. The first PR run failed seven tests at
  browser launch because that job had no Playwright browser installation;
  quotas, concurrency and the production render budget were not the cause.
- Add the browser setup command to the local reproduction instructions and
  record the failing job and diagnosis in the quick-preview evidence.

## 2026-10-13 — Unverified quick preview (prepared for review)

- Add `site.preview.quick` using the trusted renderer directly, with explicit
  unverified platform chrome, distinct signed URLs, ephemeral bounded retention,
  and no hosted verification or model call. Blank and starter drafts share blockers.
- Add migration 009 for a separate quick quota; isolate rendering in a bounded,
  lower-priority child and preserve full verification, approval and deployment.
- Keep scripts disabled after evaluating opaque-origin script sandbox navigation;
  record local browser, rejection, quota and timing evidence in
  [quick-preview evidence](docs/evidence/quick-preview/README.md).
- Read-only preflight confirmed PR #40 main CI, Railway deployment, HTTP 200,
  discovery-only, and eight source-matching migration hashes. No production change.


## 2026-10-13 — Data-only website starters

- Implement ADR 015 starters with one experimental `profile` 1.0.0 data package,
  strict schema/compiler and frozen-version snapshots. English agent guidance
  never renders as site copy; no palette, font or language defaults are seeded.
- Add migration 008 for immutable website kind and nullable starter provenance.
  Copy starter structure once in the site/draft transaction; expose gated
  `starters.list` / `starter.get` and optional draft-create selection.
- Separate nonblocking starter suggestions from catalog/plan/completeness
  blockers. Require explicit presentation inputs for starter-created sites even
  after replacing every seed block; preserve blank-draft legacy behavior.
- Mark ADR 015 accepted on the basis of owner merge of PR #34 on 2026-10-12;
  clarify subsequent prompt numbering without changing its decisions.
- Locally verified three fictional MCP compositions, free composition, variant/
  token changes, tester gating, immutable SQL provenance and repeat migration.
  52 site-core, 84 generator and 86 platform tests pass (two platform tests opt-in
  and skipped); both existing byte-parity gates, browser matrices, Docker build
  and website checks/build pass. The full local verifier reports no axe violations,
  Lighthouse accessibility/best practices 1.00 and 390/1280 px screenshots.
- [Evidence and measured resources](docs/evidence/starters/README.md) distinguish
  local verification from production. Before publication, main `cf3f987` CI and
  Railway deployment succeeded; health returned 200, seven matching migrations
  and discovery-only. No production changes, merge or deployment of this work.

## 2026-10-13 — Runtime cleanup and collection data

- After owner-authorized read-only production inventory returned zero in all
  three precondition counts, retire policy 1.x/2.0/2.1 loaders/artifacts and the
  historical read/discard/deploy paths. Only 2.2.0 is supported; other versions
  report `policy_version_unsupported`. Current frozen contracts/policy, generator
  2.3.0 and output digests remain unchanged.
- Compile schema-validated CMS collections to inert data with the library
  tooling; renderer/validator, Caddy, PocketBase and editor consume their fields,
  bounds and rules. Current HTML/CSS/JS, Caddy/migration/editor bytes match the
  pre-cleanup baseline across all four current fixtures.
- Remove eight platform compatibility entry points and TOOL_ROLES exports; move
  six tool modules under `src/tools`. Capabilities exactly match registration in
  the same order; visibility snapshots deliberately remove 24 disabled library
  advertisements and reorder eight active tool lists/eight log-filter enums.
- Keep a short release-status table/open gates; archive prior prose/evidence
  unchanged, with relative references frozen to their original revision. Mark
  the AWS signed-email foundation legacy, maintenance only; AWS landing remains.
- Require fresh architecture provenance for architecture-relevant changes and
  release checks; warn on unrelated PRs with stale source fingerprints. Preserve
  structural, recorded-source and CSP gates.
- Observed local checks and byte hashes, removal line counts, deliberate snapshot
  differences and owner actions are in [cleanup evidence](docs/evidence/runtime-cleanup/README.md).
  No migration, production data change, tag, merge or deployment. The owner may
  tag pre-cleanup commit `27f642a` and must confirm the point-in-time inventory.

## 2026-10-13 — CI rebase and regenerated architecture evidence

- Rebase CI activation onto main `b58862c`, retaining merged platform source references and regenerating all six architecture artifacts plus official provenance from the resolved tree. Preserve drawing geometry; do not select either conflicted hash.
- Correct inherited author/committer identity on the branch commits to the Operator and rerun every local CI check job, including full browser, Docker, dispatch-only presentation/CMS and advisory LocalStack checks. Website freshness, actionlint and whitespace checks pass; retain [commands, durations and generated evidence](docs/evidence/ci-activation/rebase-2026-10-13.md). Publish only through the Operator with an explicit force-with-lease; no merge or production action.

## 2026-10-13 — opt-in Operator workflow tokens

- Add `development-workflows` only for explicitly selected tasks declaring workflow YAML changes; preserve default development and policy permissions, the enable switch and repository restriction. Reject invalid profiles/paths and audit the selected profile.
- Deploy only the owner-authorized DevelopmentBroker bundle; verify both real token permission sets, single-repository access and rejection of unrelated task paths, then revoke verification tokens. Services check/build and 58 tests, infra build/nine tests pass. Confirm the exact main-only website OIDC trust from source without changing it; retain dated [deployment and verification evidence](docs/evidence/ci-activation/README.md#authorized-broker-deployment-and-ci-retry--2026-10-13).
- Prepare CI publication through the opt-in profile with current main unchanged. Refresh broker source references through the official architecture pipeline. No PR #37, platform production, website deployment, main protection or auto-merge change.

## 2026-10-13 — CI activation publication retry

- Fetch and rebase `codex/ci-activation` against unchanged main `27ebab35`; retain completed local job evidence and recheck workflow lint/whitespace.
- Verify the Operator App registration now grants workflows write, while its installation still omits it. The broker-issued token push is refused again; no remote branch or PR is created. Record the installation approval and separately authorized broker profile/deployment prerequisites in [CI evidence](docs/evidence/ci-activation/README.md#part-b-retry--2026-10-13). Refresh the complete local patch; leave PR #37 and production untouched.

## 2026-10-12 — CI activation refresh and read-only production verification

- Refresh the unpublished CI workflow for root npm workspaces/site-core, pinned Node 22.23.3, loopback Postgres, generator units/full browser checks and repository-root image builds. Keep presentation/CMS checks dispatch-only and website delivery unchanged except the Node pin; refresh only the two workflow provenance hashes.
- Verify production health read-only at 21:38:15 UTC−04:00: HTTP 200, discovery-only and all seven migration names/hashes matching main `27ebab35`. Railway reports the exact successful active deployment; dashboard Wait for CI remains off. No production setting or resource changes.
- Operator App publication was refused for missing `workflows` permission. Save the full refreshed `.local/ci-workflow.patch`; no partial PR, permission change or protection workaround.
- Re-run exact local jobs and PR #37 head `d9137392`: 75 platform tests pass with two skips, all 79 generator units and full browser matrices pass; its built container applies seven migrations to a fresh local database and returns healthy discovery-only readiness. Record command durations, the corrected incomplete smoke harness failure and owner activation steps in [verification evidence](docs/evidence/ci-activation/README.md). Publication and GitHub-run evidence remain separate from local passes; no PR #37 push or merge.

## 2026-10-12 — platform tool registry and domain boundaries

- Replace hand-maintained tool permissions, capability filtering, conditional registration and site-failure lists with one typed definition per tool. Preserve tool orders, schemas, annotations, role denial and the existing discovery-only library advertisement; retain a derived `TOOL_ROLES` compatibility export for unchanged tests.
- Split identity, administration, drafts/uploads/snapshots/deployments, worker/recovery, cleanup, artifacts and existing billing/cost/report code into focused modules. Keep old import entry points and method facades; remove only the dead `Sites.change()` stub while `change.request` retains its current unavailable response.
- Capture and commit full tool/capability snapshots before refactoring for four roles × eight flag/dependency combinations. Node.js 22.23.3 platform check/build and 75 tests pass; two existing opt-in tests remain skipped. All existing tests are unchanged. AST comparison preserves 91 retained method/constructor bodies, SQL and transaction boundaries; every platform source module is below 500 lines. See [module boundaries, sizes and evidence](docs/platform-modules.md).
- Refresh moved-source architecture references and provenance with byte-identical integrated drawings. All six drawing gates and website check/build pass. The existing local browser regression passes with 52 checks/14 screenshots, browser approval, relative preview assets and sandboxing; fictional sessions do not establish Google authentication. No new tools, starter/preview/live-edit behavior, migration, policy, production change, merge or deployment. Delivery stops at an Operator App PR for Carlos Olivera Terrazas's review.

## 2026-10-12 — workspace PR review corrections

- Fix PR #36's failing website freshness gate: regenerate architecture evidence
  with site-core source paths, mapped line ranges and current root workspace
  inputs. Preserve all six drawings' topology and geometry. Include matching
  provenance in the owner-applied CI patch so applying its workflow changes
  also passes the freshness gate.
- Make the reusable fixture parity command check the existing boxed 2.1 golden
  file directly, in addition to the five pre-refactor source/output digests.
  Site contracts, policies, package bytes, migrations and generator version remain
  unchanged. Verification is recorded with the [workspace evidence](docs/evidence/site-core-workspaces/README.md).

## 2026-10-12 — site-core and npm workspace graph

- Move the website domain from the legacy email package into `@a2aviary/site-core`,
  with an explicit API and test-only catalog/presentation fixture exports. Platform
  and generator use package imports; plan loading reuses canonical JSON/SHA-256.
  Keep generated library data with its domain/presentation owners, byte-identical.
- Add one root workspace lockfile for `packages/*` and platform, retaining services,
  infra and website installations. Compare all direct versions and 913 historical
  generator/platform dependency edges: zero resolved-version differences. Remove
  services' unused Acorn compiler and Sharp dependencies, including Sharp-only
  transitive/native entries, without upgrading any dependency.
- Preserve all policy, contract, migration, package/template bytes and generator
  2.3.0. Five fixtures retain exact source and Astro output hashes; the relocated
  52 contract tests, 79 generator tests, 52 email tests and platform's 71 tests
  pass locally (two platform opt-in tests remain skipped). Add complete per-role
  MCP tools/list snapshots captured before the move and a reusable parity gate.
  Full library checking passes 148 captures and 168 presentation cases.
- Build the workspace image from repository root, prune dev dependencies and run
  as UID 1000 on Node 22.23.3 against disposable loopback Postgres with all seven
  migrations: health 200, discovery-only. Railway configuration is unchanged.
  [Verification and hashes](docs/evidence/site-core-workspaces/README.md) distinguish
  local evidence from hosted operation. The Operator lacks workflow-write scope;
  prepare the updated prompt-1 CI patch in excluded `.local/ci-workflow.patch` for
  owner application before merge. Stop at an Operator-authored PR; no deployment.

## 2026-10-12 — application types and categories recorded (docs only)

- Add proposed [ADR 015](docs/decisions/015-application-types-and-categories.md) recording the owner's four axes, one-time data-only starters, immutable provenance, agent-supplied values, two preview levels, live editing, experimental promotion and exclusions. Include a fictional empty-props example, explicit conflicts with earlier records, prompts 3–7 and the two open starter questions.
- Link the decision from agent instructions, the decision index/confirmed owner direction, vision and plans without rewriting historical evidence. Verified all 359 relative documentation links, parsed the fictional JSON with empty seeded props, reviewed decision consistency and confirmed six Markdown files only with clean whitespace.
- No source, migration, policy, contract, provider or deployment changes. ADR status remains proposed until owner merge; publication stops at an Operator App PR for review.

## 2026-10-12 — platform and generator CI protection prepared

- Prepared credential-free PR/main platform check/build/Postgres tests, generator static/build/unit/full library browser checks, and the repository-root platform Docker build. Node actions use 22.23.3; existing full action SHA pins and website OIDC delivery are preserved. PR check jobs cancel superseded runs; main check groups are unique per run.
- Presentation verification and Docker CMS/volume checks are manual-dispatch only. Added CI coverage and owner instructions for required checks and Railway **Wait for CI**; the exact dashboard label was verified read-only and the toggle was off. No production setting was changed.
- Local platform check/build/tests passed (70 passed, two opt-in fixtures skipped), generator static/build, 79 unit tests and the full library browser matrix passed, services check/build and 104 tests passed, infrastructure build and nine tests passed, and the platform Docker build, presentation verifier and both Docker CMS checks passed. The unpublished broken-import branch failed the platform check with TS2882; the source was restored. Workflow lint, relative links and whitespace passed.
- The Operator App push was refused for missing `workflows` permission. Saved the complete workflow patch under ignored `.local/ci-workflow.patch` and retained only documentation for publication; current CI is unchanged. No App permission was requested or changed. With the owner's minimum exception, the official architecture integration script refreshed only `docs/architecture/provenance.json` (two workflow hashes); emitted architecture HTML is byte-for-byte unchanged and no other generated artifact changed. The full owner patch includes both workflow files plus matching provenance and passes website check/build locally. The provenance cannot be published separately from the withheld workflows. This coupling is expected to be relaxed in a later cleanup PR. New-job GitHub evidence, required status checks and Railway deployment gating remain owner actions.

## 2026-10-12 — hosted fixture CMS target

- Select the hosted CMS write target from the verified spec's declared and bound collections instead of assuming `catalog`. Record the CMS stage and HTTP status; a spec with no collections must reject an undeclared write with HTTP 404 and records `no collection to edit`.
- Give every hosted presentation variant one fictional announcements declaration and block, preserving the static presentation compositions. Reject undeclared bindings and declared-but-unbound fixture inputs rather than silently skipping CMS coverage.
- Add unit coverage for all three hosted variants, target selection and status failures. The opt-in local CMS regression prepares the exact hosted `light-es` input through MCP drafts/uploads, then uses real PocketBase/Caddy to write and read announcements, confirm the old catalog target returns 404, and verify the no-collection case. All three focused tests passed locally; hosted execution remains separately authorized.

- Node.js 22.23.3 generator check/build, all 79 tests and the library browser matrix (including 168 presentation cases) passed. Platform check/build and 70 tests passed; the hosted test remained skipped and the separate local CMS suite passed all three tests. Website check/build, all four gates for six regenerated architecture drawings, and integrated browser checks passed. Refresh provenance, CMS evidence and desktop/mobile/hosting captures without changing topology. No hosted run or deployment was performed; stop at an Operator App PR for owner review.

## 2026-10-12 — deployment staging permissions

- Set client web and CMS staging files to `0644` and directories to `0755` before upload, including nested web assets, so container users such as PocketBase UID 1000 can read files copied into the image even when the adapter inherits `umask 077`.
- Add an isolated adapter regression that stages both services under `umask 077`, checks every staged file/directory mode, preserves web artifact bytes and confirms temporary-directory cleanup. It reproduced the original `0700` CMS directory and passes with the fix.
- Node.js 22.23.3 generator check/build, the library browser matrix (including 168 presentation cases) and all 79 generator tests passed. Platform check/build and 68 tests passed; the hosted test remained skipped. No hosted run or deployment was performed; delivery stops at an Operator App PR for owner review.
- Regenerate all six architecture drawings against the committed permission fix, refresh source ranges/fingerprints and desktop/mobile/hosting captures, and link staging behavior to its local regression. All four Archify gates, website check/build and integrated browser checks (five stages, 44 nodes, keyboard/focus, mobile, CSP and JavaScript-free access) passed. Inspect the existing hosting readiness detour without changing layout; rerun generator/platform checks, builds and tests with the same passing counts above.

## 2026-10-12 — first reusable presentation package batch

- Add policy 2.2.0/contract 2.2 and generator 2.3.0 with twelve 1.0.0 experimental, tester-only packages: profile card/flip, timeline, flip/tilt/copy behaviors, aurora/glow/reveal/shimmer effects, and pinned Latin Space Grotesk/JetBrains Mono with original OFL licenses. Stable feature-grid/link-cards/CTA variants become 1.1.0 for item/anchor targets. Existing budgets and defaults remain unchanged.
- Require owner-language shell/control labels declaratively, including transitive dependencies. Save incomplete/blank-label drafts with exact missing paths; reject incomplete preview/build. Keep escaped 404 copy as data, confined numeric pointer/style/clipboard capabilities, selected manual-copy fallback, stale-result suppression and readable no-JS/initializer-failure behavior. Freeze 2.1 artifacts and preserve legacy bytes and historical stored-snapshot deployment.
- Add three equal-status fictional compositions, original generated sculpture provenance, 148 library captures and 168 presentation matrix cases covering fonts/system controls, content boundaries, optional image/contact, widths, motion and card states. Native clipboard, denied/unavailable access, newer-interaction/blur races, pointer changes, keyboard, no-JS and unsupported scroll fallbacks are verified. Three real local Astro verifiers pass all ten configured checks with Lighthouse accessibility/best-practices 100/100, zero axe violations and no external requests; record measured package/output sizes and sanitized captures in [local evidence](docs/evidence/presentation/README.md).
- Node.js 22.23.3: 78 generator, 104 service, 68 platform and nine infrastructure tests pass; one hosted platform test stays skipped. Local foundation integration, six architecture artifacts with all four gates, website checks/build and integrated desktop/mobile/keyboard/no-JS verification pass. Regenerate contracts, catalog, notices and committed-source provenance; extend the hosted runner with a locally tested allowlisted composition selector.
- No migrations, infrastructure additions, production changes, hosted runs, merge or production deployment. Preserve the original checkout's verifier edit. Operator App publication stops for owner review; review, merge timing and a separately authorized hosted run remain owner actions. See [release verification](docs/history/release-verification-2026-10.md#presentation-batch--2026-10-12-local-implementation) for implemented/verified/not-verified distinctions and test-double boundaries.

## 2026-10-11 — web-simple 2.1 library runtime

- Add policy 2.1.0/contract 2.1 and generator 2.2.0: optional section/block effects, strict language tags, mono fonts, motion and flush layout. Preserve default boxed HTML/CSS and legacy font resources byte-for-byte against PR #29 fixtures. Freeze all 1.0.x/2.0.0 artifacts; old drafts remain readable/discardable and stored historical approved snapshots deploy their original verified bytes.
- Extend the curated compiler to five strict package types with dependency/status/compatibility checks, deterministic gzip budgets, duplicate signatures and overlap warnings. Package the pinned Latin Inter/EB Garamond bytes with OFL licenses. Restricted templates, CSS and Acorn-validated behaviors compile to inert data; conditional external JavaScript supports native/no-JS content, keyboard interaction and initializer failure isolation. Fictional effects/behaviors/variants remain isolated test fixtures.
- Apply immutable server-owned test audience to draft/preview/worker admission, retain atomic revisions/idempotency, expose a 24 KiB compact manifest and gated read-only `library.get`, and bind preview reuse to policy/generator/checker/package provenance. Require full-route reduced-motion and browser-wide external-request checks, including Lighthouse. Add Caddy zstd/gzip negotiation with byte/CSP regression coverage.
- Node.js 22.23.3: 65 generator, 104 services, 63 platform and nine infrastructure tests passed; one hosted platform test was skipped. The library browser matrix passed 76 cases and the real Astro verifier passed 52 checks. Local Caddy/CMS compression and both volume cases passed; the rebuilt non-root container generated seven pages with networking disabled. Regenerated six architecture drawings against committed source and passed website checks/build plus integrated keyboard/mobile/no-JS browser verification.
- Record local checks and rejection-rule coverage in [release evidence](docs/history/release-verification-2026-10.md#web-simple-21--2026-10-11-local-implementation). Services CI and Docker retain explicit static library checks; generator check/test run the full local browser matrix. Workflows, migrations, hosted fixtures and production configuration are unchanged. The recorded production HTTP 503 remains unresolved; delivery stops at an Operator App PR for owner review.

## 2026-10-11 — component library foundation

- Move the twelve policy 2.0.0 components and their standard presentations into [versioned library packages](library/README.md). Add a generated 24-package registry with exact file hashes and policy agreement checks; reserve behavior/effect/font metadata without implementing packages.
- Replace the component switch with a core-owned, typed logic-less template interpreter. Validate the restricted tag/attribute grammar and scoped token CSS at build/check time; bundle AST/CSS data and include only used variant styles. Generator version is `2.1.0`; wrappers add `data-v`, while content, relative links, CMS JavaScript, font licenses, CSP and stored-snapshot deployment remain unchanged.
- Enforce library checks through generator check/build/test and the existing services CI check without changing workflows or adding dependencies. Add [proposed decision 014](docs/decisions/014-component-library.md), maintainer documentation, hostile-input regressions and a pinned baseline HTML/CMS fixture.
- Node.js 22.23.3 generator check/build and 53 tests passed; platform check/build and 58 tests passed against loopback Postgres, with the hosted test explicitly skipped; services check/build and 104 tests and infrastructure build/nine tests passed. The real seven-page Astro verifier passed 37 checks; local PocketBase/Caddy editing and both volume cases passed. The local non-root platform image generated seven pages without a source library directory or network access.
- Compared every page in the manifest example and existing fixture against main `02b8115` at 390/1280 px, with empty/populated/error CMS responses: all 84 decoded-pixel comparisons had zero differences. HTML matched after whitespace normalization and removing only new `data-v` attributes. Inspected the mobile/desktop home captures; the [repeatable procedure](packages/generator/README.md#equivalence-procedure) retains before/after/diff evidence locally. No intentional visual or content differences.
- Regenerated all six architecture drawings against committed library source; all four gates passed. Added library source fingerprints. Website check/build and integrated browser checks passed five stages/44 nodes, keyboard/focus, desktop/mobile and JavaScript-free behavior under production CSP; inspected the desktop/mobile, engine and hosting route captures. Relative documentation links and whitespace checks passed.
- No policy/contract/migration change, hosted fixture, production configuration, deployment, merge or HTTP 503 repair. Delivery stops at an Operator-authored PR for owner review; merging main auto-deploys, and no new configuration is required.

## 2026-10-08 — site runtime flag startup repair

- Remove the redundant flag rejection that crashed startup when the workflow was enabled but drafts were absent or disabled. Preserve malformed-flag rejection, provider configuration checks and the requirement for both flags before site operations are available.
- Add generator flag-matrix and default platform startup/health regressions. Both reproduced `Invalid SITE_WORKFLOW_ENABLED` before the fix. Local health now returns discovery-only HTTP 200 against all seven migrations without creating a site; hosted fixtures remain disabled.
- Node.js 22.23.3 generator and platform checks/builds passed, with 46 generator tests and 58 platform tests passing; one opt-in hosted test was skipped.
- Regenerate all six architecture drawings against the committed fix; all four gates passed for each. Website checks/build and the integrated browser suite passed five stages/44 nodes, desktop/mobile, keyboard/focus and JavaScript-free access under production CSP. Desktop/mobile and the flagged hosting readiness route were visually inspected.
- Record the inspected Railway startup failures and the inferred six-/seven-migration readiness mismatch in [release verification](docs/history/release-verification-2026-10.md#read-only-diagnosis-and-prepared-recovery--2026-10-08). Production last returned HTTP 503; this delivery does not merge, deploy, restart, roll back or change production variables, database or bucket.


## 2026-10-08 — documentation synchronized with production state

- Added a current status table, the open gates before the first client site, and an owner- and agent-reported record of the 2026-10-07 schema reconciliation, site configuration, four hosted fixture attempts and workflow activation on main `89b92fe` to [release verification](docs/release-verification.md#current-status). Decision 013 reached main at 2026-10-08 15:49 -0400 in `b9bd1f8` and `6ff79db`. The single public health GET at 16:46:22 -0400 returned HTTP 503; current rollout, mandate and migration inventory are unverified, and readiness is the first open gate.
- Corrected the server-draft records that still described production migration 006 as unreconciled (decision 013, site operations, plans, release evidence, vision and README); the earlier `/healthz` response on main `89b92fe` reported all six migrations with matching hashes (agent-reported historical evidence).
- Restored a site [configuration table](docs/sites.md#configuration) for both workflow flags and added a [production test procedure](docs/sites.md#production-test-procedure) for drafts (tester identity, `SITE_DEPLOY_ENVIRONMENT`, `first_client_pilot` at draft creation, browser approval, prefix cleanup). Documented the upload, preview and approval endpoints and `/healthz` fields in [platform](docs/platform.md), and added a minimum [Railway platform runbook](docs/runbooks.md#railway-platform).
- Corrected outdated or contradictory statements: deployment status in README, vision, roadmap, AGENTS, SECURITY, GOVERNANCE, CONTRIBUTING and decisions 007, 008 and 012; migration readiness; CI coverage (platform and generator are not built in CI); `seed` and `switches` effects; DMARC enforcement; the alarm count (ten alarms, 19 metrics); the watchdog cadence; the scope of the $25 target and $10 model cap; and the missing Railway, bucket and sandbox cost lines. Marked the signed-email foundation as legacy and removed delivery-specific instructions from the runbooks.
- Review checks passed on Node.js 22.22.3: documentation-only path scope, architecture freshness, 318 relative links/anchors across 47 tracked Markdown documents, whitespace, and website clean install/check/build. Static review confirmed migration 006 is byte-identical to pre-drafts main, both workflow flags/configuration, draft-time first-client assignment, environment guards, route methods, CI coverage, ten alarms/19 underlying metrics and the one-minute watchdog. Earlier hosted results were not rerun.
- Documentation only: no code, infrastructure, contracts, website data or architecture sources changed. Earlier production observations remain owner- or agent-reported; this review independently observed only the HTTP 503 and verified the merge history. Corrected human upload routes to GET with PUT image writes, clarified deployment environment guards and first-client assignment, and aligned the CloudWatch cost row with ten alarms/19 metrics. The public pricing and Terms copy, `website/public/costs.json` and `apps/platform/README.md` (an architecture-fingerprinted file that still describes the 006 mismatch) need separate changes.

## 2026-10-08 — server drafts, shared uploads and browser approval

- Publish policy 2.0.0/site contract 2.0; preserve frozen historical artifacts and migrations 001–006. Append migration 007 for revisioned drafts, retry receipts, shared upload sessions, rolling quotas, snapshot provenance and immutable approvals. Both workflow flags are required; drafts default off. Remove legacy intake, client approval/preview fields, `site.build` and visual parity dependencies; disable change requests pending redesign.
- Add atomic catalog mutations, secret-free bounded image normalization, authenticated human uploads and scoped agent capabilities. Generate server snapshots with required page screenshots; reuse verified bytes without reusing approval. Browser approval requires current scoped membership, exact Origin and single-use CSRF. Signed previews have iframe and response-header sandboxing; deployment rechecks immutable approval and deploys stored bytes exactly. Durable cleanup covers staging and expired unreferenced artifacts while retaining audit history.
- Node.js 22.23.3 checks/builds and tests passed: 104 services, 43 generator, 57 platform (one hosted test skipped locally) and nine infrastructure. The real browser workflow passed 37 checks with 14 screenshots; local PocketBase/Caddy integration and both volume ownership cases passed. Seven migrations applied twice and inventory/hash tampering failed readiness. Refreshed six Archify drawings and current workflow/ADR/threat-model documentation. Website checks/build and five browser suites passed; the existing homepage animation diagnostic remained limited by a preference-change timeout and headless GPU-driver warnings.
- Exactly one hosted tester fixture passed the agent probe, then stopped at its first upload with HTTP 503 before verification or provisioning. One teardown attempt failed; read-only bucket inventory returned AccessDenied HTTP 403. The fictional draft prefix remains unverified, with no confirmed bucket deletion. No OpenAI session or Railway fixture project was created; billed amounts remain unavailable. See [release evidence](docs/history/release-verification-2026-10.md#server-drafts-and-previews--2026-10-08-local-implementation-hosted-fixture-failed).
- Production migration 006 reconciliation was subsequently owner-reported complete; artifact permissions/cleanup, hosted end-to-end proof and real Google authentication remain unresolved gates. Decision 013 subsequently reached main at 15:49 -0400; current readiness and migration 007 remain unverified after HTTP 503. No production activation, variable/DNS/payment changes, merge or deployment occurred.

## 2026-10-08 — architecture freshness restored for verifier delivery

- Regenerated all six Archify drawings and integrated provenance against the committed verifier/CMS fixes, with corrected source ranges and refreshed desktop/mobile evidence. The source freshness check remains enforced; the five-stage architecture and runtime behavior are unchanged.
- Node.js 22.23.3 passed the complete CI command sequence: website check/build, service check/build with 113 tests, and infrastructure build with nine tests. Every drawing passed all four finalization gates; the integrated browser suite passed all five stages and 44 technical nodes, keyboard/focus behavior, mobile layout, JavaScript-free access and same-origin CSP checks.

## 2026-10-08 — PocketBase runtime volume ownership verified locally

- Start the pinned CMS image as root, change ownership only of `/pb/pb_data` to UID/GID 1000, then exec PocketBase through `su-exec` as that user. PocketBase/Alpine pins, download checksums and serve flags are unchanged; no runtime UID variable is added.
- Add an explicit Docker bind-mount regression test: an empty root-owned directory reproduces SQLite error 14 with the previous image, while the new image passes health with PID 1 at UID/GID 1000 and the binary still root-owned. Attempt tester reset in the cloud fixture teardown after a failed stage, preserving the original failure and recording cleanup errors and leftover resources privately.
- Node.js 22.23.3 generator check/build and 40 tests passed; platform check (including contracts) and 61 tests passed, with one opt-in hosted fixture skipped. Both bind-mount cases passed. Hosted verification and owner review remain separate gates; no production rollout or activation is implied.

## 2026-10-08 — hosted verifier publication ordering verified locally

- Create the credential-free, tool-free verifier session without initial input; wait for connected setup and required live output files before submitting the original acknowledgement. Collect only its completed turn's artifacts and retain existing report/hash checks and size limits.
- Distinguish session creation, setup failure/timeout, missing outputs, failed/incomplete turns, unpublished artifacts, download failure and malformed reports. Actual checker failures remain `verification_failed`; session cleanup reports a separate safe code without masking the outcome.
- Node.js 22.23.3 generator check/build and all 40 tests passed; platform check (including contracts) and 55 tests passed, with the opt-in cloud fixture skipped locally. Mocked tests cover ordering, error codes, filtering, failing checks, deletion and private-error redaction. The hosted fixture runs of 2026-10-08 are recorded in [release verification](docs/history/release-verification-2026-10.md#hosted-catalog-activation--2026-10-07-to-2026-10-08-owner--and-agent-reported).

## 2026-10-08 — hosted verifier network allowlist

- Allowed `storage.googleapis.com` in the verifier sandbox network allowlist because the pinned Playwright Chromium download redirects there. Without it, the first hosted fixture attempt failed before any Railway resource was created.

## 2026-10-07 — catalog-only starting state

- Archived the retired adoption implementation in the annotated [archive/imported-static](https://github.com/carlos-olivera/a2aviary/tree/archive/imported-static) tag at main `0dc4245`, published through the Operator App before editing.
- Removed adoption tooling, releases, provider bindings, generator modules, contracts and flags. Kept Railway/catalog/PocketBase, scoped verified-email administrators, owner billing eligibility, immutable operation history, daily private costs/reports and first-client designation.
- Prepared policy 1.0.1 with rationale-only changes and unchanged limits; preserved frozen 1.0.0 artifacts. Rewrote migration 006 for clean databases and added fail-closed migration inventory/readiness. Production already applied the earlier 006, so rollout required separately approved reconciliation; the owner applied it the same night.
- Node.js 22 checks/builds passed, with 113 service, 13 generator, 55 platform and nine infrastructure tests; one hosted fixture remains explicitly skipped. Six migrations applied to an empty disposable database idempotently and passed health. Frozen artifacts and policy values were verified. All six website browser suites, 37 real catalog fixture checks and PocketBase/Caddy integration passed locally. Architecture provenance/screenshots were regenerated with the existing pipeline. No production cleanup, deployment, merge, payment integration or outbound messages were performed.

## 2026-10-06 — five-stage architecture overview verified locally

- Replaced the initial low-level map and global evidence grid with five connected macro-stages, matching accessible tabs and one selected technical panel. Switching resets evidence; Back restores the overview. Native collapsed stage disclosures preserve JavaScript-free access, and the AWS quickstart is collapsed by default.
- Refreshed the architecture branch from remote main to include auth/MCP, Astro generation, Railway/PocketBase/Caddy and tester/admin source. The earlier owner-reported customer deployment label is superseded by the October 7 empty client inventory. Future customer products retain Planned styling; signed email remains a labeled legacy path.
- Added exclusive stage membership and six Archify 3.0.1 finalized drawings, committed-source provenance and fingerprints for platform/generator/policies as well as AWS/local tooling. Kept same-origin assets, MIT notices, metadata, CSP and extensionless routing.
- Local S3 redeployment and signed-email integration assertions passed. Node.js 22 checks passed with 113 service tests, nine infrastructure tests, 12 generator tests and 51 platform tests (one credential-dependent cloud test skipped). Production templates match remote main with a shared worker artifact. Browser checks covered all five selections and 44 technical nodes, desktop/mobile, keyboard/focus/reset, native fallback, source links and zero automatic cross-domain requests.
- Updated architecture/local/contribution guidance and retained sanitized test output and screenshots. Production is unchanged. Operator publication remains blocked on the existing workflow permission boundary; the owner must supply the CI workflow through an authorized route before App publication and current-head approval.

## 2026-10-06 — architecture and local verification prepared

- Added a source-backed Archify 3.0.1 interactive architecture map with editable metadata, pinned source provenance, same-origin assets, local coverage and explicit planned capabilities. Integrated `/architecture`, navigation, sitemap and HTML MIME without changing CSP; no external resources load automatically.
- Added an isolated CDK local target, pinned token-free Community 4.12.0 Compose environment, production workers, safe OpenAI/GitHub stand-ins and explicit SES adapters. Node.js 22.23.3 clean-checkout quickstart/deploy/test/down passed, exercising queued processing, storage, cleanup, signed replies, rejection, broker recording and scheduled controls. Cloud-only boundaries and legacy image maintenance are documented.
- Added a read-only advisory integration workflow, source-fingerprint freshness gate and contribution guidance. Website checks/build, service checks/build and 49 tests, infrastructure build and nine tests pass; all five production templates match remote main when synthesized with the same worker artifact. Browser checks under production CSP cover desktop/mobile, keyboard controls and zero other-domain requests. See [release evidence](docs/history/release-verification-2026-10.md#architecture-and-local-environment--2026-10-06-prepared).
- Operator App publication was attempted after verification. GitHub refused the new CI workflow under its existing permission grant; no branch/PR was published and the token was revoked. The owner must supply that workflow through an authorized route before App publication can continue.
- This is prepared source and local verification. Owner review/approval, approved merge, website release and public route verification remain separate gates; no production infrastructure was deployed.

## 2026-10-06 — testers and chat-only superadmin verified locally

- Added durable tester enrollment, automatic free pinned-plan discovery, immutable site/spec/job test classification and tester access to the existing approved-spec workflow. Test sites always use dedicated Railway fixture projects and managed staging hosts; customer-domain bindings are rejected. The policy's successful-change allowance remains unchanged.
- Added superadmin-only tester management, site inventory/inspection and bounded redacted log queries. Admin revocation now accepts email and safely repeats; the legacy user-ID form remains supported. Cross-client administrative/audit tools, including the legacy audit reader, are superadmin-only. Login and consent remain the only platform pages.
- Added confirmed, audited test-only reset with active-job/protected-resource guards, retryable partial cleanup, accepted-artifact/history deletion and archived site identities. Accounts, allowlists and audits remain; off-volume backups and bucket object versions remain private archives under owner-controlled retention. Duplicate submissions no longer write unused copies of assets.
- Node.js 22 generator/platform/service/website/infrastructure checks passed: 12 generator tests, 51 platform tests (one credential-dependent cloud test skipped), 112 service tests and seven infrastructure tests. The local non-root platform container passed readiness with five migrations, discovery, login and default-off site workflow. Contracts, licenses, documentation links, whitespace and scoped credential-pattern review were checked.
- Added [tester/admin operations](docs/testers-and-admin.md) and decision 010. No new required environment variables or remote resources were created. Review/merge, staging rollout, narrow provider list/delete permissions, real hosted tester/reset verification and authenticated Claude/ChatGPT smoke tests remain owner gates. Production AWS configuration, DNS, the production MCP origin, payments and external sites were untouched.

## 2026-10-06 — catalog site workflow verified locally; cloud fixture pending

- Added deterministic approved-spec Astro catalog generation with original asset bytes, pinned local fonts, preview/hash gates, hosted Agents verification source and private bucket storage. No research, OCR, image adaptation, AI-generated CSS, policy mutation or AWS brief-analysis extension was added.
- Added optional owned MCP build/status/deploy/change jobs, authenticated upload/artifact routes, durable Postgres jobs, explicit confirmations, audit results and concurrent UTC monthly reservations. Four successful changes per month retain the two-page/ten-block/one-shared-operation policy caps; uncertain deployments hold reservations for manual reconciliation.
- Added guarded isolated Railway project/service/volume provisioning, pinned PocketBase collections/editor/backups, Caddy proxy/domain status, resource caps and deployment-ID readiness. Site workflow defaults off. New variables and manual steps are in [site operations](docs/sites.md); source protection now includes `packages/`, without deployed evaluator activation.
- Node.js 22 generator/platform/service/website/infrastructure checks passed locally: ten generator tests, 38 platform tests, 112 service tests and seven infrastructure tests. Real seven-page browser verification passed 37 checks, repeated output hashes matched, a changed approved preview failed visual verification, and PocketBase/Caddy plus non-root platform container checks passed. Dependency notices, contracts, documentation links and whitespace were checked.
- The real hosted OpenAI/Railway/bucket end-to-end test remains pending private development credentials (one explicitly skipped test). No remote resources, DNS, production AWS configuration, platform deployment, payments, tester mode or external site work were performed. Earlier owner edits and dated verification records are preserved.

## 2026-10-06 — platform retry evidence and saved owner instructions

- Recorded Carlos's successful retry report and the independently observed HTTP 200 login response with `Referrer-Policy: strict-origin`. Preserved prior local verification records and distinguished this evidence from independently verified authenticated ChatGPT/Claude admin-tool calls.
- Included the previously saved owner instructions and their original changelog entry unchanged for PR review. Documented that Phase 2 and the form repair were merged into `codex/web-simple-contracts`, while main still contains Phase 1 only. Documentation links, consistency and whitespace passed; no runtime code, cloud settings, merge or deployment was changed by this delivery.

## 2026-10-06 — native login and consent form Origin repair verified locally

- Reproduced the reported deployed Google-button failure in Chrome: `no-referrer` made the HTML form submit `Origin: null`, rejected with HTTP 403. Login/consent now use `strict-origin`, preserving browser Origin while withholding paths/queries from referrers; other routes retain `no-referrer`. Missing, null and foreign Origin checks remain enforced.
- Node.js 22 platform check/build, all 30 Postgres-backed tests, documentation links and whitespace passed. Real Chrome native login and consent clicks passed locally with fictional users/clients, correct Origin, origin-only Referer and HTTP 303 Google/client redirects; the consent callback carried a code. No external Google authentication, cloud repair deployment or live connector operation was claimed.

## 2026-10-06 — explicit staging origin opt-in verified locally

- Added `PLATFORM_ALLOWED_ORIGINS` for exact alternate HTTPS deployment origins, with an empty default preserving the canonical production restriction. Invalid or wildcard entries fail closed; issuer/resource/login trust remain bound to the single selected origin.
- Documented the requested Railway staging origin, Google callback and private configuration in [platform operations](docs/platform.md). Node.js 22 platform check/build, all 29 Postgres-backed tests, documentation links and whitespace checks passed locally. No merge, deployment or external Google/client verification was performed.

## 2026-10-06 — discovery OAuth/MCP platform verified locally

- Added an isolated Node.js 22/TypeScript Railway service with pinned Better Auth JWT/MCP/CIMD, Google login/consent, July 2026 POST-only official MCP v2, resource-bound OAuth, Postgres migrations and discovery-only plan tools. DCR is off by default; no site production, payments or live connector activation was added.
- Added verified configuration-pinned owner bootstrap, invited admins, clients and allowlisted testers; role-filtered tools, explicit confirmations, atomic audit records and own-user ES256 public-key registration/revocation. The existing AWS email registry stays owner-controlled through a documented manual enrollment/revocation bridge, without platform AWS credentials or transport changes.
- Added container/compose/Railway preparation, DB readiness and rate limits, safe bigint parsing, dependency notice preservation, source protection for apps and Docker context rules, and [endpoint/environment/client instructions](docs/platform.md). Deployed trusted-policy activation remains separately authorized.
- Node.js 22.23.3 platform check/build and 26 Postgres-backed tests, existing service check/build and 111 tests, website checks/build and seven infrastructure tests passed. Container build, non-root runtime/migrations/readiness/auth smoke, generated contracts, published Railway schema structure, documentation links, whitespace and secret checks were verified locally. External Google sign-in and actual ChatGPT/Claude compatibility remain unverified. Owner review, merge, private configuration and deployment remain separate actions.

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
- Conditionally released only the two prior-denial receipts for processing of their original notifications, preserving receipt IDs/timestamps and duplicate protection. Actual SES acceptance is recorded in [activation evidence](docs/history/release-verification-2026-10.md#human-support-permission-repair--2026-10-05-activated); inbox, original attachment and reply delivery remain owner verification steps.

## 2026-10-05 — raw support-send permission repair prepared

- Traced two missing support messages to successful SES receipt/storage and held forwarding records. The worker lacked ses:SendRawEmail; a same-restriction live diagnostic reproduced a 403 denial naming that action. Prepared the missing raw-send permission without broadening sender, identity or recipient restrictions, plus definite access-denial handling and redacted send-error logging.
- A second empty-MIME diagnostic under corrected temporary permissions was unexpectedly accepted; the owner may receive a blank test email. The no-delivery assumption was wrong, the SES ID was not captured, and neither original receipt was replayed. Real inbox/reply delivery remains unverified; diagnostic credentials were removed.
- Service check/build and all 48 tests, infrastructure build/synthesis and all seven tests passed. Permission repair and bounded held-message recovery await owner review and separate activation; see [incident evidence](docs/history/release-verification-2026-10.md#human-support-send-refusal--2026-10-05-repair-prepared).

## 2026-10-05 — human-support forwarding activated

- After owner approval/merge of PR #10 and separate deployment authorization, inspected and executed the email/runtime/controls change sets; all three stacks reached UPDATE_COMPLETE. Existing owner-attribution tags and shared worker assets were updated; no existing resources were removed, definitely replaced, or given DNS template changes.
- Verified active hello@ receipt routing, preserved agent/test rules, the Active Node.js 22 forwarding worker, Enabled SQS trigger, fixed private destination, support retention/TTL, and empty support queue/DLQ. SES sending identity/DKIM/MAIL FROM and production sending are enabled; owner-alert subscription is confirmed and support alarms are connected. See [deployment evidence](docs/history/release-verification-2026-10.md#human-support-forwarding--2026-10-05-deployed).
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

## 2026-10-05 — persistent project instructions

- Recorded the owner's future-task rules in `AGENTS.md`: Operator App publication, feature branches and PRs, disabled repository auto-merge, owner review before merge/deployment, evidence-based release and pricing claims, full-name attribution, and separate human/agent contact addresses. These instruction changes are saved locally; no additional publication or deployment was performed.

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
