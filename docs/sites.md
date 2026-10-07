# Catalog site generation and hosting

Phase 3 adds source for deterministic Astro generation, sandbox verification,
owned MCP jobs, PocketBase and Railway client-site provisioning. Production is
disabled unless `SITE_WORKFLOW_ENABLED=true`. Local tests and cloud verification
are distinct; consult [release verification](release-verification.md). This
delivery does not activate AWS policy enforcement, change DNS, deploy the
platform, implement payments, or start the Teco pilot. Phase 4 adds the separate [tester and superadmin path](testers-and-admin.md).

## Contract and intake

The client agent prepares copy/images and an HTML preview using the fixed
[web-simple catalog](plans.md). It obtains human approval before uploading.
`POST /api/site-specs` accepts an OAuth bearer/DPoP token for the platform MCP
resource and scope `mcp:tools`. The request is a strict JSON object:

```json
{
  "slug": "fictional-guide",
  "spec": {"...": "complete site-spec v1, including approval and preview"},
  "assets": {"prepared-image-id": "canonical base64 of the supplied image"},
  "preview": {"files": {"index.html": "canonical base64 of approved HTML"}}
}
```

This abbreviated shape is explanatory, not a valid fixture. Generate the
complete fictional seven-page submission with `npm run fixture --prefix
packages/generator`. For an existing site, supply `siteId` instead of `slug`.
All declared assets must be supplied; no URLs, credentials, backend endpoints,
free-text interpretations, extra fields, or server-side fetching are accepted.
The response contains `siteId` and `specId`. Duplicate owned slug/spec digests
return the existing record. Abandoned upload objects can remain after a failed
transaction; configure bucket lifecycle retention for unreferenced objects.

The policy bounds each spec to 256 KiB JSON and assets to 25 MiB total. The
authenticated intake transport has a separate 48 MiB body ceiling for base64
and an 8 MiB approved-preview artifact ceiling; other platform requests retain
their 512 KiB ceiling. Preview files use relative safe paths, with one
`index.html` per authored route and prepared CSS/fonts. Scripts cannot run in
the preview browser. Prepared images can use `/assets/<SHA-256>.<extension>`
without duplication in the preview bundle; their byte hashes are already bound
by the approved spec. External browser requests are blocked.

The preview digest is SHA-256 of the UTF-8 `canonicalJson({files})` document:
sorted object keys, unchanged base64 values, preserved array order, no extra
whitespace. The spec digest remains the Phase 1 serialization excluding only
top-level `approval`. Set the preview digest first, then the approval spec
digest. Authentication binds the submission owner; the approval declaration is
an assertion of human approval, not a new human-signature protocol.

## Tools and jobs

| Tool | Arguments | Effect |
| --- | --- | --- |
| `site.build` | `specId` | Queue a catalog build and sandbox verification |
| `site.status` | `siteId` | Owned states, hashes, reports, CMS login and Railway DNS/certificate status |
| `site.deploy` | `siteId`, `specId`, `cmsPassword`, `confirmation`, optional initial `domain` | Queue deployment of verified bytes only |
| `change.request` | `siteId`, `specId`, `spec` (change-request v1), `confirmation` | Validate the structured diff and reserve its allowance |

These tools are visible to client/admin/superadmin/tester when enabled. Tester sites remain immutable test-only staging deployments. Ownership
applies to all roles; administrators cannot access another human's site through
these tools. Testers remain discovery-only in Phase 3. Policies cannot be
modified by a tool. OAuth consent describes the enabled mandate; a connector's
OAuth grant does not approve a spec or deployment.

Deployment requires `DEPLOY_SITE:<siteId>`; an initial custom domain requires
`DEPLOY_SITE:<siteId>:<domain>`. Changes require `APPLY_CHANGE:<siteId>`.
`cmsPassword` is the client's initial CMS password (16–128 characters), encrypted
with a separate AES-256-GCM key until it is delivered to Railway variables, then
cleared from Postgres. Superadmin credentials are generated only for provisioning
and remain in CMS Railway variables. No credentials enter the sandbox, source
bundle, object bucket, audit record, or console logs.

Each job records actor/tool/spec digest/result. Postgres persists jobs and
resource IDs. A single advisory-locked worker executes provider actions, with
atomic owner-scoped admission/accounting. Queue and applied-state writes share
their audit transaction. Interrupted builds fail and may be explicitly retried.
Interrupted/uncertain deployments become `unknown`; the worker never blindly
replays them. The owner must reconcile provider deployments and Postgres state
in a maintenance transaction, recording an audit result and either successful
application or a confirmed failure. No destructive reconciliation tool is added.

