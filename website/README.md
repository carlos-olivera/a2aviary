# a2aviary landing page

A static introduction to a project in development. The agency runtime, API,
pilot workflow, and deployment are not implemented by this website.

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
`public/favicon.svg` derives from the inverse bird. `public/social-preview.png`
is a 1200 × 630 browser render of this landing's settled Three.js composition.
No source PNG or SVG was overwritten.

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
derived contours, bundled license files, and social image dimensions.

## Deployment preparation: a2aviary.io

The chosen domain is a target, not a verified live deployment. No hosting
provider, deployment credentials, remote repository, or DNS access is configured
in this repository. These are the missing prerequisites; obtain them before
publishing. This implementation does not create a hosting account or publish.

On the chosen static host:

1. Use `website/` as the project directory, run `npm ci` and `npm run build`, and
   publish the contents of `website/dist/` (or `dist/` relative to that directory).
2. Serve at the domain root with HTTPS, correct MIME types, and the provided
   `index.html`. No SPA rewrite, server function, or database is needed.
3. Add `a2aviary.io` as the custom domain. Apply only the DNS records supplied by
   that host; no host-specific records have been invented here.
4. Cache hashed files under `/assets/` for a year with `immutable`; revalidate
   `index.html` and unhashed public assets when deploying updates.
5. Verify the domain, TLS, font/SVG/JS requests, favicon, and
   `/social-preview.png` from the public origin. The Open Graph image URL is
   prepared for `https://a2aviary.io/social-preview.png` and becomes usable only
   when deployment and DNS are working.

For a preview on another origin, update the absolute Open Graph image URL before
sharing it. The site currently targets root hosting, not a repository subpath.
The follow-build link is intentionally omitted: no verified public repository
or social profile was supplied. Add the exact label `Follow the build →` only
after verifying a real destination.
