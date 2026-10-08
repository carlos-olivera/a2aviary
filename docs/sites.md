# Server drafts, uploads, preview and approval

Current source implements [decision 013](decisions/013-server-drafts-and-preview.md). It is enabled only when **both** `SITE_WORKFLOW_ENABLED=true` and `SITE_DRAFTS_ENABLED=true`; drafts default to false. See [release evidence](release-verification.md) for observed checks and unresolved rollout gates. This delivery does not activate production, reconcile its migration inventory, change DNS, add payments or merge a PR. Nothing is for sale; there is no live checkout or active Paddle merchant of record.

## Current workflow and contracts

The client's LLM supplies catalog content incrementally. a2aviary normalizes uploads and owns snapshot generation/verification. Human approval happens through the authenticated browser page after verification, followed by explicit MCP deployment confirmation. Current policy is `web-simple` **2.0.0**, site contract **2.0**. Canonical specs contain complete catalog content and server-generated normalized asset metadata, without client approval or preview fields. Hash the entire spec using sorted-key JSON, preserving array order. Immutable approval records separately bind revision/spec/output, actor and time.

Historical 1.0.0/1.0.1 artifacts remain in Git but are not advertised or accepted as intake contracts. `POST /api/site-specs` and `site.build` are removed. `change.request` returns `change_requests_unavailable`: its draft/approval redesign is pending; CMS edits remain available. Initial-site drafts cannot redeploy an already-live site.

| Tool | Arguments | Behavior |
| --- | --- | --- |
| `site.draft.create` | `slug`, UUID `requestId` | Create incomplete owned draft/site |
| `site.draft.apply` | `draftId`, `expectedRevision`, UUID `requestId`, `operations` | Atomic validated batch; return new revision |
| `site.draft.get` | `draftId`, optional `detail`, `after` | Compact summary; explicit `full`, page ID, or paginated `assets` |
| `site.draft.discard` | `draftId`, `expectedRevision` | Supersede snapshots, revoke sessions, schedule cleanup |
| `site.upload.open` | `draftId`, UUID `requestId` | Both channels, expiry, QR and selection rule |
| `site.upload.status` | `sessionId`, optional `after` | Normalized metadata/progress, never capability secrets |
| `site.upload.revoke` | `sessionId` | Terminate both channels |
| `site.preview` | `draftId`, `expectedRevision` | Assemble complete immutable spec, deduplicate/queue verification |
| `site.status` | `siteId` | Latest snapshots, approval/verification/deployment states and artifacts |
| `site.deploy` | `siteId`, `specId`, `cmsPassword`, `confirmation`, optional initial `domain` | Deploy approved stored bytes |

Operations: `settings` supplies tokens/navigation/CMS; `upsert-page`/`remove-page`; `upsert-section`/`remove-section`; `upsert-block`/`remove-block`; `asset-metadata` sets alt text on server assets; `remove-asset` removes metadata. IDs remain stable; insertion uses zero-based `index`; supplying it on an existing ID also reorders that entity. Upserts replace the selected entity, so retain desired fields/children in its payload. A parent must exist before inserting its child. Missing required content and forward references are allowed during drafting and reported as preview blockers. Supplied values and aggregate budgets are validated immediately. A failed batch writes nothing. At most 32 operations and 64 KiB per batch, 256 KiB complete JSON, 20 errors, 4 KiB default summaries. Errors identify operation index/path/rule/limit/actual and correction guidance. Request IDs are actor-scoped and bind the full request; conflicting reuse fails. Revisions prevent overwrite and increment only for actual content changes, including newly attached normalized assets.

## Shared upload session

Open returns a short `/u/<id>` human URL, same-origin PNG QR generated locally, one-hour expiry and agent HTTP instructions. The decision rule is mandatory: use HTTP only if the agent can access files and make HTTP requests; try the one-byte probe with a suggested three-second timeout first. If blocked/unavailable, show the human link/QR in one sentence and wait. Both channels populate one page/session. No image bytes, base64 or remote image URL is accepted by MCP.

- `PUT /api/site-uploads/<sessionId>/probe`: exactly one byte, session bearer.
- `PUT /api/site-uploads/<sessionId>/files/<uploadId>`: raw image bytes; caller UUID is the retry key. Same bytes return the prior asset; different bytes conflict.
- Human mutations require verified Google browser session, owner/enabled site administrator, exact platform Origin and session-bound CSRF. Opening the short URL grants no authority; unauthenticated visitors use Google sign-in and a whitelisted return path.
- Agent bearer grants only probe/upload and is stored only as a hash. Status never reveals it. Expiry/revocation applies to both channels; invalid capability is rejected before large/chunked body buffering. Decoder/body admission is bounded.

