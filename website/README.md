# a2aviary landing page

The hero uses “Your agent. Your control. Our build.” and “Open-source software that turns assistant requests into live sites — and soon more.” Website production remains coming soon.

A static introduction to an open-source software platform for agent-to-agent
digital work. “Agency” is branding and a metaphor. Websites are the first planned
catalog item; website production, apps, MCP services, plugins, and other digital
capabilities are coming soon. This website does not implement those capabilities;
actual runtime and deployment evidence is in [release verification](../docs/release-verification.md).

## Run locally

Use Node.js 20.19+ on the 20.x line, or 22.12+; npm is required. From the
repository root:

```sh
cd website
npm ci
npm run dev
```

The local development URL is printed by Vite (normally `http://127.0.0.1:5173`).
Build and inspect the production output separately:

```sh
npm run check
npm run build
npm run preview
```

The production preview normally runs at `http://127.0.0.1:4173`. `dist/` is
generated and excluded from Git. Dependency versions and the npm lockfile are
committed. No account, backend, environment variable, or API key is needed.

## Implementation

- Semantic HTML contains all essential copy. The Three.js renderer is loaded
  separately, and an inverse SVG is visible until a usable canvas is rendered.
- `src/scene.js` parses the original named SVG paths with `SVGLoader` and
  `ShapePath.toShapes()`, preserving the inherited even-odd fill rule. Contours
  and holes are normalized and oriented before extrusion. The bird is 6.2 units
  wide, with 0.31 units of depth and small controlled bevels.
- `src/animation.js` owns a 2.8-second entrance, quiet ambient movement, and
  damped pointer input with a combined four-degree limit.
- `src/renderer.js` owns container sizing, rendering, pause, media preferences,
  visibility, and cleanup. Reduced motion draws the settled scene once and
  disables pointer movement. Manual pause freezes both entrance and idle motion.
  Resizing can redraw a paused scene without advancing it.
- WebGL initialization, SVG loading, and graphics context loss fall back to an
  independent SVG. Context loss is terminal for that page load; reload to retry.
- Pixel ratio is capped at 2 on desktop and 1.5 on mobile. Mobile contours and
  bevels use fewer segments. A sustained slow-frame sample reduces the cap to 1.
  No bloom, environment map, external model, or per-frame geometry is used.

## Brand derivations and licenses

The visual direction is an exploration for this landing, not approval of a
global identity. Original resources and their provenance remain in
[the brand inventory](../brand/readme.md) and
[manifest](../brand/manifest.json).

`public/brand/a2aviary-bird.svg` is a byte-identical copy of the source bird for
runtime loading. The inverse logo and bird replace only `#0B1220` fills with
`#F5F7FA`, plus descriptive metadata; contour geometry and teal are unchanged.
`public/favicon.svg` derives from the inverse bird. The ICO contains 16, 32,
and 48-pixel PNG variants; the Apple touch icon is 180 × 180. Both center the
existing bird on charcoal. `public/social-preview.png` is a dedicated 1200 × 630
browser-rendered composition using the inverse SVG and the landing's local
fonts. Its identity, complete bird, headline, and Carlos Olivera Terrazas attribution
fit inside the centered 630 × 630 crop with padding. No source PNG or SVG was
overwritten; these derivations do not approve a global visual identity.

Space Grotesk 500 and Inter 400 are self-hosted through pinned Fontsource
packages, with their SIL Open Font Licenses in `public/licenses/`. Three.js's
MIT license is retained there as well. The site source follows the repository's
[Apache 2.0 license](../LICENSE); brand-use permissions remain separate.

## Browser verification

See [the recorded results](verification.md). The reusable browser checks use
Playwright CLI, separate from the site's dependencies. From the repository root,
with the production preview already running:

```sh
mkdir -p output/playwright
npx --package @playwright/cli playwright-cli -s=a2aviary open http://127.0.0.1:4173 --headed
npx --package @playwright/cli playwright-cli -s=a2aviary run-code --filename=website/scripts/verify-browser.js
```

