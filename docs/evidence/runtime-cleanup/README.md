# Runtime cleanup — 2026-10-13

Prepared from main `27f642acf462bb34afc7428cc5ca04852f205f96`, after PR #37 and
PR #38 merged. Node.js 22.23.3. No migration, policy 2.2.0, infrastructure,
payment, production variable, deployment or email runtime change. The owner
explicitly authorized registering a dedicated Railway SSH key and running only
the three read-only production inventory queries before source cleanup.

## Production precondition

At 08:23:56 UTC−04:00 on 2026-10-13, the owner-authorized SQL completed successfully
in a `REPEATABLE READ READ ONLY` transaction, ending with `ROLLBACK`. Draft counts
joined each draft's site and filtered site policy versions other than 2.2.0;
snapshot counts filtered `spec.policyVersion` 2.0.0/2.1.0 and the four specified
states; site counts excluded archived sites. Empty grouped results mean zero:

| Precondition | Observed count |
| --- | --- |
| Non-2.2.0 policy drafts, all states | 0 |
| 2.0/2.1 snapshots verified, approved, deploying or live, by state | 0 |
| Non-archived sites outside policy 2.2.0 | 0 |

Raw SQL, access details and command output stay privately under `.local/` in the
original checkout. They are point-in-time inventory evidence, not a claim about
all current-version sites or a cleanup of production data. The owner should
confirm this inventory during review. The SSH key was registered with explicit
owner authorization, not by widening the source-cleanup scope.

Railway reported PR #38's exact main revision as successfully deployed.
Public [health](https://platform-production-d84c.up.railway.app/healthz) returned
HTTP 200 with `discovery-only` and seven migration names/hashes matching main;
the [redacted body](production-health.json) contains no client data. This verifies
readiness only. Main's published protection requires `checks` (Actions App 15368)
and `a2aviary-policy` (Operator App 5185075). `platform`, `generator` and
`platform-image` were not required in that initial public read. A later
Operator-authenticated read at 09:00 UTC−04:00 independently confirms all five
are now required; repository auto-merge remains disabled. This task changed no
check protection. Railway `source.checkSuites=true` confirms Wait for CI enabled.
No setting was changed.

## Scope and behavioral differences

Only `SUPPORTED_POLICY_VERSIONS = ['2.2.0']` is accepted. Historical versions now
return `policy_version_unsupported`, including draft read/discard, mutation,
approval, worker verification and deployment. The historical loaders/artifacts
are removed after the zero-use gate; negative tests replace compatibility tests.
Historical boxed resource captures remain evidence, not supported runtime inputs.
The current frozen policy snapshot check remains.

CMS collections compile with the library tooling into inert site-core data.
Field types/bounds, public/editor rules, labels and display fields are schema
validated; unknown files, symlinks, duplicate/reserved fields, invalid rules and
policy collection-set disagreement fail closed. Runtime binding, validator,
Caddy, PocketBase and editor output consume that data. Differing reviewed field
schemas are covered by a browser editing/saving test. There is no runtime loading
or evaluation of collection code.

[Removed-file inventory](removed-files.json) lists 40 deleted files (23,343
lines, including eight compatibility re-exports) and six moved tool modules.
Eight root compatibility re-exports are deleted and all consumers import the
domain implementations. Tool definitions/registry/schemas move under `src/tools`;
`TOOL_ROLES` and `legacyToolRoles` are removed. A single registry order preserves
the prior `tools/list` order and is shared by capabilities and consent.

The deliberately updated [visibility snapshot diff](tool-visibility-diff.json)
checks every one of 32 role/flag contexts against the old snapshot:

- 24 discovery-only contexts stop advertising unregistered `library.get`.
- Eight active contexts reorder capabilities to match `tools/list`, without
  changing the tool set.
- Eight superadmin contexts reorder the `logs.query` tool-filter enum to the same
  canonical registry order; the enum values/validation semantics are unchanged.
- `tools/list` registration order, every other schema/annotation/response field,
  feature gates and permissions are unchanged. The separate complete list snapshot
  changes only the corresponding superadmin tool-filter enum ordering.

The release status page becomes a short current table and open gates. All prior
prose, tables and dated sections move to October history; only relative link
URLs are frozen to their original source revision. Reversing that mechanical
rewrite recovers the original bytes; [preservation hashes](history-preservation.json)
record both files. Evidence was not rewritten. AWS signed-email services,
infrastructure, local emulation and request contracts are marked legacy,
maintenance only. AWS landing delivery remains unchanged.

[Architecture scope](../../../website/scripts/architecture-scope.mjs) requires
fresh provenance for architecture-relevant paths or `ARCHITECTURE_RELEASE=1`;
unrelated PRs emit a stale-source warning. Structural/receipt/asset/CSP checks
remain blocking, and source ranges refer to the recorded commit. Exact path/base
rules are documented in [local development](../../local-development.md#exact-architecture-freshness-rule).

## Exact-byte evidence

[Byte baseline](byte-baseline.json) was recorded before source edits using the
new comparison harness against unchanged main. `npm run test:parity` compares
all four current fixtures (catalog, dark-en, light-es, contrast-es), preserving
generator 2.3.0, all 2.2.0 contract hashes, spec/source digests, every generated
file and binary resource, every Astro-built resource, Caddyfile, PocketBase
migration and CMS editor HTML/JS. The four fixtures also retain the existing
site-core workspace hashes. Compiled library metadata/templates/registry,
current policies/contracts, checker templates and all SQL migrations remain
byte-identical in Git. Local fixture bytes do not establish hosted operation.

## Verification

Observed local passes so far: root workspace build/check; 52 site-core tests;
82 generator tests plus library/presentation browser matrices (148 captures and
168 cases); platform suites with documented hosted skips; website path-rule
regressions; services check/build/58 tests and infra build/nine tests; the
current-fixture byte parity gate; a Linux platform image build; and real local
PocketBase/Caddy CMS login/editing, anonymous restrictions, compression and CSP.
Final local results: 80 platform passes with two hosted skips; 82 generator
passes; 52 site-core passes; two architecture scope regressions; services 58 and
infra nine passes. Six diagrams passed validation/delivery/provenance/browser
([gates](architecture-gates.json)). The integrated page passed all five stages,
44 technical nodes, keyboard/focus, desktop/mobile and JavaScript-free access
under production CSP with zero automatic external requests
([browser evidence](architecture-browser.json)); desktop/mobile and the advised
hosting route were visually inspected. The platform browser exercised the
actual seven-page checker: 52 passing checks and 14 captures
([report counts](local-browser.json)). Its prior hardcoded summary count was
corrected to report the observed count. Fictional sessions do not prove Google
authentication. The final Linux image builds, then generates as UID 1000 with
network disabled and matches the catalog digest while rejecting policy 2.1.0.
Current byte parity, website release check/build, real local CMS tests and
396 documentation links/anchors pass. Detailed logs remain private. Detailed local
logs, captures and container diagnostics stay ignored under `.local/` or temporary
log paths; no production credentials are used in these tests.

## Owner actions

Review and approve the Operator-authored PR; confirm the inventory; optionally
tag pre-cleanup commit `27f642acf462bb34afc7428cc5ca04852f205f96`, the last commit
containing the removed historical policies/contracts. No tag is created here.
Main check protection, merge, activation, deployment and remaining release gates
require separate owner action. Repository auto-merge must stay disabled.

The [freshness regression](architecture-freshness-regression.json) introduces a
temporary unrelated test file: stale provenance warns and passes, release mode
fails, and the real branch check passes after the marker is removed.
