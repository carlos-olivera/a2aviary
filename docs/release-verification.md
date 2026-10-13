# Release verification and status

Configured, deployed, verified and blocked are distinct states. Owner reports
and local fixtures do not establish production behavior. Dated evidence is
preserved in [October history](history/release-verification-2026-10.md); its
relative references are frozen to the original source revision, with no evidence
paragraph or table rewritten.

## Current status

| Area | Observed status | Evidence |
| --- | --- | --- |
| AWS landing | Existing S3/CloudFront delivery; unchanged by this cleanup | [Published delivery](history/release-verification-2026-10.md#published-delivery) |
| AWS signed-email foundation | Legacy, maintenance only; deployed brief discovery has dated evidence | [Foundation baseline](history/release-verification-2026-10.md#observed-gates--2026-10-04-foundation-baseline) |
| Platform after PR #38 (historical baseline) | Railway deployment `16873491-2b1b-41e8-a270-ffe5a8c00f30` successful at main `27f642a`; public `/healthz` HTTP 200, discovery-only, seven migration names/hashes matching source, observed 2026-10-13 | [Cleanup preflight](evidence/runtime-cleanup/README.md) |
| Platform after PR #39 | Main `cf3f987` CI green; Railway deployment `62290ff5-1a48-43fd-b999-e29b27ab2fe5` SUCCESS; health HTTP 200, seven matching migrations, discovery-only at 15:28:38 UTC on 2026-10-13 | [Starter publication preflight](evidence/starters/README.md#observed-checks-and-publication-preflight) |
| Website starters | Prepared source and locally verified experimental profile starter; migration 008 and rollout await owner review/merge | [Local evidence](evidence/starters/README.md) |
| Historical policy usage | Authorized read-only SQL: no non-current-policy drafts, no 2.0/2.1 verified/approved/deploying/live snapshots, no non-archived sites outside 2.2.0 | [Inventory boundaries](evidence/runtime-cleanup/README.md#production-precondition) |
| CI protection | Operator read at 09:00 UTC−04:00 confirms all five required checks: `checks`, App-bound `a2aviary-policy`, `platform`, `generator`, `platform-image`. Railway Wait for CI enabled | [Read-only settings](evidence/runtime-cleanup/README.md#production-precondition) |
| Runtime cleanup | PR #39 merged; successful rollout observed as recorded above | [Verification](evidence/runtime-cleanup/README.md) |
| Catalog website workflow | Remains discovery-only in production; hosted full workflow and real Google upload/approval authentication unverified | [Historical hosted attempt](history/release-verification-2026-10.md#server-drafts-and-previews--2026-10-08-local-implementation-hosted-fixture-failed) |
| Restore and costs | Production Postgres restore, remote PocketBase restore and per-site cost scope remain open | [Runbook](runbooks.md#railway-platform) |
| Commerce | Nothing is for sale; no live checkout or active Paddle merchant of record | [Plans](plans.md) |

## Open gates before the first client site

1. Keep the five required checks and Railway Wait for CI enabled; verify them
   during owner review. Both settings were observed without changing them.
2. Keep workflow activation separately authorized; healthy discovery readiness
   does not establish hosted site delivery. Confirm `SITE_DEPLOY_ENVIRONMENT=production`
   before any non-test site is created.
3. Record production Postgres backup/restore proof before further schema changes.
4. Resolve artifact-prefix listing/deletion permissions and leftover fixture
   prefixes; rerun the hosted fixture under separate authorization.
5. Verify both workflow flags and real Google sign-in on upload/approval pages,
   then run the [tester production procedure](sites.md#production-test-procedure).
6. Execute one remote PocketBase backup/restore and decide token scope for costs.
7. Earlier foundation gates remain: real owner alert, `Project` cost tag,
   current-head owner approval and reconciliation of four held reservations.

The owner may tag pre-cleanup commit
`27f642acf462bb34afc7428cc5ca04852f205f96`. No tag, merge or deployment is performed
by this delivery; historical production counts are a point-in-time observation.
