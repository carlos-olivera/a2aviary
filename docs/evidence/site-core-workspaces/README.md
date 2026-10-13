# Site-core workspace verification — 2026-10-12

Local implementation and verification against main
`1a09f565a2c6b81b2c0334daf46a1965349fa1f8`, using Node.js **22.23.3**.
No production configuration, migration, policy, package bytes, generator version,
site-provider operation or deployment changed. Owner PR review is still required.

## Ownership and dependency choices

The root npm workspace covers `packages/*` and `apps/platform`. Site-core owns
site domain code, generated catalog metadata, contract authoring and exported
fictional fixtures. Generator owns presentation compilation/rendering and the
existing provider adapters. Platform retains all existing workflow behavior.
The root lockfile replaces generator/platform lockfiles; internal versions are
pinned to `0.1.0`, using workspace links instead of a `file:` dependency.

Services, infra and website remain standalone. This avoids hoisting their separate
AWS, CDK and Vite graphs into the platform installation. In particular, website
pins Vite 8.3.2 while generator resolves 8.3.3. The workspace reuses the existing
locked generator/platform graph, retaining older QR-code CLI dependencies below
`qrcode` and P-limit 2 below `p-locate`. The combined lock validates with `npm ci`,
`npm ls --all` and an offline package-lock-only install. Pruning is verified in
the actual Linux container, not inferred from the unpruned development tree.

[Dependency comparison](dependency-versions.json) reports every direct dependency
and **zero resolved-version differences** across 756 generator and 157 platform
dependency edges, including optional/peer edges that existed in the old graphs.
Standalone retained dependency versions are unchanged. Services' unused Acorn
8.19.0 and Sharp 0.35.5 dependencies (and Sharp-only transitive/native entries)
are removed; generator retains Acorn and site-core/generator retain Sharp at those
same pinned versions. New site-core dependencies
AJV 8.20.0, Sharp 0.35.5, TypeScript 7.0.2 and Node types 22.19.15 reuse the same
existing pinned versions. No dependency was upgraded.

ADR 014's reviewed data/runtime boundary is preserved. ADR 015 exists on main but
still labels itself proposed; this change preserves its four-axis direction
without introducing starters, category behavior or policy separation. That status
label is not changed here. Architecture source links/ranges and fingerprints are regenerated for this
refactor, including `packages/site-core/`, root manifests/lockfile and the parity
runner. The six drawings retain their topology and geometry.

## Behavioral proof

- `npm run site:check` passes. All `contracts/site/` and `plans/` bytes match the
  baseline; policy SHA-256 is
  `3109987ff953fd0205e6e7665b16a583f55c2a75666e2ab84e82683381cccc30`.
- [Fixture hashes](generator-hashes.json) were captured **before** the move and
  compare exactly after it: spec digest, source digest, every source file/binary
  byte, and every actual Astro-built output byte. Includes catalog, boxed policy
  2.1 and all three presentation compositions. `npm run test:parity` rebuilds all
  five and asserts those golden hashes, plus every existing `boxed-2.1.json` file digest.
  `GENERATOR_VERSION` remains `2.3.0`.
- Both generated library data files and registry match baseline bytes. Compiler
  stale-artifact rejection tests pass; neither checking command regenerates data.
- Full `library:check` passes: 148 library captures and 168 presentation cases,
  including native clipboard, boundary/font/no-JS paths and reduced motion.
- Site-core's 52 relocated contract tests, generator's 79 tests and services'
  remaining 52 tests pass. The Operator approval boundary test remains in services.
- Platform baseline and candidate each pass **71 tests**, with **two explicit
  opt-in/credential-dependent skips**. Existing assertions are unchanged except
  import paths. One new test captured and compares complete MCP `tools/list`
  results for client/tester/admin/superadmin in both discovery and site modes:
  [snapshot](../../../apps/platform/test/fixtures/tools-list.json),
  [test](../../../apps/platform/test/tools-list-snapshot.test.mjs).
- `docker build -f apps/platform/Dockerfile .` succeeds from repository root.
  After `npm prune --omit=dev`, the container starts as UID/GID **1000**, Node
  **22.23.3**, against a newly created disposable loopback Postgres 17.7 database.
  `node dist/migrate.js` applies all seven unchanged migrations. `/healthz` returns
  HTTP **200**, `status: ok`, `mandate: discovery-only` and all seven original SQL
  hashes: [response](container-health.json). The smoke resources are removed.
  Railway's root Dockerfile selection, working directory, pre-deploy migration
  and start commands remain unchanged in meaning; `railway.json` is byte-identical.

## CI and review boundary

Prompt 1's earlier workflow patch was still unapplied on main. Its jobs are updated
for the root lockfile, site-core build/check/tests, generator/platform dependency
order, fixture parity and repository-root image build. Existing website deployment
remains main-only; no production platform deployment or permission expansion is
added. The patch includes matching generated architecture provenance and passes
`git apply --check` and website check/build with all three patch files applied.

Live Operator preflight confirms App 5185075 (`a2aviary-operator`), installation
167790436 scoped only to this repository, enabled development broker, protected
main and **auto-merge disabled**. Its current grant lacks workflow-write permission.
Accordingly `.local/ci-workflow.patch` is prepared in the excluded worktree for the
owner to apply through an authorized route **before merging**. No personal GitHub
publishing fallback is used. The workflow files remain untouched in the App PR;
The initial GitHub `checks` job failed on stale architecture fingerprints; the
review fix regenerates source evidence and reruns the same website gate locally.
New workspace-job execution on a GitHub runner remains unverified.


## Review corrections

The first PR revision failed the existing required website check because its
source fingerprints still described the pre-refactor tree. The review maps all
architecture source links/ranges to the actual package owners, adds site-core,
root manifests/lockfile and the parity runner to freshness coverage, and
regenerates all six finalized records through Archify 3.0.1 and the repository's
integration tool. Every integrated SVG hash remains identical; only source
references/revision and generated evidence change. No status or topology changes.

Website check/build passes with the PR workflows and with the owner patch applied.
The patch contains both workflow files plus the matching generated provenance;
only those two workflow fingerprints differ from the PR's provenance, and the
emitted page is identical in both cases. Actual mutation checks prove that edits
to site-core policy source or the root lockfile fail freshness, then pass again
when restored. Infrastructure build and all nine security/local-target tests pass.
The five parity fixtures retain their committed digests, and the runner now also
asserts every historical `boxed-2.1.json` file hash directly. No hosted fixture,
production merge or deployment occurred during review.