The script uses the open page's origin and saves screenshots to
`output/playwright/`. These are local verification outputs, not deployment
assets. Regenerate the social image against a working preview with:

```sh
npx --package @playwright/cli playwright-cli -s=a2aviary goto http://127.0.0.1:4173
npx --package @playwright/cli playwright-cli -s=a2aviary run-code --filename=website/scripts/create-social-preview.js
```

Rebuild after regenerating the image. `npm run check` verifies source checksums,
derived contours, bundled licenses, social image dimensions, icon directory and
PNG dimensions, referenced head assets, and linked JSON-LD entities.

Regenerate the icons against the same local preview, from the repository root:

```sh
mkdir -p output/playwright
npx --package @playwright/cli playwright-cli -s=a2aviary goto http://127.0.0.1:4173
npx --package @playwright/cli playwright-cli -s=a2aviary run-code --filename=website/scripts/create-icons.js
node website/scripts/package-icons.mjs
```

Rebuild after generation. The intermediate icon PNGs stay in the ignored
`output/playwright/` directory; only the ICO and Apple touch PNG are delivered.

## Search, sharing, and missing pages

The canonical URL is `https://a2aviary.io/`, including when the same landing is
served at `/index.html`. Open Graph and explicit X metadata share the same copy
and image, use English (`en_US` for Open Graph), and credit `@carlos_olivera`.
The JSON-LD graph links the website, organization in development, Carlos Olivera Terrazas,
and Apache-licensed source repository. It deliberately contains no logo.

`public/robots.txt` allows crawling and discovers `public/sitemap.xml`, which
lists the canonical homepage, `/costs`, `/terms`, `/privacy`, `/refunds`, and `/pricing` with no speculative modification dates.
`public/404.html` is a standalone, noindex page with external CSS and a home
link; it needs neither JavaScript nor the Three.js scene. CloudFront source maps
origin 403 and 404 to this page with HTTP 404 and configured error-cache TTL
zero. S3-backed CloudFront errors have an effective minimum cache floor of one
second ([AWS error-cache guidance](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-expiration.html)).
Vite preview uses its own fallback and does not prove deployed 404 status.

With the rebuilt production preview running, verify search/share delivery and
the 404 layout in a browser:

```sh
npx --package @playwright/cli playwright-cli -s=a2aviary goto http://127.0.0.1:4173
npx --package @playwright/cli playwright-cli -s=a2aviary run-code --filename=website/scripts/verify-seo.js
```

This checks both homepage URLs, metadata/JSON-LD consistency, sitemap XML,
crawler discovery, browser icon decoding, the homepage under locally injected
production CSP, and desktop/mobile 404 behavior with JavaScript disabled.

## Release delivery

The landing includes a public repository CTA and discreet Carlos Olivera Terrazas attribution. Private S3/CloudFront delivery and GitHub OIDC deployment are defined in `infra/`; see [runbooks](../docs/runbooks.md) and [release evidence](../docs/release-verification.md). The proposed platform capabilities described in the landing are a vision, not a claim of implemented website generation.

The SEO additions are prepared and locally verified, not deployed. Infrastructure
and affected scripts require Carlos's current-head PR approval under
[repository policy](../docs/decisions/005-github-identity-and-policy.md).
For a separately authorized release, publish and verify the website assets,
including `/404.html` and `/404.css`, before applying the reviewed website-stack
CloudFront change. The website CI role cannot deploy infrastructure. Afterward,
verify a unique missing path returns HTTP 404 and the custom HTML body; check the
homepage, crawler files, icons, XML/ICO MIME types, and retained security/cache
headers. The deployment script verifies uploaded file checksums and MIME types;
it does not execute or verify the CloudFront configuration update. Actual social
platform previews remain unverified until observed.

## Cost transparency

`public/costs.json` is the supplied cost draft, also documented in the root
[COSTS.md](../COSTS.md). `src/costs-page.js` renders all rows and supplied totals
at build time; `scripts/costs-plugin.mjs` emits an extensionless `dist/costs`
HTML object. It serves directly at `/costs` on the private S3 REST origin,
without directory-index rewriting or infrastructure changes. The upload script
maps this exact key to `text/html; charset=utf-8`. Development renders the current
JSON; preview serves the built object with the same MIME type. Rebuild to update
preview or production content after editing the JSON.

