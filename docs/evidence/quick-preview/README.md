# Quick preview — local evidence, 2026-10-13

This is prepared source for ADR 015's quick render level, preserving ADR 013's full
verification/approval/deployment boundary. Limits and migration 009 await owner
review. No production changes, hosted verifier calls or OpenAI calls were made.
All test inputs are fictional; owner content and credentials are excluded.

## Read-only preflight

PR [#40](https://github.com/carlos-olivera/a2aviary/pull/40) merged as
`1298f435dd7665821d8f88034bd39573a6aad9a9`. The `main` push
[CI run 38424489691](https://github.com/carlos-olivera/a2aviary/actions/runs/38424489691)
completed successfully. Railway deployment `68985968-39f0-4753-9534-c0ae344aaeca`
reported SUCCESS for that exact commit. Public
[health](https://platform-production-d84c.up.railway.app/healthz) returned HTTP 200,
`discovery-only`, and exactly eight migrations (001–008). Each SHA-256 matched the
corresponding file fetched from that merge commit. This establishes discovery
readiness, not site-workflow activation. The owner's uncommitted
`packages/generator/src/verification.ts` edit remains in the original checkout;
this isolated feature checkout starts at the merge commit and excludes that edit.

## Isolation decision

Scripts stay **off** in quick preview. Full preview is unchanged. The candidate
`allow-scripts` without `allow-same-origin` correctly denies `document.cookie`,
fetch under `connect-src 'none'`, and top navigation. However, a real Chromium
probe demonstrates script-initiated navigation of the frame itself reaching a
loopback network endpoint, including when opened directly (where no wrapper
`frame-src` restriction exists). A blanket no-network guarantee cannot follow from
`connect-src` and an opaque origin alone. We therefore retain ADR 013's stronger
no-script boundary, omit generated script tags/files, deny clipboard/device
permissions, and keep CMS empty-state content. Flip/tilt/copy fallbacks stay static.
The decision is conservative even though the shipped behavior bundle is reviewed
and does not intentionally navigate; a script allowlist alone is not the requested
network confinement proof. No weaker verified-preview policy is proposed here.

The model aligns with the [CSP sandbox definition](https://www.w3.org/TR/CSP3/#directive-sandbox)
and [HTML iframe sandbox restrictions](https://html.spec.whatwg.org/multipage/iframe-embed-object.html#attr-iframe-sandbox).
Fetch permissions and navigation permissions are distinct. Browser regressions
exercise actual server arrivals (not just Playwright's request events, which can
include blocked attempts), direct file opening, cookie access, fetch/images,
forms and top navigation. They also exercise the rejected script-enabled candidate.
Allowed traffic is limited to loading the preview and its signed static resources;
this does not claim that user-initiated outbound links are a network firewall.

## Reproduction and timing method

Use Node.js 22.23.3 and the loopback-only Postgres test fixture:

```sh
npm ci
npx playwright install --with-deps chromium
npm run build
npm run check
npm test
node packages/generator/scripts/quick-preview-benchmark.mjs
```

### PR #41 CI prerequisite correction

In [run 38446942105, platform job 115467684283](https://github.com/carlos-olivera/a2aviary/actions/runs/38446942105/job/115467684283),
the `npm test -w a2aviary-platform` step reported 89 passes, seven failures and
two opt-in skips. All seven failures were `browserType.launch: Executable doesn't
exist` for Playwright's `chromium_headless_shell-1243`: the five composition cases
at `quick-preview.test.mjs:82`, the chosen-sandbox test at line 323, and the
rejected `allow-scripts` candidate test at line 416. The generator job installed
Chromium, but its separate runner cannot supply the platform job's browser cache.
The developer machine already had the matching browser, masking this prerequisite.

The platform package now installs the lockfile-selected Playwright Chromium and
Linux dependencies in `pretest`, using the same command as the generator job.
This also provisions a fresh local checkout. GitHub rejected a workflow-file edit
because the Operator App lacks `workflows` permission; the package test prerequisite
uses existing App permissions and leaves workflow files and required checks intact. No tests
are skipped and no quota, concurrency or child-process budget is changed: the quota
and concurrent-verification cases passed in the failed run, and no render timeout
was reported. This correction changes test setup only, not production behavior.

Local verification of the correction reproduced the launch error with an empty
browser cache, installed Chromium into that cache and successfully launched
153.0.8010.12. The complete platform suite passed (96 passes, zero failures, two
existing opt-in skips); website checks passed with current architecture source
fingerprints. The new PR CI run remains the independent Linux-runner verification.

The benchmark normalizes fictional inputs once, then measures quick child startup,
validation and direct rendering against source generation plus the unchanged real
`verify.mjs` (Astro, axe, links, Lighthouse, screenshots at 390/1280 and existing
motion/network checks). Full dependencies are preinstalled. No hosted queue,
upload, package installation, Agents acknowledgement or provider latency is
included. Five quick and three full samples per composition use nearest-rank p50
and p95; with these small sample counts p95 is the maximum, not a production SLO.
Static CSS/fonts/images/notices are checked byte-for-byte against built files.
Quick authored HTML uses the same trusted renderer but skips Astro serialization,
removes scripts and omits generated 404 output. These deliberate differences are
why quick bytes never become verified or deployable artifacts.

## Observed local timings

[Raw samples and checker results](timings.json), Node 22.23.3 on macOS:

| Composition | Pages | Quick p50 / p95 (ms) | Full p50 / p95 (ms) |
| --- | ---: | ---: | ---: |
| dark-en | 1 | 265 / 271 | 11848 / 15315 |
| light-es | 1 | 242 / 295 | 11764 / 11815 |
| contrast-es | 1 | 239 / 292 | 11813 / 11831 |
| profile | 1 | 244 / 294 | 11641 / 11900 |
| catalog | 7 | 250 / 300 | 60232 / 61141 |

All fifteen local full runs passed the checker. These measurements support
skipping the Astro build/checker for iteration; they do not estimate hosted
billing or promise production response times. The final catalog sample overlapped
other local checks; the samples describe this development machine, not an isolated
performance laboratory.


## Completed local verification

- Workspace check/build: passed on Node 22.23.3. Site-core 52/52 tests;
  generator 85/85 tests, including the library's 148-capture browser matrix and
  presentation behavior/boundary checks. Existing four-fixture byte-parity checks
  pass; full generated/built artifacts, checker and generator version are unchanged.
- Platform: 96 passed, two explicitly opt-in cloud tests skipped, zero failures.
  The ten quick-specific tests cover five compositions (including catalog and
  profile starter), both widths, actual CSS/font/image loading, the shared blockers
  and suggestions, wrong ownership, revisions/discard, expiry, token purpose,
  daily/burst/service quotas, counted failures, global concurrency admission,
  approval GET/POST and deployment rejection. A paused quick render leaves full
  verification available and a concurrent edit prevents returning its stale URL.
- Isolated-renderer tests cover input/output overflow, kill deadline, process
  failure, rejection of a verified result and secret-free environment inheritance.
  Browser isolation checks and the rejected script-enabled candidate pass.
- Service check/build and 58 tests; infrastructure build and nine tests; website
  check/build and two tests; all passed. Relative links in changed Markdown pass.
- Platform image build passed. The packaged renderer ran with Node 22.23.3 as
  UID 1000 under `docker run --network none`, producing nine files and
  `verified: false` from a fictional composition. No runtime credentials supplied.
- Architecture regenerated with the existing **Archify 3.0.1** format, pinned to
  source commit `4939829`. All four gates passed for all six drawings. Desktop and
  mobile captures were inspected; the production-CSP browser procedure passed
  five stages, 44 technical nodes, keyboard and JavaScript-free access, and zero
  automatic cross-domain requests. The current 3.1 emitter adds inline SVG CSS
  incompatible with this repository's existing CSP integration; the existing
  version was used without weakening CSP or changing the diagram integration.

The first aggregate platform run caught two stale test expectations (eight
migrations and the role/tool allowlist); those were updated and the complete
platform suite reran green. An overlapping ad hoc run correctly hit the global
quick lock; the sequential ten-test run passed. These were local test iterations,
not production failures or bypassed checks.

## Publication gate and remaining owner actions

Read-only checks repeated at **2026-10-13 14:25:15 America/La_Paz (18:25:15 UTC)**:
the same PR #40 merge remains main, its CI is green, Railway's matching deployment
is SUCCESS, and health is HTTP 200 with discovery-only and eight matching hashes.
Operator broker access is live and repository-only; main retains required
`checks`, App-bound `a2aviary-policy`, `platform`, `generator`, and `platform-image`.
Repository auto-merge is disabled. No settings or permissions were expanded.

Owner review must decide the proposed limits, process-local ephemeral retention,
script-off isolation and additive migration 009. The PR is not a deployment or
production verification. Merge, production backup/restore, migration/rollout and
workflow activation remain separately authorized owner actions. Nothing is for
sale; no live checkout or active Paddle merchant of record exists.
