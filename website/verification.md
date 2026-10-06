# Landing verification

## Architecture — 2026-10-06, local verification

Archify 3.0.1 showcase finalization passed all four gates with no diagnostics.
[Reviewed diagram screenshot](../docs/architecture/architecture-preview.png).
The integrated drawing retains editable JSON, source ranges, a committed
implementation revision, sanitized provenance and MIT notices. The standard
header/footer, dark theme, extensionless HTML output/MIME, canonical/OG tags,
sitemap and navigation are prepared for release.

Website checks/build and internal link checks pass. The built page was served
from deployed local S3 with the production CSP, inspected at 1440 × 1000 and
390 × 844, and tested with keyboard activation/focus, flow views, local coverage,
all 36 main-source links and JavaScript-disabled details. No automatic request to
another domain or CSP/console error was observed. Mobile overflow stays inside
the diagram region; the full native node list remains usable.

Customer website production, payments/checkout, apps, MCP services and plugins
remain planned. Local emulation, mocks, adapters and cloud-only controls have
separate annotations. This verifies local behavior, not live `/architecture`,
CloudFront caching, real mailbox delivery or production alarms. Owner approval,
approved merge and the existing website release workflow precede public checks.

## Changelog and author profile — 2026-10-05, local verification

- **Configured locally:** header hash navigation and a semantic `#changelog`
  section immediately after the hero. Equal desktop columns become a stacked
  layout at 900px. Native timeline cards, desktop sticky author profile, owner
  portrait, exact supplied biography, social links and thread context use the
  existing palette/fonts. Hover effects and scroll reveals respect reduced
  motion; the builder pulse stops after four seconds. HTML-linked styles keep
  both Vite development and production readable with JavaScript disabled.
- **Content evidence:** retrieved all five owner-supplied post IDs from X's
  syndication endpoint and confirmed `carlos_olivera`, hashtag, exact text and UTC
  timestamps. `public/changelog.json` records this curated snapshot; no visitor
  requests to X, automatic refresh or embed is configured. Historical design
  posts are explicitly distinguished from live capabilities. The supplied
  227 × 310 portrait is copied unchanged and hosted locally.
- **Source/artifact checks:** Node.js 22.22.3 `npm run check` and `npm run build`
  passed. Behavioral checks cover malformed/duplicate records, author/hashtag
  filtering, ordering, escaping, URL entities, replies, native disclosure and
  empty state. Exact built section HTML, JSON and portrait bytes passed, along
  with development/preview GET/HEAD status, HTML/JSON/PNG MIME and content checks.
  Public-route emitted objects, internal links/anchors and sitemap passed.
- **Browser evidence:** headed Chrome 154.0.8037.98, development at port 5175 and
  production preview at port 4175. Changelog checks passed at 1440 × 900,
  1024 × 768, 768 × 1024, 390 × 844 and 360 × 640 with JavaScript disabled/enabled.
  Verified equal columns/stacking, no horizontal overflow, first-link visible
  keyboard focus and hash scrolling, pointer/keyboard disclosure, canonical
  newest-first post links, explicit UTC dates, reply links, expanded costs link,
  portrait decoding, exact biography, safe external links, entrance reveals,
  direct hash loads and live reduced-motion changes. Production CSP was injected
  locally for preview; development retained Vite HMR. Browser/network diagnostics
  were clean and resource requests stayed on the local origin.
- **Regression evidence:** existing Three.js pause/resume, pointer limits,
  reduced-motion/live preferences, synthetic visibility, WebGL-unavailable,
  actual context-loss, failed-asset and coarse-pointer checks passed. Keyboard
  assertions now include the new hash link and existing Basic subscription link;
  desktop layout asserts a scrolling page instead of a single viewport. Public
  pages/disabled checkout/contact, costs, and SEO/404/icon/CSP checks passed.
  Desktop, tablet and mobile screenshots were visually inspected for spacing,
  text readability and portrait framing; this is not a formal WCAG audit.