Four successful applied changes per UTC calendar month apply across an owner's
web-simple sites; no rollover. Reservations prevent concurrent overuse and
remain held for an unknown deployment. A confirmed build/deploy failure releases
the reservation. The first deployment does not consume a change. Per request,
the Phase 1 validator counts at most two distinct pages, ten modified blocks,
one separate shared configuration operation, and twenty operations. Newly added
page blocks count in full. A full-spec upload cannot bypass the diff/accounting
gate. CMS record edits use PocketBase directly and never enter this counter.

## Verification and determinism

Generator v1 covers all twelve catalog components, the `standard` variant,
structured rich text, escaped copy/links, semantic colors, approved fonts and
fixed tokens. Inter and EB Garamond are pinned and served locally with notices.
There are no approved AI gaps in this catalog: `SITE_AI_GAPS_ENABLED` must remain
false, and an attempted enable fails closed. New gaps require a reviewed
implementation and explicit logging/lint/build gates; this delivery has no
model-generated CSS path. The verification Agents API call is separately logged.

The source hash binds generator version, policy SHA-256, every generated text
file, original prepared asset bytes and bundled fonts. The output hash binds the
sorted relative-path-to-base64 map of built files. No build timestamp is inserted.
Actual raster format, full decode, static-image restrictions, dimensions, bytes
and SHA-256 are checked before generation and original bytes are checked after
the build. No image transformation or OCR occurs.

OpenAI Agents API `gpt-6-luna` uses a hosted sandbox with no credentials, vaults,
MCP tools, research tools or subagents. Pinned public dependencies are installed
under an explicit network allowlist. A fixed setup script runs Astro build,
JavaScript syntax checks, WCAG A/AA axe checks, internal link/asset/anchor checks, Lighthouse accessibility
(minimum 0.90), and screenshots at 390/1280 px. Preview scripts are blocked and
browser requests stay on local verification origins. Pixel comparison requires
matching dimensions and at most 0.1% changed pixels at pixelmatch threshold 0.1.
Dynamic CMS sections are verified in their specified empty state.

The model has no tools and cannot amend checker artifacts. The controller
requires all named checks, matching spec/source hashes, complete authored routes,
unchanged prepared images and a matching output hash. A model's text response
cannot authorize deployment. Reports and screenshots stay in separate private bucket objects (64 MiB per artifact, 128 MiB per verification download);
failed checker reports remain available for correction, and owned OAuth downloads use `GET /api/site-artifacts/<specId>/<artifactName>`.

## Railway and CMS

Provisioning creates an isolated private `cli-NNN-slug` project in the configured
workspace. Fixture mode creates its `fixture` environment; production mode
creates `production`. Existing platform/Teco projects must appear in the
protected-project list and are never deployment targets. Both client services
have one replica, a 1 vCPU/0.5 GB cap and three restart retries, in Railway
configuration and API settings. The CMS volume is mounted at `/pb/pb_data`; the server binds `[::]:8090` for Railway private-network IPv6 access.
Prepared source assets and verified artifacts live in the bucket; the Caddy
image contains verified static copies on ephemeral image storage, with no asset
volume. Credentials never enter the Caddy service.

PocketBase 0.40.4 archives are SHA-256 pinned for Linux amd64/arm64. Migrations
create only catalog/blog/announcements collections actually bound to blocks.
Client-created accounts are disabled; an editor can manage those content records.
Anonymous reads expose only published records. Text fields retain policy bounds.
Later site revisions add idempotent migration files without deleting CMS data.
Daily 03:00 UTC backups retain seven snapshots in the separately configured
S3/R2 backup bucket. Settings are encrypted with a stable Railway-only key;
rate limiting is enabled. A configured backup schedule is not proof of a
successful remote backup/restore.

The client logs in at `<siteUrl>/api/cms/editor.html`, using their verified
platform email and the initial password they supplied. The editor calls
PocketBase directly through Caddy; no site rebuild is needed. The CMS service
has no public domain, and Caddy does not expose the PocketBase admin dashboard,
superuser APIs or settings APIs. Only the fixed editor and bound collection
routes are proxied.

Optional custom domains attach only to the new client's web service. Existing
domain changes are unsupported in v1. `a2aviary.io`, its subdomains and configured
protected domains are rejected. `site.status` returns Railway's required/current
DNS records, ownership token and certificate status. The client/owner creates
the CNAME (or apex ALIAS/ANAME/flattening) and verification TXT records at their
DNS provider, then polls status until Railway confirms DNS and certificate
issuance. Do not substitute an A record or claim SSL verification from a queued
deployment. This service never edits DNS or AWS.

