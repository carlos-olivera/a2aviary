# Draft-based live edits — local evidence

Prepared on 2026-10-13 from main `fad932f`. No production configuration, migration,
site, deployment or permission was changed. The original checkout and its
uncommitted verifier change remain untouched. All examples are fictional.

## Verification

The dedicated loopback Postgres suite exercises real migrations, OAuth/MCP,
revision/idempotency locks, browser-only approval and worker transitions with
explicit object-store, verifier and Railway doubles. The lifecycle changes
content, tokens, sections and a new page; checks quick/full preview, exact stored
output, live-pointer timing, starter provenance, retained assets/approval history,
retry accounting, inventory, monthly reports and tester reset (including archived
edit history and historical counts after mutable snapshots are deleted). Concurrency tests
cover two active-edit contenders, queued/running deploy mutation refusal, stale
approval and owner-wide last-slot admission. UTC boundary fixtures include the
instant before the current month, its first instant and the next month.

The opt-in Docker test runs real PocketBase and Caddy with a named persistent
volume. An existing record survives initial deployment, edits with a newly added
collection, unbinding and restoration of earlier stored web bytes. The CMS
container ID and record remain unchanged. Railway project/SSH transport and full
verification are doubles. Restoring stored files through the adapter is **not**
an implemented public rollback workflow.

Reproduce with Node.js 22.23.3, installed workspace dependencies and the dedicated
loopback test database:

```sh
npm run build
npm run check
npm test -w @a2aviary/site-core
npm test -w @a2aviary/generator
npm test -w a2aviary-platform
RUN_LOCAL_FIXTURE_CMS=true node --test apps/platform/test/site-edits-cms.test.mjs
```

Observed locally on Node.js 22.23.3:

- Workspace builds, TypeScript/static checks and generated-contract checks pass.
- Site-core: 51 tests passed. Generator: 87 unit tests passed; the library browser
  matrix passed 148 captures and the presentation matrix passed 168 cases. The
  browser matrices and final unit suite were run as separate gates.
- Platform: 106 tests, 103 passed, zero failures, three opt-in tests skipped.
  The seven dedicated edit tests pass, including returning to earlier content:
  cached artifact hashes are committed in the new snapshot transaction and its
  deployment audit retains the new snapshot ID despite an identical content hash.
- The opt-in real Docker CMS edit lifecycle passed separately. The platform Docker
  image builds; the packaged runtime uses UID 1000 and includes `/usr/bin/ssh`.
- Services: checks/build and 58 tests pass. Infrastructure: build and nine tests
  pass with fictional example configuration. Website checks and build pass.
- Architecture provenance was regenerated with the existing six matching
  finalized drawings/receipts. Integrated HTML, diagrams and their pinned source
  revision are unchanged; source freshness checks remain enabled.
- Relative documentation file targets, whitespace checks and frozen-artifact
  comparisons pass. Migrations 001–009 and policy/contracts 2.2.0 are unchanged.

Platform suites sharing the loopback database must run sequentially because the
production admission advisory locks are database-wide; overlapping independent
suite processes can correctly receive busy responses. The final complete run
used `node --test --test-concurrency=1 apps/platform/test/*.test.mjs`.

At 2026-10-13 21:30:29 UTC, a read-only Operator development-broker preflight
confirmed repository-only installation access, protected main `fad932f`, disabled
auto-merge and all five required checks: `checks`, `a2aviary-policy`,
`platform-image`, `platform`, `generator`. The policy check remains bound to the
Operator App. The short-lived token was revoked after inspection; no credentials
are recorded here. Publication must recheck those settings. No hosted success is
inferred from these fixtures.

## Owner-only hosted verification

1. Review policy 2.3.0 / contract 2.3, additive migration 010 and the
   [decision](../../decisions/016-draft-based-live-edits.md). Keep auto-merge off.
2. Separately authorize backup/restore evidence, migration/rollout and workflow
   activation. Check the complete ten-file migration inventory and frozen 2.2
   artifacts against the reviewed revision.
3. If adding CMS collections, provide an already-authorized Railway SSH identity
   at `SITE_RAILWAY_SSH_IDENTITY_FILE` and trusted host configuration for the
   runtime user. No automatic registration, permission expansion or credential
   setup is performed. Verify the fixed command against the existing private CMS
   service with its owner-approved credential alphabet (bootstrap-generated
   base64url password). Missing or incompatible credentials fail closed.
4. Authorize one isolated tester fixture: real Google upload/approval, create →
   deploy → edit → deploy, existing asset reuse, managed hostname exact bytes,
   collection addition/unbinding and record survival. Inspect stale/unknown
   outcomes without blind retries. No tester custom domains.
5. Verify inventory, monthly usage/reporting and reset/remote cleanup, including
   retained audit/approval history. Public rollback and library field ownership
   remain the explicit follow-ups in decision 016.

Railway transport requirements are based on the
[SSH documentation](https://docs.railway.com/cli/ssh) and pinned CLI 5.63.4 source;
collection creation uses the [PocketBase collection API](https://pocketbase.io/docs/api-collections/).
Local Docker execution does not verify hosted SSH access or public TLS.
