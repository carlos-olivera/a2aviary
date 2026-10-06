# Project decisions

## Confirmed

| Decision | Date | Basis |
| --- | --- | --- |
| Name a2aviary and domain a2aviary.io | 2026-10-03 | User's choice |
| Code, architecture, and documentation in one repository | 2026-10-03 | Directory selected by the user |
| Open source from the first commit | 2026-10-03 | User's instruction |
| Apache 2.0 license | 2026-10-03 | User's explicit choice |
| Share progress through building in public | 2026-10-03 | User's instruction |
| Digital agency vision for websites, applications, and services; first pilot focused on a website | 2026-10-03 | Current a2aviary Space introduction |
| English as the canonical language for project documentation | 2026-10-03 | User's instruction |
| Software-platform framing for agent-to-agent digital work; “agency” as branding/metaphor; websites first, other capabilities coming later | 2026-10-05 | Owner's approved website implementation plan |
| Basic launch presentation at $10/month · $100/year, automated site-kit flow, provider-neutral public copy, and isolated human-support forwarding preparation | 2026-10-05 | Owner’s explicit implementation request; delivery and deployment remain separate |

The 2026-10-05 framing clarifies the earlier agency vision; it does not establish live website production or a commercial catalog.

The 2026-10-06 owner-approved pilot supersedes earlier credit-based website plans: client-prepared, human-approved structured specs; fixed Astro components; bounded monthly changes. Phase 1 contracts are local work, not website production. See [007](007-pilot-policy-and-site-contracts.md) and [plans](../plans.md).

## Design direction from the recap

The client agent acts as the interface, materials are prepared on the client's side, state is persistent, autonomy operates within a mandate, and work continues asynchronously. Skill plus API and the Teco pilot are the documented starting point; their operational specifications are not finalized.

## Unapproved proposals

- Geometric flock symbol, lowercase wordmark, and jade, ivory, and coral palette.
- Two posts per week, adjustable to actual progress.
- Commercial operation and support commitments beyond future licensed platform access.
- Basic credit quantities, subscription conditions, and sales readiness remain open. The approved launch presentation above does not enable checkout or establish website production/hosting.

## Open questions

- Teco scope, budget, materials, and acceptance criteria.
- A2A standard and minimum client agent capabilities.
- Identity provider and legal scope of the mandate, KYC, and signatures.
- Ownership and permissions for client deliverables.
- Commercial pricing and maintenance beyond the initial operating limits.
- External partner onboarding and long-term support commitments.

## Recording new decisions

Create a numbered document with a title, date, status, context, decision, and consequences when a choice affects implementation. Do not promote a proposal to a decision without evidence of acceptance.

## Accepted release records

- [001 — Landing page](001-landing-page.md)
- [002 — AWS serverless foundation](002-serverless-foundation.md)
- [003 — Signed email and durable processing](003-email-and-durable-processing.md)
- [004 — Agents API and operating limits](004-openai-runtime-and-limits.md)
- [005 — GitHub identity and trusted policy](005-github-identity-and-policy.md)
- [006 — Human-support forwarding](006-human-support-forwarding.md)

These decisions were accepted in the initial-release implementation plan. Acceptance is distinct from deployment and verification; see [release evidence](../release-verification.md).

## Accepted pilot direction

- [007 — Pilot policy and site contracts](007-pilot-policy-and-site-contracts.md) — owner-approved pilot direction; initial limits await PR review, integration is future work.