- **Limits:** source and evidence stay on local branch
  `codex/changelog-author-profile`. No branch publication, PR, merge, deployment,
  infrastructure change, analytics or payment integration was performed during
  local verification.
  Screenshots and CLI reports remain ignored in `output/playwright/`; public
  delivery and physical-device behavior were not verified by this task.

## Changelog publication preflight — 2026-10-05

After the owner separately requested PR publication, rechecked Operator App
5185075 / installation 167790436 (`a2aviary-operator`): unsuspended, selected
repository-only grant, unchanged permissions and enabled development broker.
Repository auto-merge is disabled. Protected main requires `checks` (App 15368)
and `a2aviary-policy` (App 5185075). Administration-only protection reads remain
unavailable to the development token (403); permissions were not expanded.
Remote main `b9e49d4ad02c4edba90e2656c083fd6d291ce265` has the same source tree as
the local starting commit. Pre-existing owner instruction edits are excluded
from this website delivery. Owner review of the current PR head, merge and
release/public-content verification remain separate actions.

## Launch copy and human support — 2026-10-05, local verification

- Preserved both exact hero lines and existing visual assets. Public pages,
  metadata and JSON-LD contain provider-neutral payment language; removed
  no-sales banners, mailbox disclaimers and commissioned-work wording.
- Basic is presented at $10/month · $100/year with the single visible status
  “Launching soon. Checkout opens when payments are enabled.” Its ordered
  automated site-kit flow is explicitly future behavior; credit amounts and
  subscription policies remain unpublished until before checkout opens.
- Node.js 22.22.3 website check/build, exact emitted policy objects, development
  (5173) and preview (4173) GET/HEAD MIME/body, navigation/anchors/assets,
  six-route sitemap and metadata/JSON-LD checks passed.
- Headed Chrome 154.0.8037.98 public-page checks passed at 1280 × 900,
  390 × 844 and 360 × 640 with JavaScript off/on and production CSP injected
  locally. Disabled CTA activation caused no focus, navigation or requests.
  Keyboard/skip access, contact links, self-hosted requests and diagnostics
  passed. Mobile homepage and pricing screenshots were inspected.
- SEO browser checks passed for canonical/search/social/JSON-LD consistency,
  crawler discovery, icons, Three.js under production CSP and desktop/mobile
  404 accessibility. The verification scripts now drain routed requests before
  closing contexts; a fresh browser run passed without teardown diagnostics.
- Support forwarding is prepared in source, not deployed. Service typecheck/
  build and 47 tests, infrastructure build/synthesis and seven tests passed,
  covering original MIME/attachments, fixed recipients, validation, quarantine,
  duplicate/concurrent receipts, retries, uncertain sends and expired redrives.
  Unit tests use fictional messages and injected local adapters, not live sends.

