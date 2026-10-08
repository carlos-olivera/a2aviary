# 009 — Catalog generation and isolated client hosting

Date: 2026-10-06. Status: owner-approved Phase 3 architecture; implementation
verification and activation are recorded separately.

## Context

Phases 1 and 2 provide the structured contract, validators, authenticated human
subjects and role-scoped MCP transport. The owner requested approved-spec Astro
generation, secret-free Agents API verification, per-client PocketBase and
Railway hosting. Payments, tester enrollment, chat administration and external sites remain
outside this phase.

## Decision

Reuse the Phase 1 validators in an isolated generator package. Use only the
fixed catalog and pinned fonts/templates; reject unapproved variants and AI gap
activation. Bind approval, original prepared bytes, sources and built output by
SHA-256. Verify with a fixed build/browser script in the Agents API sandbox,
without secrets or model tools. Fail closed on missing/failed checks or altered
output. Keep source assets and reports in a bucket, not on volumes.

Persist owned specs, jobs, provider resource IDs and successful-change usage in
Postgres. Reserve the UTC monthly allowance under owner-scoped locks. Count only
successful application once; retain unknown deployment outcomes for manual,
audited reconciliation. Keep deployment confirmations separate from OAuth
consent and spec approval. Do not expose another client's sites to an admin.

Create a private Railway project for each client, with a single Caddy web
replica and single pinned PocketBase replica/volume. Fixture runs use a dedicated
project/environment. Apply service resource caps, preserve CMS content during
site changes, configure encrypted settings and off-volume scheduled backups.
Only approved CMS content routes and the client editor are proxied; the CMS
admin dashboard is not exposed. Custom domain configuration returns DNS/SSL
status without changing DNS. Existing AWS/platform resources are protected.

## Consequences

The initial catalog needs no generative CSS; adding a gap requires a reviewed
implementation before its flag can be enabled. Visual comparisons cover two
fixed viewport widths and empty CMS states, not every browser/live content state.
Authenticated submission and digest declarations do not establish a new signed
human-approval protocol. Unknown provider outcomes and remote backup recovery
need owner operations. Source protection includes generator packages; changing
the deployed AWS evaluator still requires separate authorization.

See [site operations](../sites.md) for configuration, exact accounting,
verification gates, limitations and manual steps.
