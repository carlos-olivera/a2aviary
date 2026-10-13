# CI activation and PR #37 verification — 2026-10-12

Owner: Carlos Olivera Terrazas. Repository: `carlos-olivera/a2aviary`.
Prepared branch: `codex/ci-activation`, from main
`27ebab35ddd46c3686e6ec5bd88be323b429790b`. PR #37 was checked at exactly
`d9137392bff7a4b588daa92e3979a7f22fa98fec` in a new clean managed worktree;
its source and remote branch were not changed or pushed.

## Part A: observed production state, read-only

GET `https://platform-production-d84c.up.railway.app/healthz` at
**2026-10-12 21:38:15.357 UTC−04:00 (America/La_Paz)** returned HTTP **200**,
`status: ok`, `mandate: discovery-only`, and exactly migrations 001–007.
All seven names and SHA-256 values match current main. The complete redacted
body is in [production-health.json](production-health.json). Verdict: pass;
Part B was permitted to proceed. No recovery was attempted.

Read-only Railway deployment metadata and the dashboard agree: active deployment
`42b5822b-420b-4465-a477-11ad2e7f0d1c` is **SUCCESS**, created at
2026-10-12 21:01:21.742 UTC−04:00, for main
`27ebab35ddd46c3686e6ec5bd88be323b429790b`. The service is live; the two previous
deployments returned by the bounded history read are removed. This verifies the
serving deployment association, not real Google authentication or site delivery.
The service has its managed Railway domain and no attached custom domain.

The authenticated dashboard was read at **2026-10-12 21:47:08.755 UTC−04:00**:
platform → **Settings → Source → Wait for CI** is **off** (switch value 0).
The label is exact. It says deployments wait for successful GitHub Actions.
No switch was clicked. No Railway variable, service, deployment, database,
setting, DNS or hosted fixture was changed or run.

## Part B: prepared workflow and local verification

The release workflow uses root workspace `npm ci`/`package-lock.json` and builds
site-core before generator/platform consumers. `generator` performs site-core
check (including `site:check`), build/tests, generator static/build/unit checks
and the full library browser gate. Platform tests use Postgres 17.7 on loopback
via `TEST_DATABASE_URL`. Browser setup runs exactly
`npx playwright install --with-deps chromium`. All Node jobs use 22.23.3 and all
Actions remain pinned by full SHA. `platform-image` uses the Dockerfile's pinned
Node 22.23.3 images and builds from root without a registry push.

GitHub job display names are `checks`, `platform`, `generator`, `platform-image`,
`presentation-verify`, `cms (test:cms)`, `cms (test:cms:volume)` and `deploy`.
The other workflow displays `local-integration`. The presentation and CMS jobs
are dispatch-only. Check jobs cancel superseded PR runs individually; main and
manual runs have unique non-cancelling groups. Website deployment keeps its
existing serialized, non-cancelling group, trigger, `needs: checks`, AWS OIDC
permissions, artifact handling and deploy command. Its only changed field is
the requested Node pin. No website delivery/deployment command was run locally.

`actionlint .github/workflows/*.yml` passes using the existing local actionlint
binary. The official architecture integration pipeline reuses the six matching
finalized drawings/receipts. Only the two workflow source fingerprints change
in provenance; the integrated page is byte-identical. Website check/build passes
with the complete patch. Applying workflow files without matching provenance
would fail the repository's existing freshness guard.

Local exact job commands passed: platform **71 passed, two skipped**, site-core
**52 passed**, generator units **79 passed**, services **52 passed**, infrastructure
**nine passed**, library **148 captures**, presentation browser **168 cases**.
The repository-root platform image build passed in **1.267 s** with cached
layers. Dispatch-only local presentation verification passed all three fictional
compositions; real local CMS/Caddy behavior and both volume regressions passed.
The advisory LocalStack job also passed its exact install/up/deploy/test/down
commands: signed intake/result/reply, duplicate/tamper rejection, fake Operator,
scheduled controls, alarms and retention assertions. Its deployment is loopback
emulation using fake credentials; it is not production deployment evidence.
Durations for every command are in [commands.json](commands.json).

This machine runs macOS with Linux containers; Ubuntu-only browser dependency
installation and actual GitHub runner execution remain unobserved. Browser
install commands exited 0 here. Local caches affect the measured times.

Publication is attempted only through the existing a2aviary Operator App after
all checks. No permissions, protection, auto-merge or broker setting is changed.
The publication outcome is reported to the owner and retained in local evidence;
this prepared record does not itself establish GitHub CI activation.

## Part C: PR #37 results