Public release, hello@ activation and real inbox/reply delivery remain owner
steps in the [runbook](../docs/runbooks.md#human-support-and-public-commercial-pages).
No merge, deployment, checkout activation or external test email was performed.
Earlier dated sections describe historical deliveries.

## Agent control positioning — 2026-10-05, local verification

The exact hero and corresponding search/social metadata now use “Your agent.
Your control. Our build.” and “Open-source software that turns assistant requests
into live sites — and soon more.” Website production remains coming soon; other
capabilities remain coming later. The prior agency slogan is absent from website
source and regenerated share art.

- Node.js 22.22.3 `npm run check` and `npm run build` passed, including brand
  checksums/contours, licenses, icons, costs, internal links, and structured data.
- `check-public-pages.mjs --built --origin http://127.0.0.1:4176` and the development
  check against port 5176 passed: exact emitted policy objects, GET/HEAD HTML
  MIME/body, footer/contact navigation, assets/anchors, metadata/JSON-LD, and the
  existing six-URL sitemap. It already includes all four required policy routes;
  no new route or speculative modification date was necessary.
- `verify-public-pages.js` passed in headed Chrome 154.0.8037.98 at 1280 × 900,
  390 × 844, and 360 × 640, with JavaScript disabled/enabled and production CSP
  injected locally. Navigation, hello@ mailto, focus/skip links, no horizontal
  overflow, only self-hosted requests, and clean diagnostics passed. The visible
  Basic button remained natively disabled; pointer/programmatic activation
  caused no focus, navigation, submission, or checkout requests.
- `verify-seo.js` passed for matching root/index metadata and JSON-LD, crawler
  discovery, six-route XML sitemap, icons, Three.js readiness under local CSP,
  and desktop/mobile 404 presentation. No deployment status is inferred.
- `create-social-preview.js` regenerated the share art and passed its central
  square bounds check. The complete image and desktop/mobile homepage screenshots
  were visually inspected. Local reports are `positioning-public-pages.log` and
  `positioning-seo.log` in ignored `output/playwright/`; existing policy screenshot
  filenames contain this run’s new hero. Mobile dimensions are browser emulation.

The existing proposed Basic plan/legal/contact content remains valid: future
licensed platform access, one curated-kit marketing site, monthly token/bandwidth
credits with no specified allowance, proposed prices, no sales or active payment
operation, and no analytics. Public delivery, mailbox delivery, and payment
readiness remain separate gates. See [release evidence](../docs/release-verification.md#agent-control-positioning--2026-10-05-local-verification).

## Software platform and proposed Basic — 2026-10-05, local verification

These results verify the software-platform copy and coming-soon Basic proposal
locally, separate from the earlier public-page release. The proposal is not a
live catalog or subscription; no checkout, analytics, runtime, or infrastructure
implementation was added.

- Node.js 22.22.3 website `npm run check` and `npm run build` passed. Original
  brand checksums/contours, dependency licenses, icons, linked JSON-LD entities,
  and the cost-sheet rendering/data checks remain valid.
- `check-public-pages.mjs --built --origin http://127.0.0.1:4175` and the same
  check against development port 5175 without `--built` passed. All four policy
  routes returned HTTP 200 and HTML MIME for GET/HEAD; GET matched the renderer
  and HEAD returned no body. Exact built objects were independently compared.
  Footer/contact links, internal anchors/assets, canonical URLs, search/share
  metadata, structured-data references, and the existing six-route sitemap passed.
  No commercial Offer schema or speculative sitemap dates were added.
- `verify-public-pages.js` passed in headed Chrome 154.0.8037.98 at 1280 × 900,
  390 × 844, and 360 × 640 with JavaScript disabled/enabled and production CSP
  injected locally. The Basic CTA is a visible, native disabled button outside
  a form, associated with the proposed-price/no-sales notice. Pointer and
  programmatic activation did not focus it, navigate, or issue checkout requests.
  Links, mailto, visible keyboard focus, skip links, self-hosted resources, and
  clean browser/network/CSP diagnostics passed, without horizontal overflow.
- Existing `verify-costs.js` and `verify-seo.js` passed: supplied costs and totals,
  navigation, six-route XML sitemap, icons, matching homepage metadata/JSON-LD,
  Three.js readiness under local CSP, and desktop/mobile 404 layout remain valid.
- Desktop and mobile screenshots were inspected for the homepage and policy
  pages, including the proposed pricing card and disabled CTA. Screenshots are
  `output/playwright/policies-*.png`; reports are `platform-public-pages.log`,
  `platform-costs.log`, and `platform-seo.log` in that ignored directory.
- Repository documentation checks resolved 114 relative links and Markdown
  anchors across 28 tracked documents. Changed JavaScript syntax checks and
  `git diff --check` passed. Scoped review of the changed files found no
  credential or private-reference material; private publication credentials and
  verification artifacts remain ignored.

Mobile dimensions are browser emulation, not physical-device tests. Vite preview
does not establish S3/CloudFront delivery or missing-path status. The public
release manifest reports the earlier public-page commit
`7b7baf363ff4e9ab5f004c02ba1051a441c8ed1c`; the new copy awaits owner review and
a separately authorized release. Human mailbox delivery and payment readiness
remain unverified. See [release evidence](../docs/release-verification.md#software-platform-and-proposed-basic--2026-10-05-local-verification)
for Operator access and approval gates. Earlier dated results below are retained
as historical observations.

## Original landing — 2026-10-03

Date: 2026-10-03. Tested locally against the production build; this is not a
deployment report. The agency API and pilot remain unimplemented.

## Environment and reproducibility

- Apple M3 Pro, 18 GiB RAM, macOS arm64.
- Node.js 26.5.0 and npm 11.17.0.
- Headed Chrome 154.0.8037.98, driven by Playwright CLI.
- `npm ci`, `npm run check`, and `npm run build` passed. The production preview
  served at the loopback origin printed by Vite.
- Source checksums match all eight PNG imports and three SVG reconstructions.
  Derived inverse variants preserve every path contour. Font and Three.js
  licenses are bundled; the social image is 1200 × 630.

## Layout and visual inspection

| Viewport | Result |
| --- | --- |
| 1440 × 900 | Single screen, readable headline and copy, complete scene and controls. |
| 1280 × 720 | Single screen, complete sculpture with visible sidewalls and open counters. |
| 390 × 844 | Text precedes the scene; complete composition and controls. |
| 360 × 640 | Natural vertical scrolling; content height 731 px in this browser, no horizontal overflow. |

Screenshots were inspected at all four sizes, plus reduced motion, unavailable
WebGL, and context loss. The bird retains its right-facing source silhouette;
the extruded sidewalls, bevels, lit surfaces, and node depths are visible. Dark
components are distinct from the background, and the teal material was tuned to
avoid a washed-out mint/cyan surface. The five paths preserve hole counts of
1, 2, 1, 1, and 0 for head, lower wing, middle wing, upper wing, and eye.

## Behavior and resilience

- Intro settles into the final composition: all component offsets are zero by
  the three-second check. The 2.8-second sequence plays once per page load.
- Tab reaches the pause button with visible focus. Enter freezes the entrance
  and render loop; Enter again resumes and completes the composition.
- Fine-pointer rotation is damped, stays within four degrees in combination,
  and returns to the resting pose after leaving the scene.
- Reduced motion draws the fully assembled scene once, disables pointer motion,
  and presents a disabled control explaining the preference. Changing the
  preference live restarts the loop without replaying the entrance.
- The visibility-change handler stops rendering and resumes without replaying
  the entrance with a synthetic hidden-document state. An actual background-tab
  transition could not be triggered by this browser automation configuration;
  that physical tab-switch scenario remains unverified.
- The real `WEBGL_lose_context` extension produces the independent SVG fallback,
  removes the canvas, and hides the animation control.
- Injected unavailable WebGL and an aborted source SVG request both preserve
  the fallback and readable page. Console errors from deliberately failing
  graphics/network requests are expected only in those isolated failure cases.
- A touch/coarse-pointer context with device pixel ratio 2 ignores pointer
  movement and renders at the capped ratio of 1.5.
- The normal production path had no console warnings, JavaScript errors,
  missing assets, placeholder links, or horizontal overflow.

## Measured rendering

At 1440 × 900 and device pixel ratio 1, a 120-frame ambient sample had a median
requestAnimationFrame interval of **8.3 ms** and a 95th-percentile interval of
**9.2 ms**. The settled scene reported **10,864 triangles and 27 draw calls**;
the mobile configuration reported **5,352 triangles and 27 draw calls**.
An occasional pulse adds one small sphere and one draw call.

These are local frame-cadence observations on this machine, not isolated GPU
timings or a performance guarantee for ordinary laptops or physical midrange
phones. Mobile sizes and touch behavior were emulated in Chrome. Safari,
Firefox, physical phones, and host deployment remain unverified. The adaptive
slow-frame quality reduction is implemented but was not triggered by this run.

## Evidence and remaining configuration

Local artifacts are stored under `output/playwright/`:

- `landing-1440x900.png`, `landing-1280x720.png`, `landing-390x844.png`, and
  `landing-360x640.png`.
- `reduced-motion.png`, `context-loss.png`, and `webgl-unavailable.png`.
- `verification.json`, containing the browser checks, diagnostics, and timing.
- `a2aviary-flight.webm`: 1440 × 900, 30 fps, approximately ten seconds,
  showing entrance, quiet idle, and pointer interaction.

These are local handoff artifacts and are excluded from the commit through the
local Git exclude file. The shareable social-preview image is committed under
`website/public/`. Screenshots and recording contain only the fictional/project
landing, with no client records or private references.

At this original local verification, the CTA was omitted. The initial release adds the verified GitHub destination and records public verification separately in [release evidence](../docs/release-verification.md).
Hosting provider/access, remote repository, domain DNS access, and HTTPS setup
remain required before publishing. No site was deployed or remote URL claimed.

## Public deployment verification — 2026-10-04 UTC

Repeated the existing browser verification script against https://a2aviary.io in headed Chrome 154.0.8037.98 at 1440×900, 1280×720, 390×844, and 360×640. The source scene, motion controls, pointer behavior, reduced motion, loading fallback, unavailable WebGL, and real graphics context loss checks passed without normal-path console warnings/errors or missing assets. Touch/coarse-pointer/DPR checks are emulation; visibility state is synthetic. Physical mobile hardware was not tested. Public TLS/redirects, security/cache/MIME headers, private S3 anonymous denial, the real repository CTA, attribution, and complete social-preview assets were checked. Public revision/workflow and remaining infrastructure gates are recorded in [release verification](../docs/release-verification.md).

## SEO additions — 2026-10-04, local verification

These changes are prepared locally; no website publication or infrastructure
deployment was performed. Live checks before implementation found HTTP 403 S3
XML responses for robots, sitemap, ICO, and a missing page.

- `npm run check` and `npm run build` passed with original brand checksums and
  contours preserved, valid icon directories/PNG dimensions, and resolved
  JSON-LD entity references. Deployment and rendering scripts passed syntax checks.
- Infrastructure TypeScript build and all six synthesized assertions passed,
  including origin 403/404 mappings to `/404.html` with HTTP 404, configured
  error-cache TTL zero, and preserved private origin/security headers.
- `verify-seo.js` passed against the rebuilt loopback production preview in
  headed Chrome 154.0.8037.98. `/` and `/index.html` identify the same canonical;
  search/share copy and structured-data descriptions agree. The sitemap parses
  as namespaced XML and contains only the homepage; robots discovers it.
- Chrome decoded the three-size ICO (selecting its 48-pixel entry) and the
  180-pixel Apple touch PNG. The homepage scene and JSON-LD work with the
  production CSP injected locally, without console or failed-request diagnostics.
- The standalone 404 page was inspected at 1280 × 720 and 390 × 844 with
  JavaScript disabled and production CSP injected locally. External styling,
  logo, noindex, visible keyboard focus, and the return-home link passed with no
  horizontal overflow or console/failed-request diagnostics.
- The dedicated share image was visually inspected at 1200 × 630 and reduced
  wide/square card sizes. The generator checks essential element bounds inside
  the padded central square. The headline and complete bird survive the crop;
  the attribution replaces the obsolete footer text.

Local screenshots and CLI/JSON evidence are under `output/playwright/`. Actual
CloudFront missing-path HTTP responses, production XML/ICO MIME delivery, and
social-platform previews await an authorized release. Vite's unknown-path
fallback does not simulate CloudFront. See the [release sequence](README.md#release-delivery).

## Cost transparency — 2026-10-04, local verification

The supplied Markdown and JSON drafts were copied byte-for-byte, including the
conflicting domain confirmation note. No figures/statuses/sources were changed,
and no invoice or billing reconciliation was performed.

- Website asset checks and production build passed. Renderer checks cover
  escaping untrusted fictional strings, tiny dollar precision, ranges, unknown
  amounts versus confirmed zero, evidence links, and both sitemap URLs without
  invented modification dates. The built JSON is byte-identical to its source.
- Service TypeScript check/build and all 24 behavioral tests passed, including
  the exact extensionless `costs` HTML MIME mapping and retention of existing
  asset MIME types; unrelated extensionless keys remain binary.
- Direct GET and HEAD requests to `/costs?verify=1` on development and production
  preview returned HTTP 200 with `text/html; charset=utf-8`. GET matched the
  generated HTML object; HEAD had an empty body. This verifies local handling
  and the uploader's MIME selection, not live S3/CloudFront delivery.
- `verify-costs.js` passed in headed Chrome 154.0.8037.98 against the rebuilt
  loopback preview at 1280 × 900, 390 × 844, and 360 × 640 with JavaScript
  disabled and enabled and the production CSP injected locally. Every item
  field, optional note, amount, supplied total/basis/caveat, and exclusion
  matched the served JSON. The page contains no browser script.
- Canonical/date, visible keyboard focus, skip link, focusable table region,
  independent mobile table scrolling, home/footer/JSON navigation, and local
  stylesheet delivery passed. Every requested resource stayed on the preview
  origin, with no browser/network/CSP errors or warnings. Desktop/mobile
  screenshots were inspected and saved as `output/playwright/costs-*.png`.
- The existing `verify-seo.js` checks passed for homepage search/share metadata,
  the updated two-URL sitemap, icon decoding, Three.js under the production CSP,
  and desktop/mobile 404 rendering with JavaScript disabled. Source scripts
  passed syntax checks; documentation/source-link targets and whitespace checks
  passed. `infra/` has no changes in this delivery.

These results are local verification. Public `/costs` rendering, HTML/JSON/CSS
MIME/cache behavior, and deployment checks remain unverified until a separately
authorized release. The PR requires current-head owner review for the build and
upload controls. No website publication or infrastructure deployment was run.

## Public policies and contact — 2026-10-05, local verification

The delivery is configured and locally verified on a branch based on remote
main, preserving `/costs` and its supplied figures. It has not been published
or deployed. The pages state no sales, prices, checkout, catalog, or active MoR.

- Node.js 22 website checks/production build and service TypeScript/build plus
  all 24 behavioral tests passed. The infrastructure TypeScript build passed
  for the owner-tag spelling change; no synth or deployment was run. MIME cases cover all exact extensionless page
  keys; nested/unrelated keys remain binary. Original brand checksums/contours,
  dependency licenses and icon dimensions remain verified.
- Direct GET and HEAD to each new route with a query string returned HTTP 200,
  `text/html; charset=utf-8`, exact rendered HTML for GET and no body for HEAD,
  on development and production preview. The emitted objects were independently
  compared to their renderers, and the built cost JSON matches its original.
- Internal navigation, homepage/contact anchors, referenced assets, canonical
  URLs, Open Graph/X/search copy, JSON-LD references and six sitemap URLs passed.
  There are no structured commercial offers or logos and no invented sitemap
  modification dates.
- `verify-public-pages.js` passed in headed Chrome 154.0.8037.98 at 1280 × 900,
  390 × 844 and 360 × 640 with JavaScript disabled and enabled and production CSP
  injected locally. All four pages are readable; external CSS loads, no page
  overflows horizontally, focus is visible, and skip links reach content.
  Contact links reach the visible homepage mailto block; homepage and costs
  footer navigation reaches the new pages. Requested resources are self-hosted,
  with no browser/network/CSP errors or warnings.
- Existing `verify-costs.js` passed at its desktop/two mobile sizes, with
  JavaScript disabled/enabled and local CSP. Every supplied JSON field, amount,
  total and note remains intact. `verify-seo.js` passed for homepage metadata,
  six-URL XML sitemap, icons, Three.js readiness and desktop/mobile 404 behavior.
- Social artwork was regenerated with Carlos Olivera Terrazas at 1200 × 630.
  The generator's padded-square bounds check passed; the full image and
  wide/square reductions were inspected. Page screenshots were inspected for
  desktop and mobile readability and contact/footer layout.
- Source syntax, relative repository documentation links and anchors, scoped
  credential/private-reference review, and `git diff --check` passed.

Local screenshots are `output/playwright/policies-*.png`; cost and SEO logs
are `policies-costs.log` and `policies-seo.log`. All verification outputs remain
ignored. Mobile dimensions are browser emulation, not physical-device evidence.
Local preview checks do not prove S3/CloudFront HTTP behavior or email delivery.
The existing Operator development broker is disabled, so branch publication
and PR creation await owner activation. Public release, hello@ mailbox delivery,
and Paddle submission/catalog remain owner follow-ups. No main push, merge,
website/infra deployment, payment setup, or SES change was performed.
