# Site generator

Node.js 22 package for the fixed web-simple Astro catalog, canonical spec hashes,
server image normalization, hosted Agents API verification, private artifact
storage and isolated Railway/PocketBase provisioning. It does not extend the AWS
brief-analysis flow.

Read [site operations](../../docs/sites.md) before activation. Run `npm ci`,
`npm run check`, `npm run build`, `npm test` and `npm run fixture` here. Build
before installing the local dependency in `apps/platform`. The build emits
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

## Component library

[Library maintenance](../../library/README.md) documents the 12 component contracts,
12 standard variants, template grammar, CSS subset and generated registry. Run
`npm run library:generate` after package edits, then `npm run check`, `npm run build`
and `npm test`. Check/test/build reject stale data; they never silently regenerate
it. Services check also runs the validator through the existing CI workflow.
The Docker build includes library source; the runtime bundle contains only checked
AST/CSS data and needs no source library directory. No dependency was added.

`GENERATOR_VERSION` is `2.1.0`, a minor additive presentation capability retaining
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
