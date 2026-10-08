# 008 — Discovery platform auth, MCP and roles

Date: 2026-10-06. Status: Platform direction accepted by Carlos Olivera Terrazas
in the Phase 2 implementation request; implemented, merged and deployed on
Railway (owner-reported, 2026-10-06; see [release verification](../release-verification.md)).
Google sign-in is the live identity provider; the registry bridge remains manual.

## Context

The owner selected one Railway Node/TypeScript service, Better Auth OAuth 2.1,
MCP 2026-07-28, official server v2, human-bound ES256 keys and role-scoped tools.
Phase 1 supplies immutable policy contracts. Existing AWS signed-email grants
remain owner-controlled; an authenticated connector must not silently enroll or
expand them. Site generation/deployment and payments are outside this phase.

## Decision

Implement an isolated discovery service with Postgres migrations and only login
and consent web pages. Compose Better Auth jwt/mcp/cimd once; mcp includes the
OAuth provider. Use the bundled Node CIMD transport and July 2026 profile. DCR
is explicitly off by default. Use S256 authorization-code and refresh grants,
resource-bound five-minute access tokens and requireMcpAuth. Serve strict POST
MCP with createMcpHandler and legacy rejection.

Use verified Google identity as the initial login implementation. Resolve the
owner from private configuration, invited admins and allowlisted testers; all
other verified users are clients. Load roles live and filter both advertised
and callable tools. Require explicit confirmation arguments for admin/key writes
and private audit reads. Audit privileged mutations in the same DB transaction.
No admin web UI, policy mutation or paid/free plan activation is introduced.

Register only public ES256 keys bound to the caller, with thumbprint uniqueness
and audited revocation. Preserve the DynamoDB registry without automatic writes.
Document individually approved owner enrollment and separate email revocation;
connector consent is a discovery mandate, not an email/website mandate.

## Consequences

The service can be built and exercised locally; credentials, Railway settings,
DNS, external Google OAuth and actual ChatGPT/Claude compatibility still require
owner activation and evidence. Legacy OAuth DCR does not make legacy MCP traffic
compatible. Real older clients require a separate reviewed protocol decision.
JWT access tokens can survive OAuth revocation until expiry; roles are live.
Spec/preview fidelity, human-bound website approval, PocketBase, production,
monthly usage accounting and payments remain later responsibilities.

Read [platform operations](../platform.md) and [release verification](../release-verification.md).
New sensitive-path source protection does not activate the deployed evaluator.
Existing public website copy, AWS transport and historical evidence are retained.
