# Testers and chat-only superadmin

Phase 4 adds a free tester path and superadmin tools to the existing authenticated
MCP connector. Source/local evidence is distinct from deployment; see
[release verification](release-verification.md). The platform still has only
login and consent pages. No payments, policy mutation, OAuth trust changes,
production DNS changes or external site work are included.

## Enrollment and identity

Privately retain the owner-approved `PLATFORM_SUPERADMIN_EMAIL`. Only that
verified human resolves to superadmin; OAuth role/email claims cannot promote a
caller. Invited admins have their own site/key tools, but **only superadmin**
can administer testers, other administrators, site inventory or audit logs.
The legacy `admin.audit.list` is now superadmin-only and uses the same redaction
as `logs.query`. Role changes are checked on every call, including existing tokens.

`PLATFORM_TESTER_EMAILS` now seeds the Postgres allowlist at startup. It inserts
only previously unseen emails; removing an entry via chat leaves a disabled
record, so an environment seed cannot silently re-enable it on restart. Use
`testers.add` to re-enable it. Clearing the environment variable does not remove
existing DB enrollments. Tester emails cannot be the configured owner, an active
invited admin or a pending valid admin invitation. Remove/revoke the previous
role explicitly before enrolling another role. No invitation emails are sent.

In Claude/ChatGPT, use the existing [OAuth connector](platform.md#connect-from-chatgpt-and-claude-after-authorized-deployment),
sign in as the configured owner, then refresh the connector's cached tool list.
For example, ask it to call:

```json
{"name":"testers.add","arguments":{"email":"tester@example.invalid"}}
```

This is fictional; supply the actual email privately through your connector.
The tester signs in with that verified identity, calls `capabilities.get`, and
receives `test:true`, a free pinned `web-simple` plan and `paymentBypass:true`.
Site validation, approval/preview hashes, image-byte checks and the component
catalog remain unchanged. A tester cannot submit a different plan or relax limits.
There is no billing integration; future billing must preserve the immutable
site classification and exclude test sites from charges.

## Test site lifecycle

Upload an approved fixture through `POST /api/site-specs`, then use `site.build`,
`site.status`, `site.deploy` and `change.request` as in [site operations](sites.md).
No caller-supplied `test` switch exists: the server records it at site creation,
inherits it on specs/builds/changes/jobs and prevents later reclassification.
Application activity logs, verification-call logs and audit rows carry the test
flag, including superadmin inspection/reset of test sites and worker recovery.
Postgres retains the existing `test_mode` column name; tool responses/logs use
`test:true` (with the earlier `testMode` alias where already present).

Tester deployment always selects a **dedicated private Railway project with one
`fixture` environment**, even when the normal client deployment default is
`production`. Only its `web` and `cms` services are accepted by the test-resource
guard. The web service uses its managed `*.up.railway.app` staging hostname.
This is the approved staging-host alternative to `<slug>.test.a2aviary.io`;
this implementation creates no wildcard DNS or test-domain bindings. It never
uses the platform staging project as a fixture target. Test deploys reject every
custom domain, including a domain already recorded in resources. Retain
`SITE_PROTECTED_PROJECT_IDS` and the platform project/domain protections.

Successful applied changes use the policy's **four requests per UTC calendar
month**, without rollover: at most two distinct pages, ten blocks and one
separate shared-configuration operation per request. Pending/unknown changes
hold a reservation; definitive failures release it. CMS content edits bypass
site-change accounting. Usage is owner-wide across sites, not an allowance per
site. Removing tester eligibility blocks further access to their existing test
sites; it cannot turn those sites into customer sites. Re-enrollment restores
access. Existing non-test sites similarly cannot be operated as tester sites.

## Reset a tester site

As superadmin, inspect the selected site and wait for queued/running jobs to
finish. `tester.reset` refuses those jobs and every non-test site. It takes the
exact confirmation:

```json
{
  "name":"tester.reset",
  "arguments":{
    "siteId":"00000000-0000-0000-0000-000000000001",
    "confirmation":"RESET 00000000-0000-0000-0000-000000000001"
  }
}
```

The ID is fictional. Confirm the real ID deliberately. Reset records actor,
site ID, exact accepted confirmation and result before provider cleanup. It
checks project name/workspace, the single fixture environment, service IDs and
protected projects before [deleting the Railway project](https://docs.railway.com/integrations/api/manage-projects).
That removes its services/deployments and PocketBase volume/data. It deletes
all accepted spec asset/preview/build/report objects, jobs and change history
for that site, then archives its site record. The tester account, allowlist,
other sites and immutable audit history remain. The site's usage is cleared;
other sites' successful changes still count. Start a new site with a new slug.
An archived slug stays reserved for traceability.

Partial cleanup leaves `lifecycle:resetting`, which blocks builds/deploys. Retry
with the same confirmation. Project deletion is saved before bucket cleanup;
cleanup is idempotent for already removed objects/projects. Provider access
errors are never interpreted as proof that a project is absent. Unknown outcomes
may require owner reconciliation if the provider cannot explicitly confirm
absence. Concurrent resets return `reset_busy`; an already archived site returns
success without replaying provider deletion. A failed start-audit write prevents
cleanup. A failed final audit keeps history for a safe explicit retry.

Off-volume PocketBase backups are **archived**, not erased by reset. They remain
private in the configured backup bucket under its owner-controlled retention;
reset never deletes a shared backup bucket. Configure an explicit lifecycle for
backup archives, unreferenced uploads and any bucket object versions. Use an
unversioned site-artifact bucket for physical object deletion; versioned buckets
retain older versions until their configured expiry. Reset responses do not
claim erasure of archived backups or expired object versions. `logs.query`
reads platform audit events, not raw Railway/PocketBase logs or backup contents.

## Tool list

All tools below require superadmin. Calls, rejected confirmations and reads are
audited; responses omit passwords, tokens, provider credentials and client copy.
Invalid argument schemas are audited as attempted calls without saving arguments.

| Tool | Arguments and behavior |
| --- | --- |
| `admin.invite` | `email`, `confirmation:INVITE_ADMIN:<lowercase-email>`; seven-day invitation, no message |
| `admin.revoke` | `email`, `confirmation:REVOKE_ADMIN:<lowercase-email>`; clears active role/pending invitation, repeatable; legacy `userId` confirmation remains supported |
| `testers.add` / `testers.remove` | `email`; idempotent enrollment/disable; cannot replace owner/admin identities |
| `testers.list` | Optional `after` email and `limit` (1–100, default 25); returns enabled/disabled entries and `nextAfter` |
| `sites.list` | Optional `test` boolean (false means non-test), `owner` user ID, `status`, `after` site ID and `limit` (1–100, default 25) |
| `site.inspect` | `siteId`; lifecycle/current status, last deployment, spec/source/output hashes, change accounting and owner-wide monthly usage |
| `logs.query` | Optional ISO UTC `from`/`to` (default previous 24 hours, maximum 31 days), `actor` user ID, `tool`, `test`, `before` audit ID and `limit` (1–100, default 25) |
| `tester.reset` | `siteId`, exact `confirmation:RESET <siteId>`; test-only cleanup/archive |
| `admin.audit.list` | Legacy bounded audit pagination with `READ_PRIVATE_AUDIT_LOG`; now superadmin-only |

Use `testers.list`, `sites.list` and `site.inspect` before selecting a reset.
For logs, ask for a short time range plus `test:true` and a specific actor/tool.
`sites.list.status` uses the deployed current spec when one exists; a newly
uploaded candidate does not make a live site appear staged. Resetting/archived
sites have those lifecycle statuses. `monthlyRequestsUsed` includes current-month successful requests and retained reservations across the owner’s sites. Use returned cursors with unchanged filters.
MCP tools are hidden from other roles, and a direct attempt to call a known
restricted tool returns `forbidden` without site/user data.

## Activation and verification

No additional required environment variables are introduced. Migration
`005-testers-admin.sql` is required by health readiness and the normal Railway
pre-deploy migrator. The site-artifact bucket credential now needs prefix list
and object delete permissions in addition to read/write. The private Railway
credential needs deletion rights in the intended fixture workspace. Do not
expand either credential to production resources. `SITE_WORKFLOW_ENABLED`
retains its off-by-default behavior; discovery/tester administration can work
while build/deploy/reset tools remain unavailable.

Run Node.js 22 generator check/build/tests, then platform check/build/tests with
the dedicated loopback Postgres database. The Phase 4 integration suite exercises
real SQL/OAuth/MCP transport with explicit verifier/Railway/bucket doubles; it is
not live provider evidence. `RUN_TESTER_CLOUD_E2E=true`, together with
`RUN_SITE_CLOUD_E2E=true` and `SITE_DEPLOY_ENVIRONMENT=fixture`, enables the real
staging tester lifecycle, CMS edit and reset smoke test. Supply credentials
privately; evidence remains in excluded `.local/`. Review/merge, staging rollout,
real Claude/ChatGPT use and live provider cleanup remain separate owner gates.
