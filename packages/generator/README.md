# Site generator

Node.js 22 package for the fixed web-simple Astro catalog, canonical spec hashes,
server image normalization, hosted Agents API verification, private artifact
storage and isolated Railway/PocketBase provisioning. It does not extend the AWS
brief-analysis flow.

Read [site operations](../../docs/sites.md) before activation. Run `npm ci` and `npm run build` from the repository root, then
`npm run check -w @a2aviary/generator`, `npm test -w @a2aviary/generator` and
`npm run fixture -w @a2aviary/generator`. The root workspace links the
[site-core](../site-core/README.md) domain and platform without a `file:` install. The build emits
runtime/types, replaces the copied trusted checker resources, installs the
SHA-pinned Railway CLI and preserves dependency licenses. Astro is pinned to
7.3.6 and PocketBase to 0.40.4.

The local fictional seven-page fixture uses complete catalog content and a
server-normalized WebP. Its actual browser checker builds Astro, checks axe,
links and Lighthouse, and captures every authored page at 390 and 1280 px.
Approval and client preview bundles are absent from canonical specs. Image
decoding runs in a bounded, secret-free child; the controller checks output
hashes and WebP headers. Approved deployments use the stored verified file map.

Postgres behavioral tests use explicit provider doubles. The real local browser
and Docker PocketBase/Caddy checks exercise actual builds and editing without
redeployment; they do not establish cloud deployment or Google authentication.

The separately authorized hosted tester fixture uses the one-shot
`apps/platform/scripts/run-hosted-fixture.mjs` runner with read-only Railway
configuration, child-only credentials and a disposable loopback database. It
stops at the first failure and attempts teardown once. Do not rerun an existing
attempt marker or substitute production database credentials. See
[release evidence](../../docs/release-verification.md) for the observed result,
cleanup limits, unavailable billing amounts and unresolved rollout gates.

## Component library foundation (PR #29 historical baseline)

[Library maintenance](../../library/README.md) documents the 12 component contracts,
12 standard variants, template grammar, CSS subset and generated registry. Run
`npm run library:generate` after package edits, then `npm run check`, `npm run build`
and `npm test`. Check/test/build reject stale data; they never silently regenerate
it. Root `site:check` and `library:check:static` enforce the relocated domain gates.
The prepared workspace CI patch requires owner application before merge.
The Docker build includes library source; the runtime bundle contains only checked
AST/CSS data and needs no source library directory. No dependency was added.

The foundation used `GENERATOR_VERSION` `2.1.0`, a minor additive presentation capability retaining
policy/contract 2.0.0. Output bytes change (`data-v`, tokenized/selected CSS), so
existing version-bound source hashes and preview deduplication use a new identity.
Approved stored snapshots are still deployed without rebuilding.

### Equivalence procedure

Before editing, build the pinned baseline (`02b811595d59cfe7ff904ae8ef3d5fa521dc7b63`,
generator `2.0.0`) and retain its `dist` and access to the same locked dependencies.
The runner accepts the baseline/candidate module explicitly and serves only on
loopback with self-only script/style CSP and controlled fictional CMS responses:

```sh
# From the repository root; BASELINE_MODULE points to that retained dist/index.js.
node packages/generator/scripts/library-equivalence.mjs capture "$BASELINE_MODULE" output/playwright/library-before
node packages/generator/scripts/library-equivalence.mjs compare packages/generator/dist/index.js output/playwright/library-after output/playwright/library-before
```

It compares both the manifest example and fixture, all seven pages, widths 390 and
1280 (height 900, DPR 1), and empty/populated/error CMS states: 84 screenshot pairs.
The same Chromium and fonts are used; images and fonts settle before capture.
Decoded RGBA pixels are compared exactly with Sharp, and before/after/diff PNGs and
JSON reports remain in ignored `output/playwright/`. HTML comparison permits only
whitespace normalization and removal of the newly added wrapper `data-v`.

On 2026-10-11 all 84 comparisons had zero changed pixels, and all HTML comparisons
passed. The checked-in golden fixture pins baseline HTML and the unchanged CMS
script digest. No intentional visual/content difference was introduced. This is
local evidence, independent of the hosted verifier and production status.


## Library runtime verification

The following paragraph records the 2.1 historical baseline.

Policy 2.1.0 / contract 2.1 use generator 2.2.0. The library now includes two
curated font packages. `library:check` runs the complete local browser matrix;
`library:check:static` and `check:static` are explicit build/container gates.
At that historical baseline, static CI was invoked through services. Current
workspace CI is prepared as an owner-applied patch with browser/platform jobs.
Browser screenshots and summary are ignored under `.local/library-check/`.
Run platform tests with a dedicated loopback `TEST_DATABASE_URL`, never production.
The local CMS test also checks actual gzip/zstd responses, decompressed bytes and
unchanged CSP. The normal fixture verifier adds motion/network checks to all
existing gates. Hosted tests require separate authorization and are skipped here.

Acorn 8.19.0 (MIT) is the only new development dependency, shared explicitly by
services and generator checking. Existing esbuild performs minification. There
is no parser dependency in generated client sites. Fontsource generator
runtime dependencies are removed; curated bytes and OFL notices are stored in
`library/fonts` and included with generated font resources.


## Presentation batch verification

Current source uses policy 2.2.0 / contract 2.2 and generator 2.3.0. The
[twelve experimental entries](../../library/README.md#contract-22-amendment) are
tester-only and require owner-supplied shell/control content. All historical 2.1
contract files remain frozen. `library:check` adds three equal-status fictional
compositions, front/back states, 390/1280px, normal/reduced motion, content/optional
boundaries, font palettes, no-JS and input/clipboard failure paths.

After building, run `node scripts/presentation-verify.mjs` from this directory for
all three real local Astro verifier runs. Evidence (including resource sizes,
Lighthouse scores, axe, reduced motion, network guards and screenshots) remains
in ignored `.local/presentation-verifier/` at the repository root. See
[dated release evidence](../../docs/release-verification.md#presentation-batch--2026-10-12-local-implementation).
No runtime dependency, infrastructure, migration or provider integration was
added. Generated selected fonts carry original OFL licenses and registry hashes.


## Workspace ownership

Install once at the repository root with Node 22.23.3. Build site-core declarations
before checking/building generator, and build generator before platform. Root
`npm run build` follows that order. The explicit root `npm run check` uses the
static library gate; generator `check` and `test` retain the full browser matrix.

Generator imports site domain code only through `@a2aviary/site-core`; its existing
exports retain compatibility aliases. Test helpers use the test-only
`@a2aviary/site-core/fixtures/catalog` and `/fixtures/presentation` exports.
The compiler retains presentation AST/CSS in `src/library-data.ts` and writes
catalog metadata to `packages/site-core/src/library-data.ts`. Both remain
byte-identical to the pre-move artifacts. Package files, template lockfile and
`GENERATOR_VERSION` are unchanged. See [refactor evidence](../../docs/evidence/site-core-workspaces/README.md).