Node **22.23.3**, dedicated ephemeral loopback Postgres 17.7, fresh root workspace
install. Platform: **75 passed, two skipped, zero failed**. Generator units:
**79 passed, zero skipped, zero failed**. Full `library:check` completed **148**
library captures and **168** presentation cases, including clipboard, boundary,
font, no-JS and reduced-motion coverage. Root Docker build passed in **22.613 s**;
no image was pushed. Its image is
`sha256:a44b7815d2a80cd8bcf7e24e316d6423a90085de55accfb811e4728e2636e52a`.

Against a second fresh local database, the built container applied all seven
migrations and returned `/healthz` HTTP **200**, `discovery-only`, and seven
matching names/hashes: [container body](pr37-container-health.json).
The container, both task-created Postgres containers/network, and the
LocalStack environment were removed; the pre-existing local platform database
was untouched. No PR #37 push occurred.

Initial harness failure (not a PR #37 code change): the first migration command
provided only the fictional local database URL and omitted the remaining required
configuration. It failed before migrations with:

```text
Error: Missing PLATFORM_ORIGIN
    at required (file:///app/apps/platform/dist/config.js:5:19)
    at readConfig (file:///app/apps/platform/dist/config.js:8:20)
    at file:///app/apps/platform/dist/migrate.js:59:29
Node.js v22.23.3
```

The corrected migration/start used the complete fictional local configuration
(origin, database, auth/Google placeholders, owner identity, disabled workflow
flags and port). It passed against a new database. No product source was changed
to repair this harness error. Raw local logs remain ignored; no credentials or
private client data are included in this report. Exact Part C commands and
measured wall durations follow; root is the PR #37 worktree. `<fictional
environment>` denotes only local placeholders, not production credentials.

| Command | Directory | Seconds | Exit |
| --- | --- | ---: | ---: |
| `npm ci` | `.` | 6.614 | 0 |
| `npm run build -w @a2aviary/site-core` | `.` | 1.886 | 0 |
| `npm run check:static -w @a2aviary/generator` | `.` | 0.598 | 0 |
| `npm run build -w @a2aviary/generator` | `.` | 2.913 | 0 |
| `npm run check -w a2aviary-platform` | `.` | 0.628 | 0 |
| `npm run build -w a2aviary-platform` | `.` | 0.633 | 0 |
| `npm test -w a2aviary-platform` | `.` | 21.304 | 0 |
| `npx playwright install --with-deps chromium` | `.` | 1.043 | 0 |
| `node --test test/*.test.mjs` | `packages/generator` | 7.785 | 0 |
| `npm run library:check -w @a2aviary/generator` | `.` | 301.707 | 0 |
| `docker build -f apps/platform/Dockerfile .` | `.` | 22.613 | 0 |
| `docker exec a2aviary-pr37-verification-db createdb -U platform a2aviary_platform_container_pr37_v2` | `.` | 0.132 | 0 |
| `docker run --rm --network a2aviary-ci-activation-local <fictional environment> sha256:a44b7815d2a80cd8bcf7e24e316d6423a90085de55accfb811e4728e2636e52a node dist/migrate.js` | `.` | 0.453 | 0 |
| `docker run -d --name a2aviary-pr37-verification-platform --network a2aviary-ci-activation-local -p 127.0.0.1:55442:3000 <fictional environment> sha256:a44b7815d2a80cd8bcf7e24e316d6423a90085de55accfb811e4728e2636e52a` | `.` | 0.162 | 0 |
| `GET http://127.0.0.1:55442/healthz` | `.` | 1.070 | 0 |
| `docker rm -f a2aviary-pr37-verification-platform` | `.` | 0.229 | 0 |

## Owner actions, in order

1. If publication is refused, either grant the Operator App repository permission
   **Workflows: read and write**, accept it on the installation, and request a
   re-run of Part B; or apply the refreshed `.local/ci-workflow.patch` yourself
   on a feature branch. A PR pushed from your account needs approval from
   someone other than its last pusher under current branch protection.
2. After the CI PR merges and these jobs have run once on main, add **platform**,
   **generator** and **platform-image** as required checks, retaining existing
   checks/current-head policy review and disabled auto-merge. GitHub lists
   checks that ran recently.
3. Enable **Wait for CI** in platform **Settings → Source** and verify the gate.
4. Then update PR #37 onto the new main through the Operator App so its required
   checks run before any owner-authorized merge.

No merge, production rollout, permission change or required-check mutation is
part of this delivery. Health/deployment and local checks are observed; new CI
execution, required checks and deployment gating are not yet observed.