Raw JPEG/PNG/static WebP: at most 20 MiB, 40 MP and 12,000 px/side. Dedicated child process fully decodes, rejects animation/spoofed bytes, orients, preserves transparency/aspect ratio, strips metadata and discards originals. It inherits PATH only, uses one decoder, disables Sharp cache, bounds I/O and kills after 10 seconds. Fixed `1.0.0` ladder: edges 2560/2048/1536/1024, quality 80/70/60, first output within 2 MiB, never upscale. Metadata/hash derive from output only. Draft assets: 50 and 25 MiB normalized total.

Sessions: one/draft, three/owner; 100 MiB raw and 100 attempts each. Rolling daily raw limits: 200 MiB/owner, 1 GiB service. Failed decodes consume admission. Drafts: three/owner, 50 service, seven idle days/30 absolute days.

## Preview and browser approval

One globally active worker verifies syntax, Astro build, axe, links and Lighthouse. It must publish screenshots for **every page at 390 and 1280 px**, without client parity inputs. Setup completes before the tool-free `gpt-6-luna` acknowledgement publishes artifacts; errors are redacted and session deletion is reported separately. Failed reports and available screenshots remain viewable; approval is unavailable.

New verifications: five/owner and 25/service per rolling day, including failures. Identical pending or verified content with matching generator/policy/checker provenance within the same owner/test scope reuses artifacts without another provider call or allowance. It never reuses approval. Snapshots bind draft revision, spec/source/output/checker/generator hashes and screenshot/report hashes. At most three retained artifact-bearing snapshots/draft. Unapproved artifacts expire after 24 hours; approved undeployed artifacts after seven days; live artifacts use existing site retention.

`/sites/approve/<specId>` shows page selection, both widths, verification results and embedded exact preview. Preview files live under a signed, snapshot-scoped 15-minute path; relative HTML/CSS/font/image references work unchanged at deployed root. Both iframe and header CSP sandbox omit scripts/same-origin; only that signed prefix loads style/images/fonts. Forms/connections/workers/popups/top navigation are disabled. Preview ignores platform cookies, sets none, and emits no-store/no-referrer/nosniff/noindex even when opened directly.

Approve POST requires verified browser identity, exact Origin, a single-use session/snapshot CSRF token, and current owner or enabled site-administrator membership. Global role alone grants no approval. There is no MCP/bearer approval route. Edits supersede old snapshots; reverting cannot revive an approval. Edit, approval and deploy admission serialize on the site; deployment queued/running/unknown freezes mutation.

## Exact deployment, cleanup and administration

`confirmation` is `DEPLOY_SITE:<siteId>` or `DEPLOY_SITE:<siteId>:<domain>`. Initial CMS password length is 16–128; it is encrypted at rest until sent to the isolated CMS and then removed. Admission and worker recheck approver membership, current revision, approved spec/output hashes, artifact integrity and test classification. The worker deploys the **stored file map**, without generation, normalization or rebuilding. Provider uncertainty remains `unknown`, requiring deliberate reconciliation. No DNS records are changed automatically.

Existing verified-email scoped administrators, owner eligibility, first-client designation, immutable operation/billing history, private costs/reports, tester isolation and reset remain. Tester deployments use disposable Railway projects/generated hosts; custom customer domains are prohibited. CMS catalog/blog/announcement edits remain bounded to configured collections and do not invoke draft change requests. See [tester/admin operations](testers-and-admin.md).

Cleanup tracks bucket prefix write intents before external writes, so rolled-back SQL cannot strand unknown prefixes. The worker removes expired sessions/nonces, expired undeployed snapshots, discarded/expired draft assets and unreferenced prefixes in bounded batches, recording completed deletion for restart safety. Live/unknown deployment artifacts and immutable approval/audit history are protected. Tester reset deletes both `drafts/<UUID>/` and `specs/<UUID>/` prefixes and retains audit/approval history.

## Local checks and the one hosted fixture

Node **22.23.3** is required. Run generator check/build/tests, platform check/build/tests and service check/build/tests; the existing website/infra CI checks also apply. `npm run fixture --prefix packages/generator` creates fictional catalog inputs/source; it supplies no approval. `npm run test:cms --prefix packages/generator` and `test:cms:volume` exercise PocketBase/Caddy locally. Platform tests use unique loopback Postgres schemas; migration inventory must match all seven filenames and hashes and health fails closed on alteration. Migrations 001–006 are unchanged. Production's existing **006 hash mismatch remains an unresolved rollout gate**; never rewrite inventory to bypass it.

The explicitly authorized hosted runner is `node apps/platform/scripts/run-hosted-fixture.mjs`. It reads only the approved credential variable names from production Railway configuration into memory, filters them into the test child environment, overrides fixture flags, creates a disposable local database, and rejects a second attempt through a local marker. Never use production DATABASE_URL. SDK/action retries are disabled; readiness polling is allowed. The flow stops at its first failed stage and performs teardown once. Its private evidence contains only fictional IDs, safe usage/stage/cleanup observations and variable **names**, never values. Fictional verified browser sessions do not establish real Google authentication. No production variables/services/deployments are changed.
