# Presentation batch: sanitized local evidence

These three compositions have equal status as fictional test inputs. They are
not customer templates, defaults, approved branding or deployed sites. Images
contain an original generated fictional sculpture; links use example.com and
contacts are fictional. No credentials, client records, user accounts, hosted
resource identifiers or private logs are included.

The source implementation is policy 2.2.0 / contract 2.2 / generator 2.3.0.
[Fixture provenance](../../../packages/generator/test/fixtures/presentation/README.md)
and [authoring contracts](../../../library/README.md#contract-22-amendment) describe
content and runtime boundaries. The raw local evidence is retained in ignored
`.local/presentation-check/` and `.local/presentation-verifier/`.

## Full local verifier

All three real Astro builds pass all ten configured verifier checks. Each has
zero axe violations, no broken links, zero running animations under reduced
motion at 390/1280px and zero external requests. Lighthouse's configured categories
are accessibility and best practices; performance and SEO scores are not measured
by this checker. The [structured summary](verifier-summary.json) preserves actual
source/output hashes and check details.

| Composition | HTML bytes / gzip | CSS bytes / gzip | JS bytes / gzip | WOFF2 bytes / gzip | Lighthouse accessibility / best practices |
| --- | ---: | ---: | ---: | ---: | ---: |
| dark-en | 4,139 / 1,671 | 10,486 / 2,322 | 6,447 / 2,389 | 71,060 / 71,137 | 100 / 100 |
| light-es | 4,220 / 1,725 | 10,095 / 2,280 | 6,447 / 2,389 | 47,484 / 47,515 | 100 / 100 |
| contrast-es | 4,220 / 1,725 | 9,895 / 2,181 | 6,447 / 2,389 | 0 / 0 | 100 / 100 |

Resource counts are full built output: HTML includes authored home and 404; JS
includes `site.js` plus existing `cms.js`. Gzip uses level 9 independently per file;
these are measurements, not negotiated production transfer sizes. Each reference
includes a 10,420-byte fictional WebP, separately from the table. Font gzip can be
slightly larger than WOFF2. Licenses are included in generated output separately.

## Package measurements

All entries below are 1.0.0, experimental. CSS measurements are raw/gzip; behaviors
are minified/gzip under the existing compiler budget method. Aggregate generated
JS includes the reviewed core loader. Metadata is not executable browser payload.

| Package | Bytes / gzip, unless otherwise noted |
| --- | ---: |
| `aurora` | 1,104 / 412 |
| `copy-text` | 489 / 232 |
| `flip` | 884 / 277 |
| `glow-border` | 1,010 / 398 |
| `jetbrains-mono` | 21,168 WOFF2 bytes |
| `profile-card` | Content metadata only |
| `profile-card:flip-3d` | 2,889 / 776 |
| `reveal` | 530 / 256 |
| `shimmer` | 984 / 418 |
| `space-grotesk` | 26,228 WOFF2 bytes |
| `steps:timeline` | 843 / 386 |
| `tilt` | 557 / 282 |

## Sanitized captures

Full-page browser captures were inspected for visible content, wrapping and focus.
Mobile front/back use reduced motion; desktop front uses normal motion. The full
24 reference capture matrix stays in `.local/presentation-check/`.

| Palette | Mobile front | Mobile back | Desktop front |
| --- | --- | --- | --- |
| dark-en | [390px front](dark-en-390-reduce-front.png) | [390px back](dark-en-390-reduce-back.png) | [1280px front](dark-en-1280-no-preference-front.png) |
| light-es | [390px front](light-es-390-reduce-front.png) | [390px back](light-es-390-reduce-back.png) | [1280px front](light-es-1280-no-preference-front.png) |
| contrast-es | [390px front](contrast-es-390-reduce-front.png) | [390px back](contrast-es-390-reduce-back.png) | [1280px front](contrast-es-1280-no-preference-front.png) |

## Genericity and limits

Each non-font package appears in all three compositions. Reference font choices
are Space Grotesk/Inter/JetBrains Mono, EB Garamond/Inter/system mono, and system
fonts only. The expanded browser matrix also runs both new fonts and system-only
controls across every palette, width and motion preference. Minimum/maximum
content, optional image/contact combinations, front/back states and hover/focus
are test cases. Package files contain no owner names, contact addresses, site
palettes or fixture copy outside explicitly named test fixtures.

No-JS rendering is inspected with browser scripting disabled. Axe then audits the
same serialized static DOM in a scripting-capable harness so axe's own async
runtime can execute; application scripts are removed from that static snapshot.
Clipboard success uses native local Chromium permissions; denial/unavailability
and out-of-order completion use explicit test doubles. Unsupported scroll CSS is
exercised by removing its conditional enhancement rules. Local MCP uses actual
draft tools and image upload with isolated loopback Postgres; provider build and
deploy boundaries are doubles there, while the verifier above runs real Astro,
axe, Lighthouse and Chromium. No hosted run, production change or deployment is
claimed by these results.
