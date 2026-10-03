# Landing verification

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

No public follow-build destination is configured, so the CTA is omitted.
Hosting provider/access, remote repository, domain DNS access, and HTTPS setup
remain required before publishing. No site was deployed or remote URL claimed.
