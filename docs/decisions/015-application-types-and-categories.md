# 015 — Application types, categories and starters

- Date: 2026-10-12
- Status: proposed
- Basis: Carlos Olivera Terrazas's explicit owner decisions of 2026-10-12; this docs-only record remains proposed until the owner merges it

## Context

Today [plans/web-simple.policy.json](../../plans/web-simple.policy.json) mixes the
commercial plan, the engine profile, the component contract and budgets. There
is one implicit product and no notion of category. The implemented draft flow
starts blank; it has no starter selection or immutable starter provenance.
Nothing is for sale; there is no live checkout or active Paddle merchant of record.

[007](007-pilot-policy-and-site-contracts.md) establishes the versioned plan and
bounded changes; [009](009-catalog-generation-and-client-hosting.md) establishes
Astro, PocketBase, verification and isolated hosting. [013](013-server-drafts-and-preview.md)
replaces initial intake with drafts, verified snapshots and browser approval.
[014](014-component-library.md) and the [library guide](../../library/README.md)
establish shared, reviewed packages and server-owned experimental gating.
The [site workflow](../sites.md) and [release evidence](../release-verification.md)
describe implementation and observed operation separately.

### Conflicts and boundaries with earlier records

- **Policy ownership:** 007 and the current policy combine plan limits and catalog
  rules. This decision separates their responsibilities for future refactoring;
  it does not change numerical limits, policy versions or frozen contracts here.
- **Preview and live edits:** 013 defers draft-based changes, makes `change.request`
  unavailable and prohibits initial drafts from redeploying live sites. Its
  current preview path performs full verification. This decision replaces that
  deferred change-request direction with live editing through the same draft
  flow and adds a separate quick render level. Neither capability is implemented
  by this record. Full verification before browser approval and exact approved-byte
  deployment remain required.
- **Genericity and legacy defaults:** 014's generic package rule continues. The
  current library also preserves legacy English shell bytes and font/token
  defaults for compatibility. Those existing behaviors do not meet the new rule
  that the client's agent supplies every value. A later legacy-cleanup PR must
  resolve that gap without rewriting historical evidence or approved artifacts.
- **Experimental status:** existing stable packages recorded in 014 remain
  historical facts. Every new package and starter begins experimental; this
  decision does not relabel existing stable packages or claim starter gating
  already exists.

## Decision

### Four separate axes

1. **App kind (`kind`) is the runtime.** Only `website` exists: a static Astro
   site plus PocketBase CMS. A new kind requires its own ADR. A store with
   checkout would need a backend and payments that the current plan excludes.
2. **Category equals starter.** A starter is a data-only starting point for a
   site. It is not a validator and has no code.
3. **Catalog is shared packages in `library/`.** Packages follow ADR 014. Safety
   and quality come from the catalog, plan limits and verification, never from
   the category.
4. **Plan is one single plan for every website category.** Categories never
   change limits or price. This does not establish a commercial price or offer.

| Axis | Who owns what | How it changes |
| --- | --- | --- |
| Kind | Core code owns the runtime; `website` is the only kind | Code plus its own ADR for a new kind |
| Starter / category | Reviewed data owns the initial composition and agent guidance | Data plus a reviewed PR; new versions affect only newly created sites |
| Catalog | Shared `library/` packages own supported content and presentation per ADR 014 | Reviewed library packages under ADR 014, with experimental gating and owner promotion |
| Plan | The owner owns the shared website limits and commercial terms | Owner approval; a category cannot override them |

### Starter semantics and provenance

A starter is applied **once**, when the draft is created. It seeds pages,
sections and blocks and selects packages as a copy. There is no live link;
later starter versions never modify existing sites. After creation it only
produces **suggestions**, never blockers. Blockers come only from the catalog
and the plan; required verification and human approval remain workflow gates.

Customization is unlimited within the catalog and plan: content, tokens, fonts,
motion, variants, effects, sections and pages. A heavily customized site is
effectively free composition. This does not admit arbitrary client code or remove
catalog compatibility, completeness, budgets or verification requirements.

A site may also start blank, with no starter; this is current behavior. Each
site records `starter_id` and `starter_version`, or none, as **immutable
provenance**. The category describes that original starter, not the site's
current appearance. **A site cannot change category.** To use another starter,
create a new site. A blank start retains absent starter provenance; attaching a
starter later would also require a new site. Customizing or replacing the copied
structure does not change provenance.

### Every value comes from the client's agent

The client's agent supplies every value. Starters and packages never ship
default copy, palettes or fonts in any language; the existing genericity rule
stays. a2aviary does not generate content. A starter may describe **what to ask
the human** and **design intent** in English for the agent, never site copy.
Package selection and empty structural props are starter data, not permission
to fill missing values with a2aviary-generated content. Missing required values
remain catalog/plan completeness blockers for full verification and approval.