## Configuration and local checks

Keep all values in private environment files or Railway variables; never paste
secret values into a chat or PR. Existing [platform variables](platform.md)
remain required.

| Variable | Purpose |
| --- | --- |
| `SITE_WORKFLOW_ENABLED` | Default false; explicit activation of site tools/worker |
| `SITE_AI_GAPS_ENABLED` | Must remain false for catalog v1 |
| `SITE_CREDENTIAL_KEY` | Independent random 32-byte lowercase hex encryption key; retain during pending jobs |
| `OPENAI_API_KEY` | Controller-only development/project key for Agents verification |
| `RAILWAY_API_TOKEN` | Controller-only workspace API token; no personal GitHub credentials |
| `SITE_RAILWAY_WORKSPACE_ID` | Explicit workspace for new projects |
| `SITE_DEPLOY_ENVIRONMENT` | Required `fixture` or `production`; no default production target |
| `SITE_PROTECTED_PROJECT_IDS` | Required comma-separated platform/other protected project IDs; platform `RAILWAY_PROJECT_ID` is added automatically |
| `SITE_PROTECTED_DOMAINS` | Additional comma-separated existing/private client domains; platform origin hostname is added automatically |
| `SITE_BUCKET_ENDPOINT`, `SITE_BUCKET_NAME`, `SITE_BUCKET_REGION` | HTTPS S3/R2-compatible source/artifact bucket |
| `SITE_BUCKET_ACCESS_KEY_ID`, `SITE_BUCKET_SECRET_ACCESS_KEY` | Least-privilege bucket credentials, controller only |
| `SITE_BUCKET_FORCE_PATH_STYLE` | Defaults true; set false for virtual-host addressing |
| `PB_BACKUP_ENDPOINT`, `PB_BACKUP_BUCKET`, `PB_BACKUP_REGION` | HTTPS S3/R2 backup destination, separate from site artifacts |
| `PB_BACKUP_ACCESS_KEY_ID`, `PB_BACKUP_SECRET_ACCESS_KEY` | Backup-only credentials copied privately to the site's CMS variables |
| `PB_BACKUP_FORCE_PATH_STYLE` | Defaults true |

Per-CMS generated variables are `PB_ADMIN_EMAIL`, `PB_ADMIN_PASSWORD`,
`PB_CLIENT_EMAIL`, `PB_CLIENT_PASSWORD`, `PB_ENCRYPTION_KEY`, `GOMEMLIMIT`,
`PORT`, and the backup variables. Preserve the encryption key on every revision.
The web service receives only `PORT` and the private `CMS_UPSTREAM`.

```sh
npm ci --prefix packages/generator
npm run check --prefix packages/generator
npm run build --prefix packages/generator
npm run test --prefix packages/generator
npm ci --prefix apps/platform
docker compose -p a2aviary-platform-phase3 -f apps/platform/compose.yaml up -d --wait
npm run check --prefix apps/platform
npm run build --prefix apps/platform
npm run test --prefix apps/platform
npm run fixture --prefix packages/generator
cd work/phase3-fixture
npm ci --ignore-scripts
npx --no-install playwright install chromium
node verify.mjs
```

Run `node packages/generator/scripts/test-cms.mjs` from the repository root for
the isolated Docker CMS integration check. It removes only its own test
container/volume. Deployment readiness follows the exact upload deployment ID, never an earlier successful release, then requires valid HTTPS and byte-matching home-page content on the managed Railway domain. Client DNS/certificate readiness is reported separately. The first-party Railway Rust CLI is version/checksum pinned;
its license is retained, and the npm wrapper with its vulnerable archive
dependency is not used. Generator/platform builds preserve dependency notices.

For the opt-in cloud end-to-end test, configure development credentials and
`SITE_DEPLOY_ENVIRONMENT=fixture`, then run the live fixture test documented in
[the generator package](../packages/generator/README.md). The test must fail if
verification or deployment fails; a mocked-provider test is not cloud evidence.
Review actual created resource IDs privately before cleaning up the fixture.
Production activation, remote backup/restore proof, client domain DNS, owner PR
review and expanded trusted-policy activation remain separate owner actions.

Imported private static sites use the separate [managed-static workflow](managed-static-sites.md), without catalog conversion or CMS resources. Catalog submissions and changes retain their contracts.