The page uses local `public/costs.css`, no browser JavaScript, and no analytics or
tracking. Sources/statuses/notes remain as supplied, including the conflicting
domain confirmation note. Dollar amounts keep their precision, unknown amounts
remain unknown, and budgets/reservations are distinguished from spend. Totals are
supplied values, not a recomputed sum of all rows. The root Markdown and JSON
remain separate drafts; changing one does not synchronize the other.

With production preview running, verify the costs page under the production CSP
with and without JavaScript at desktop and mobile sizes:

```sh
npx --package @playwright/cli playwright-cli -s=a2aviary goto http://127.0.0.1:4173/costs
npx --package @playwright/cli playwright-cli -s=a2aviary run-code --filename=website/scripts/verify-costs.js
```

Asset checks include renderer escaping, precision, ranges, unknown values, source
links, and the sitemap. The service tests cover the extensionless upload MIME
mapping. Browser checks compare every row and supplied total to the served JSON,
check keyboard access/navigation, and reject third-party resource requests and
browser/network/CSP errors. Local preview verifies page rendering; production
S3/CloudFront delivery remains unverified until a separately authorized release.

## Public policies, pricing status, and contact

`src/policy-pages.js` contains the English policy and service-status content.
The Vite plugin emits exact extensionless `terms`, `privacy`, `refunds`, and
`pricing` HTML objects, using the existing `/costs` pattern. Development and
preview serve these routes for GET and HEAD. The uploader assigns HTML MIME
only to the explicit page keys; private S3 REST delivery needs no path rewrite.
`public/policies.css` is self-hosted, and the pages need no executable JavaScript.

The homepage contact block and shared page footer link to human support at
`hello@a2aviary.io`, separate from signed-agent processing. `/pricing` presents
Basic at $10/month · $100/year with the single status “Launching soon. Checkout
opens when payments are enabled.” and a native disabled “Coming soon” button.
The launch flow covers assistant-submitted kits, automated validation/build/
deployment/hosting of one basic marketing site, and automatic updates within
monthly AI-token and bandwidth credits. Credit amounts and subscription terms
will be published before checkout opens. Basic site production/hosting remains
coming soon; apps, MCP services, and plugins are coming later. Verified brief
analysis remains distinct. Existing cost-sheet figures are project costs.

Public copy is provider-neutral, with plan/credit/permission limits instead of
commissioned-work language. Prepared support forwarding and its pending owner
activation are documented in the [support runbook](../docs/runbooks.md#human-support-and-public-commercial-pages).

After building and starting the production preview, run:

```sh
node website/scripts/check-public-pages.mjs --built --origin http://127.0.0.1:4173
npx --package @playwright/cli playwright-cli -s=a2aviary goto http://127.0.0.1:4173
npx --package @playwright/cli playwright-cli -s=a2aviary run-code --filename=website/scripts/verify-public-pages.js
```

Repeat the HTTP check against the development origin without `--built`.
`npm run check` includes navigation, internal asset/anchor, sitemap, metadata,
JSON-LD reference, and MIME checks. Production artifacts are compared separately
so a preview fallback cannot stand in for the emitted objects. Browser checks
cover desktop/mobile, disabled/enabled JavaScript, keyboard access, contact and
policy navigation, production CSP injected locally, resource origins, and the
disabled pricing CTA under pointer/programmatic activation.
See [current dated evidence](verification.md#launch-copy-and-human-support--2026-10-05-local-verification)
and the [earlier public-page checks](verification.md#public-policies-and-contact--2026-10-05-local-verification).

Public delivery of this update remains pending owner review and a separately
authorized release. Support forwarding code is prepared, with no deployment or
real inbox/reply verification performed. Checkout, site production/hosting through
Basic, payment integration, and credit quantities remain future work.