### Two preview levels

- A fast **render preview** is for iteration: unverified and non-approvable. It
  cannot establish a verified snapshot, human approval or deployment authority.
- The existing **full verification** is required before browser approval. The
  approved snapshot binds the exact verified artifact; deployment uses those
  stored bytes without rebuilding, as in ADR 013.

### Editing a live site is core

Changes to a deployed site go through the same **draft → verified snapshot →
browser approval → deploy** flow. This replaces the unavailable `change.request`
design. A quick render may assist iteration but never bypasses full verification
or browser approval. Existing CMS editing remains separately documented; this
record does not change its behavior or the plan's accounting limits.

### Experimental phase

Every starter, like every new package, is `experimental` and available only to
server-classified tester sites until the owner promotes it. Client input or a
starter choice cannot assert tester classification. Promoting a starter does
not implicitly promote its selected experimental packages; catalog gating still
applies. No starter availability or promotion is claimed by this docs-only PR.

### Not doing

- Plugin systems or dynamic loading.
- A generator per category or conditional code per starter (`if (starter === …)`).
- Starter inheritance or category-specific hard rules.
- A generic multi-kind framework before a second kind exists.
- Extra provider abstractions beyond `SiteDeployer`, `BuildVerifier` and `ObjectStore`.
- Checkout.

### Non-normative starter example

This fictional `profile` document illustrates data and English agent guidance,
not an approved starter, schema, valid complete site spec or implementation
contract. Package IDs refer to existing library entries for illustration. Empty
props intentionally contain no copy, palette or font values; the agent must
supply all required inputs. The experimental profile packages remain tester-only.

```json
{
  "id": "profile",
  "version": "0.1.0",
  "status": "experimental",
  "kind": "website",
  "packages": ["profile-card", "profile-card:flip-3d", "rich-text", "rich-text:standard"],
  "seeded_structure": {
    "pages": [
      {
        "id": "page-1",
        "props": {},
        "sections": [
          {
            "id": "section-1",
            "props": {},
            "blocks": [
              {
                "id": "block-1",
                "component": "profile-card",
                "variant": "flip-3d",
                "props": {}
              },
              {
                "id": "block-2",
                "component": "rich-text",
                "variant": "standard",
                "props": {}
              }
            ]
          }
        ]
      }
    ]
  },
  "agent_inputs": [
    "Ask the human which identity, role, links and optional contact or image to present.",
    "Ask for site language, all site and accessible control copy, navigation and metadata.",
    "Ask for palette, typography, spacing, layout and motion choices within catalog and plan limits."
  ],
  "design_intent": [
    "Give identity and relevant links a clear reading order.",
    "Keep all meaningful content readable with motion disabled and without JavaScript."
  ],
  "suggestions": [
    "Consider adding a supporting section if the human wants more context.",
    "Consider a different catalog composition when it better serves the human's goal."
  ]
}
```

## Consequences

Every later PR must preserve the four axes and the starter's copy-on-create
semantics. A category cannot introduce code, alternate limits, prices, validators
or permanent composition requirements. Site provenance survives free composition;
another starter requires another site. Starter revisions remain reviewable data
changes, while catalog and kind changes keep their own code and verification
responsibilities. Plan changes still require owner approval.

Client agents must collect complete values instead of relying on defaults.
Quick rendering makes iteration possible without claiming verification; live
editing reuses the verified snapshot and human approval boundary. Existing
package status, immutable approved artifacts and historical evidence must be
preserved during the subsequent work.

### Implementation sequence (prompts 3–7)

Each step is a separate, independently reviewable PR with relevant checks and
observed evidence. This sequence records future work, not implementation or
deployment authorization from this docs-only delivery.

| Prompt | Delivery | Boundary |
| --- | --- | --- |
| 3 | Structure refactor | Separate kind/runtime, catalog contracts/budgets and the shared plan without category-dependent behavior |
| 4 | Legacy cleanup | Resolve obsolete mixed ownership, defaults and change-request paths while preserving historical evidence and exact approved artifacts |
| 5 | Starters | Add reviewed data, one-time copying, immutable provenance, optional blank creation and server-owned experimental gating |
| 6 | Quick preview | Add an explicitly unverified, non-approvable render path; retain full verification before browser approval |
| 7 | Live edits | Reuse draft → verified snapshot → browser approval → deploy for deployed sites, subject to the shared catalog and plan |

### Open points for later

- Starter names beyond `profile`.
- Whether blank start remains available to clients once starters are stable.

This PR changes documentation only: no source, migration, policy, contract,
provider configuration or operational status changes. Owner merge is required
before the ADR status becomes accepted; subsequent implementation and deployment
remain separately reviewable and authorized.
