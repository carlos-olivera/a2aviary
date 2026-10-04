# 001: Static project landing page

- Date: 2026-10-03
- Status: Accepted for the landing page only
- Basis: User-approved landing implementation plan and attached requirements

## Context

The project needs a concise public introduction before its first repository
publication. Existing local Git history contains two commits. The agency is
still in design; a working landing page must not imply an operational agency.

## Decision

Build the landing in `website/` with Vite, vanilla JavaScript, and Three.js.
Use the reconstructed circuit-bird SVG as the source for actual extruded mesh
geometry, keeping the originals and their provenance. Use the specified
charcoal/teal exploration and exact introductory English copy for this page.

Provide keyboard pause, reduced-motion behavior, and independent static SVG
fallbacks. Self-host fonts and retain dependency licenses. Omit the follow-build
link until a real public destination is verified. Prepare a root-hosted build
for `a2aviary.io` without selecting infrastructure or deploying it.

Include the landing and required assets/documentation in the next local commit
before first publication. Preserve the existing history and unrelated changes.

## Consequences

The repository gains a runnable static introduction, not an agency runtime,
API, or pilot delivery. JavaScript and Vite are choices for this website only;
the agency's language, runtime, infrastructure, and A2A standard remain open.
The site's identity treatment does not establish a globally approved logo or
brand palette. Hosting, DNS access, and a public follow-build URL remain missing.

See [setup and deployment](../../website/README.md) and
[verification evidence](../../website/verification.md).

## Subsequent release decision

The original landing-only decision above preceded the accepted initial operating plan. Records [002](002-serverless-foundation.md)–[005](005-github-identity-and-policy.md) select infrastructure/runtime and add a public CTA and operating foundation. The external A2A standard remains open. Actual deployment and verification are recorded separately.
