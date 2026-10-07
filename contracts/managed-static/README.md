# Imported static site contract v1

This contract supplements catalog site specifications; it does not change their
schemas or policy. The executable strict request schemas live in
[platform intake](../../apps/platform/src/app.ts) and
[MCP tools](../../apps/platform/src/tools.ts). All routes require the existing
verified-human OAuth bearer/DPoP authentication, exact MCP audience/issuer and
`mcp:tools` scope. Foreign browser origins are refused. No body may declare
verification results, approval claims or provider success.

## Upload

`POST /api/site-releases` accepts exactly one of:

```json
{
  "kind": "import-baseline",
  "files": {
    "index.html": "RmljdGlvbmFsIGhvbWU=",
    "404.html": "RmljdGlvbmFsIG1pc3Npbmc="
  }
}
```

```json
{
  "siteId": "00000000-0000-4000-8000-000000000001",
  "sourceCommit": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "files": {
    "index.html": "RmljdGlvbmFsIGhvbWU=",
    "404.html": "RmljdGlvbmFsIG1pc3Npbmc="
  }
}
```

These fictional shapes illustrate intake, not deployable website fixtures.
Baseline uploads are superadmin-only and return a privately stored, actor-bound
`uploadId`, expiring after 24 hours. Release uploads require current site access;
they return `siteId`, `releaseId`, `artifactSha256` and state. Duplicate site/
commit/digest submissions reuse their release. File-map limits: 1,000 files,
16 MiB per decoded file, 32 MiB total and 48 MiB transport body. Paths must be
relative ASCII segments, without traversal, empty segments, backslashes or
percent encoding. Only static HTML/CSS/JS/MJS/images/WOFF/WOFF2/TXT/XML/JSON extensions
are accepted; `index.html` and `404.html` are required. Source/build scripts,
Dockerfiles, lockfiles, `.git` and `node_modules` cannot enter the bundle.

Every value is canonical base64. The server computes individual SHA-256 hashes
and the artifact digest over UTF-8 `canonicalJson(files)` (sorted keys, unchanged
base64 values, no whitespace). Client hashes cannot authorize deployment.

## Operations

All identifiers are UUIDs unless noted; source commits are 40 lowercase hex
characters. Extra fields are refused. Activation also applies to direct calls.

| Tool | Arguments | Admission and effect |
| --- | --- | --- |
| `site.import` | `uploadId`, `slug`, `expectedOwnerEmail`, optional `ownerEmail`, `firstClientPilot`, `sourceCommit`, `deploymentId`, `target`, `serving`, `confirmation` | Superadmin; compare authenticated identity/configuration; observe exact live target/bytes/configuration before and after capture; record without provider writes |
| `site.admin.assign` | `siteId`, `emails` (1–100) | Superadmin; normalized unique email grants; pending until verified sign-in; no messages |
| `site.admin.remove` | `siteId`, `emails` (1–100) | Superadmin; revoke grants; owner membership is reserved |
| `site.admin.list` | `siteId` | Superadmin; owner and grant status |
| `site.release.verify` | `siteId`, `releaseId` | Current site access; durable fixed-checker job |
| `site.release.deploy` | `siteId`, `releaseId`, `confirmation` | Current site access; valid report, drift check, activation and exact confirmation; first handoff is superadmin-only |
| `site.release.rollback` | `siteId`, `releaseId`, `confirmation` | Current site access; retained verified release, same target, explicit rollback |
| `site.release.reconcile` | `siteId`, `releaseId`, `confirmation` | Superadmin; exact recorded deployment/recovery ID and live byte evidence resolve unknown work |
| `site.costs.refresh` | `siteId`, optional `period` | Current site access; idempotent daily provider snapshot |
| `site.report` | `siteId`, `period` | Current site access; private operations/eligibility/cost report and CSV URL |
| `site.status` | `siteId` | Current site access; kind, CMS mode, releases, jobs, billing and site URL |
| `sites.list` / `site.inspect` | Existing inventory arguments | Existing superadmin restriction; identify imported sites |

`target` contains exact `workspaceId`, `projectId`, `environmentId`, `serviceId`,
`domain` and `previewDomain`. `serving` contains the existing `caddyfile` and a
compatible, digest-pinned `caddy:x.y.z[-alpine]@sha256:…` runtime image. Source
repository/branch, deployment metadata, domain/configuration digests and production
file/header evidence are observed by the server, never accepted as success claims.

Confirmations:

- `IMPORT_SITE:<slug>:<deploymentId>`
- `HANDOFF_SITE:<siteId>:<releaseId>` for the first switch of deployment control
- `DEPLOY_RELEASE:<siteId>:<releaseId>` afterwards
- `ROLLBACK_SITE:<siteId>:<releaseId>`
- `RECONCILE_SITE:<siteId>:<releaseId>`

Release states are `staged`, `verifying`, `verified`, `live`, `failed`, `unknown`.
Jobs are `queued`, `running`, `done`, `failed`, `unknown`. The baseline is retained
as the observed live release; it still needs a passing checker report before
handoff. Reports bind artifact/baseline digests and every required named check.
Predecessor/source/digest/baseline bindings are immutable. A failed parity check,
stale observation, concurrent mutation, artifact tampering or revoked grant
cannot authorize a provider call. Unknown outcomes retain the mutation lock.

## Private downloads and reports

`GET /api/site-reports/<siteId>/<YYYY-MM>.csv` and
`GET /api/site-release-artifacts/<siteId>/<releaseId>/<artifactName>` repeat current
membership checks. Downloads are authenticated and private; a URL is not a public
sharing grant. No signed public URL or outbound report is emitted. CSV cells escape
formula prefixes. Reports use UTC calendar months for operations and eligibility;
Railway accrued usage is explicitly labeled with its actual provider billing-period
boundaries. Infrastructure metrics retain their observed window, separately from
monthly costs. Daily accrued snapshots are replacements, never additive invoices.
Unavailable amounts are null/empty with status/reason; shared overhead is separate.

See [operational guidance](../../docs/managed-static-sites.md) and
[decision 011](../../docs/decisions/011-imported-static-managed-sites.md).
