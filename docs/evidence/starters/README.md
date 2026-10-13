# Profile starter — local verification, 2026-10-13

## Scope and status

Prepared on `codex/profile-starter` from main `cf3f987`. This implements the
starter portion of ADR 015; quick preview, live edits, other starters and stable
promotion remain out of scope. No production writes, deployment, owner approval
or merge were performed. The original checkout's uncommitted
`packages/generator/src/verification.ts` allowlist change is excluded.

Migration 008 is additive and reviewed with this delivery. Existing rows acquire
`kind=website` and null provenance. The transactional checksum-pinned migrator
applies it once; repeated migration runs pass locally. SQL updates to kind or
starter provenance fail; no-op updates pass. Owner review/merge and the normal
Railway rollout remain required. Production must still have seven migrations at
this PR's publication preflight.

## Behavior exercised

Real OAuth/MCP requests and a disposable loopback Postgres schema exercise:

- Three fictional tester compositions seeded from `profile` 1.0.0, completed by
  `site.draft.apply`, uploaded/normalized through the existing upload session,
  previewed and built with explicit verifier/object-store provider doubles.
  Inputs cover dark English, light Spanish and high-contrast Spanish using only
  system fonts. Suggestions remain present with zero blockers after completion.
- Atomic site/draft/provenance creation; retry binding and conflicting selection
  rejection; tester-only discovery/get/create; rejected non-test creation writes
  no site; incomplete preview refusal and no seeded copy or presentation values.
- Removal of the entire seeded page and all blocks, replacement by unrelated FAQ
  blocks on two new pages, token changes, and a seeded timeline-to-standard variant
  change. Both compositions preview/build without starter blockers. Removing shell
  labels/fonts after free composition still blocks preview instead of falling back.
- An existing pre-008 row survives migration; kind, starter ID and version are
  immutable. Blank drafts preserve legacy language behavior and absent provenance.
- Compiler rejection of default copy/values, inheritance, unsafe files/symlinks,
  invalid package/status/compatibility, plan limits and changed frozen versions.

These local provider doubles are not hosted verification or a deployment.

## Full local verifier

The dark-English input and normalized image bytes were captured from the real
local MCP flow above, then run through the unmodified generated verifier with
Node.js 22.23.3. The [machine report](local-verifier.json) records all ten checks
passing: Astro build, syntax, axe, links, Lighthouse, reduced motion, screenshots
and no external browser requests. Axe reports zero violations; links report zero
broken references; Lighthouse accessibility and best practices are both **1.00**.
Reduced-motion checks report zero running animations at both widths.

| Resource group | Raw bytes | gzip bytes | Files |
| --- | ---: | ---: | ---: |
| HTML (including 404) | 4,553 | 1,673 | 2 |
| CSS | 10,550 | 2,334 | 1 |
| JavaScript | 6,447 | 2,389 | 2 |
| WOFF2 | 71,060 | 71,137 | 4 |
| WebP | 9,836 | 9,859 | 1 |
| Other generated resources/notices | 13,402 | 5,974 | 3 |

These are local artifact measurements, not commercial metrics or network transfer
claims. Already-compressed font/image files can grow under gzip.

Screenshots were visually inspected at [390 × 2660](profile-dark-390.png) and
[1280 × 2571](profile-dark-1280.png). They contain fictional identity/content only;
expressive text/effect animation may be captured mid-transition. The starter
itself includes none of this copy, imagery, palette or font selection.

## Reproduce

Use the repository's pinned Node.js 22.23.3 and loopback Postgres fixture:

```sh
npm ci
npm run build
npm run check
npm test
npm run test:parity
STARTER_VERIFIER_INPUT="$PWD/.local/starter-verifier" node --test apps/platform/test/starters.test.mjs
node packages/generator/scripts/starter-verify.mjs
```

Tool snapshots intentionally add `starters.list`/`starter.get` only with the
existing site workflow feature, add optional starter selection to draft creation,
and update the registry-derived log-filter enum. Role gates and disabled-workflow
visibility remain covered. Frozen 2.2 policy/contracts and all four pre-existing
fixture generated/built byte baselines remain unchanged.

## Observed checks and publication preflight

- Workspace TypeScript/contracts/static checks and builds pass on Node 22.23.3.
- Site-core: 52 tests passed. Generator: 84 tests passed; library browser matrix
  148 captures and presentation matrix 168 cases passed. Platform: 86 tests
  passed, zero failures; two separately opt-in hosted/local-CMS tests skipped.
- Both four-fixture parity gates pass, including exact historical boxed bytes.
- Docker image build passes. The packaged non-root runtime reports UID 1000,
  Node 22.23.3, eight migration files and seven profile seed blocks; non-test
  starter discovery is empty and tester discovery includes profile 1.0.0.
- Website checks/build, architecture scope tests, regenerated source provenance,
  relative documentation file targets and `git diff --check` pass. Existing
  drawings and their original validated source revision remain unchanged.

Before publication, read-only checks confirmed main CI run
[38415350521](https://github.com/carlos-olivera/a2aviary/actions/runs/38415350521)
completed successfully for `cf3f9877e2e0f649837d903c757ce6ab4987a62e`.
Railway deployment `62290ff5-1a48-43fd-b999-e29b27ab2fe5` reports **SUCCESS**
for that exact revision (updated 2026-10-13 14:51:15 UTC). The
[public health observation](production-health.json) at 15:28:38 UTC reports
HTTP 200, exactly seven matching migration names/hashes and `discovery-only`.
This establishes the requested baseline, not deployment of the new starter.
