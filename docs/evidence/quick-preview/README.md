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
npm run build
npm run check
npm test
node packages/generator/scripts/quick-preview-benchmark.mjs
```

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

