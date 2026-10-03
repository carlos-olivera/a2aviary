# Changelog

## 2026-10-03

- Prepared the project foundation for code and documentation.
- Selected Apache 2.0 for the first commit.
- Recorded the vision, proposed architecture, roadmap, and pending decisions.
- Defined the separation between the technical repository and the progress-tracking Space.
- Incorporated the digital agency vision from the current Space introduction; the initial pilot retains its web scope.
- Translated the initial documentation into English and established English as the canonical documentation language.
- Organized eight original brand PNGs under `brand/`, documented the concept's palette and typography, and verified byte-for-byte preservation with SHA-256 checksums. No editable vector sources were available at import.

- Added editable SVG reconstructions of the full logo, bird, and wordmark under `brand/logos/svg/`, with outlined lettering, transparent backgrounds, and exact charcoal/teal fills. Verified SVG structure, rendered contours (99.28–99.50% silhouette overlap; maximum two source pixels of contour distance), and preservation of all original PNG checksums.

- Added the runnable static project landing in `website/` with Vite, vanilla JavaScript, and Three.js: five extruded source-bird components, a 2.8-second entrance, restrained idle animation, and capped pointer rotation.
- Added keyboard pause, reduced-motion still rendering, visibility suspension, mobile rendering limits, and independent SVG fallbacks for loading, WebGL failure, and context loss.
- Preserved the original brand assets and checksums; added separate inverse variants, favicon, licensed local fonts, and a 1200 × 630 social-preview image.
- Verified reproducible installation and production build, four viewport sizes, motion controls, pointer behavior, touch emulation, source loading failure, and real graphics context loss in headed Chrome 154. Recorded screenshots, a short animation, and measured frame cadence with device details in [landing verification](website/verification.md).
- Recorded the accepted landing-only implementation decision and documented setup and deployment prerequisites. The follow-build CTA is omitted until a real public destination is supplied; no hosting or DNS was configured.

No agency API has been implemented, no pilot website has been generated, and no service has been published. The landing has a local production preview; deployment remains unverified.
