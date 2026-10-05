# a2aviary brand assets

This folder preserves the visual resources generated in the ChatGPT conversation
“Crear logo vectorial” and imported on 2026-10-03. a2aviary is Carlos Olivera Terrazas's
open source project, developed through build in public. Its visual direction is
technical, modular, and welcoming to developers and contributors.

These resources document an identity exploration; importing them does not mark
the logo, palette, or typography as approved. See the earlier
[visual identity exploration](../docs/brand.md) for the project's context.

## Structure

```text
brand/
  readme.md
  manifest.json
  logos/
    a2aviary-logo-original.png
    a2aviary-logo-transparent.png
    a2aviary-bird.png
    a2aviary-wordmark.png
    svg/
      a2aviary-logo.svg
      a2aviary-bird.svg
      a2aviary-wordmark.svg
  blueprints/
    a2aviary-bird-blueprint.png
    a2aviary-wordmark-blueprint.png
    a2aviary-logo-blueprint.png
  guidelines/
    a2aviary-brand-guidelines.png
```

All filenames use lowercase ASCII characters and hyphens. `readme.md` is the
folder's README, named in lowercase to follow that convention.

## Resource inventory

| Resource | File | Dimensions | Contents |
| --- | --- | --- | --- |
| Initial logo | [Original logo](logos/a2aviary-logo-original.png) | 1448 × 1086 px | Initial bird-and-wordmark presentation; retained alongside the later export. |
| Full logo | [Transparent logo](logos/a2aviary-logo-transparent.png) | 2172 × 724 px | Bird and lowercase a2aviary wordmark on a transparent canvas. |
| Bird / icon | [Bird](logos/a2aviary-bird.png) | 1254 × 1254 px | Standalone geometric bird with circuit-like wings and nodes, with transparency. |
| Wordmark | [Wordmark](logos/a2aviary-wordmark.png) | 2172 × 724 px | Lowercase a2aviary lettering with an accent-colored 2, with transparency. |
| Brand guidelines | [Visual guide](guidelines/a2aviary-brand-guidelines.png) | 1448 × 1086 px | Concept, palette, typography, style, usage examples, and clear space. |
| Bird blueprint | [Bird blueprint](blueprints/a2aviary-bird-blueprint.png) | 1448 × 1086 px | Icon geometry, construction, proportions, and clear space. |
| Wordmark blueprint | [Wordmark blueprint](blueprints/a2aviary-wordmark-blueprint.png) | 1448 × 1086 px | Letter geometry, baseline, spacing, kerning, and safe area. |
| Full-logo blueprint | [Logo blueprint](blueprints/a2aviary-logo-blueprint.png) | 1448 × 1086 px | Combined lockup, icon-to-wordmark spacing, alignment, and proportions. |

## Color references

The following values are transcribed from the imported visual guide. They belong
to this concept and are distinct from the earlier proposed palette in
`docs/brand.md`.

| Color | Hex | Reference use |
| --- | --- | --- |
| Deep Charcoal | `#0B1220` | Primary brand color and dark lettering. |
| Graphite | `#111827` | Supporting neutral. |
| Neon Teal | `#14F1C8` | Primary accent. |
| Aqua Mint | `#63F5D5` | Secondary accent. |
| Soft Cloud | `#F5F7FA` | Light backgrounds. |

These are reference labels, not sampled pixel values. Generated PNGs include
shading and edge artifacts, so their pixels need not match the hex values exactly.

## Typography references

| Typeface | Role shown in the guide |
| --- | --- |
| Space Grotesk | Headings and key messages. |
| Inter | Body text and user interfaces. |
| JetBrains Mono | Code, data, and technical accents. |

These are typography references, not proof that the generated wordmark was set
in any of these fonts. No font files are bundled. Preserve the relevant font
licenses and attribution if font files are added later.

## Usage and blueprint notes

- Keep the bird, lettering, aspect ratio, and colors consistent with the concept.
- Use the full logo for identification and the bird alone for compact contexts
  such as an avatar or favicon, after checking legibility at the intended size.
- Prefer clean layouts, generous whitespace, modular composition, and concise
  technical messaging. The guide's themes include autonomy, agent coordination,
  open source, and build in public.
- The visual guide specifies clear space equal to the height of the letter “a”,
  and a full-logo minimum width of 80 px for digital use or 25 mm in print.
- The blueprints contain inconsistent measurements: the full-logo sheet states
  32 px / 8 mm, and the icon sheet uses a separate half-X clear-space reference.
  Treat the sheets as illustrations pending validation, and use the visual
  guide's larger minimum as a provisional reference.
- Some sheets display “2024”; this is text in the generated artwork. The actual
  import date is 2026-10-03.

## Originals and editable sources

All eight PNGs are copied byte for byte from the downloaded originals. They have
not been cropped, resized, recompressed, or retouched. The
[manifest](manifest.json) records original download filenames, dimensions, byte
sizes, and SHA-256 checksums for integrity verification.

The conversation supplied PNGs, with no original editable vector master.
On 2026-10-03, editable SVGs were reconstructed directly from the corresponding
transparent PNG contours at the user's request. These are later reconstructions,
not original vector masters; their provenance and verification are recorded
separately in `vector_reconstructions` in the [manifest](manifest.json).

| Editable vector | PNG reference | ViewBox | Paths |
| --- | --- | --- | --- |
| [Full logo](logos/svg/a2aviary-logo.svg) | `a2aviary-logo-transparent.png` | `0 0 1923 456` | 14 |
| [Bird / icon](logos/svg/a2aviary-bird.svg) | `a2aviary-bird.png` | `0 0 1122 740` | 5 |
| [Wordmark](logos/svg/a2aviary-wordmark.svg) | `a2aviary-wordmark.png` | `0 0 1709 377` | 9 |

All three SVGs contain named, editable closed paths, with transparent backgrounds,
outlined lettering, and no embedded raster images or font dependencies. The
viewBox crops only the original blank canvas, leaving two source-pixel units of
padding. Letter spacing, relative placement, curves, and transparent counters
follow each PNG independently; the standalone exports are not substituted into
the full lockup.

The paths use exact solid Deep Charcoal `#0B1220` and Neon Teal `#14F1C8`, as
requested. Graphite `#111827` remains a supporting palette color. Raster shading
is normalized to these exact fills; the original PNG shading remains in the
preserved imports. This is a contour reconstruction, not a pixel-identical copy
of the PNG gradients or antialiasing.

Verification used a 50% alpha cutoff on the originals, separated the dark and
teal silhouettes, and compared them with SVG renders at the original crop
resolution. Color-specific silhouette intersection-over-union is 99.28–99.50%
across the three files. The 95th-percentile contour distance is one source pixel;
maximum contour distance is two source pixels. Side-by-side renders were also
visually inspected. All eight original PNG SHA-256 checksums still match the
import manifest.

## Landing page derivations

The [project landing page](../website/README.md) uses the circuit-bird exploration
for a real Three.js sculpture. Its public assets contain a byte-identical bird
SVG plus separate inverse logo and bird variants. Inverse variants replace dark
fills with Soft Cloud and preserve teal, path geometry, and spacing. The favicon
uses the inverse bird; the social preview is a browser render of the settled 3D
scene. Original assets and manifest checksums remain unchanged. This treatment
applies to the landing and does not approve a global visual identity.

## Open source and licensing

The project is open source under the repository's
[Apache License 2.0](../LICENSE). This folder preserves the project's brand
resources for collaboration and review. The repository already treats
permissions to use the name and logo separately from code licensing; no separate
brand-use policy has been established here. Third-party fonts and assets retain
their own licenses. See the [project README](../README.md#license).
