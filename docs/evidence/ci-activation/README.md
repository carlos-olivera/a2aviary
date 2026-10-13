# CI activation and PR #37 verification — 2026-10-12

Owner: Carlos Olivera Terrazas. Repository: `carlos-olivera/a2aviary`.
Prepared branch: `codex/ci-activation`, from main
`27ebab35ddd46c3686e6ec5bd88be323b429790b`. PR #37 was checked at exactly
`d9137392bff7a4b588daa92e3979a7f22fa98fec` in a new clean managed worktree;
its source and remote branch were not changed or pushed.

## Part B retry — 2026-10-13

At **2026-10-13 06:43:35 UTC−04:00 (America/La_Paz)**, live GitHub metadata
confirms the App registration includes `workflows: write`, but installation
167790436 still omits it. The installation remains selected-repository-only.
The owner must accept the permission update for that installation.

Fetched `origin/main` remains `27ebab35ddd46c3686e6ec5bd88be323b429790b`;
`git rebase origin/main` reports the branch is up to date. Application and
workflow bytes are unchanged from the completed local verification below.
`actionlint .github/workflows/*.yml` and `git diff --check` pass again.
The existing Operator development broker issued the publication token; GitHub
again refused the complete branch push for missing `workflows` permission.
No remote CI branch or PR was created. The token was revoked, auto-merge remains
disabled, and main remains protected with App-bound `checks` and `a2aviary-policy`.

There is a second prerequisite: `services/src/operator.ts` explicitly requests
only `contents: write`, `pull_requests: write` and `actions: read` for development
tokens. Accepting the installation update alone does not add workflows to that
profile. Updating/deploying the broker requires separate owner authorization;
this retry neither modifies it nor mints a broader token outside the broker.
No permission/protection workaround or production change was performed.

The refreshed complete patch remains in ignored `.local/ci-workflow.patch`,
with a copy in the original checkout. PR #37 was not inspected, changed,
rebased, tested or pushed during this retry. Its results below are prior dated
evidence. New CI runner execution and Railway gating remain unobserved.

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

The complete branch publication was attempted through the existing
repository-only a2aviary Operator App after all checks, at 2026-10-12
22:00:42 UTC−04:00. GitHub refused the push:

```text
refusing to allow a GitHub App to create or update workflow `.github/workflows/local-integration.yml` without `workflows` permission
```

No CI branch or partial PR was published. The existing installation grant has
checks/contents/pull_requests write and actions/metadata read, with no workflows
permission. Main remains protected with App-bound `checks` and
`a2aviary-policy`, auto-merge disabled and the existing development broker
enabled. Detailed branch-protection inspection returns HTTP 403 under that
unchanged grant; no permission, protection or broker setting was altered.
The publication token was revoked. The complete refreshed patch (workflows,
matching provenance and this evidence) is saved in ignored
`.local/ci-workflow.patch`, including a copy in the original repository's
`.local/` directory. No documentation-only fallback PR is opened. The patch
applies cleanly to main `27ebab35`; recheck against any later main before owner
publication.

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

1. Accept **Workflows: read and write** on the App installation (the registration
   already includes it), then separately authorize the broker development-token
   profile update/deployment before another Part B retry. Alternatively, apply
   the refreshed `.local/ci-workflow.patch` yourself on a feature branch. A PR
   pushed from your account needs approval from someone other than its last
   pusher under current branch protection.
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
