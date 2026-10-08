# a2aviary discovery platform

Prepared Railway service; not deployed. Node.js 22, TypeScript, Better Auth
OAuth 2.1/CIMD, official MCP v2, Postgres roles/audits and human-bound public keys.
Only login and consent have web pages. No site production or payments.

Use [platform setup and connection guide](../../docs/platform.md) for endpoints,
private variables, role tools, compatibility and the signed-email registry bridge.
The [decision](../../docs/decisions/008-platform-auth-and-mcp.md) records the boundary.

From this directory, with Node.js 22.23.3 and Docker available:

```sh
npm ci
docker compose up -d --wait
cp .env.example .env
# Set private Google credentials, a random secret and the owner email in .env.
npm run migrate
npm run dev
```

Local Google callback: `http://localhost:3000/api/auth/callback/google`.
Tests use fictional verified users inserted into isolated Postgres schemas;
they do not authenticate with Google or enroll real email partners.

```sh
npm run check
npm run build
npm test
```

`npm test` requires the local compose database. Optional `TEST_DATABASE_URL`
must address a loopback database whose name starts with `a2aviary_platform`.
Tests create/drop only their random schemas. They refuse a remote database.
Stop the local database with `docker compose down`; preserve its named volume.
Build a container from the repository root:

```sh
docker build -f apps/platform/Dockerfile -t a2aviary-platform:local .
```

Existing GitHub CI remains scoped to the AWS services, website and infrastructure.
The platform/Postgres suite must be run separately before publication; CI wiring
requires a later reviewed workflow change with appropriate owner authorization.
No Operator App permission expansion is included.

Project code is Apache 2.0; [dependency notices](THIRD_PARTY.md) remain intact.

Phase 4 tester enrollment and chat-only superadmin tools are described in
[test operations](../../docs/testers-and-admin.md). Migration 005 is required;
fixture site cleanup needs narrowly scoped provider delete/list permissions.

## Initial-site drafts (current source)

Both `SITE_WORKFLOW_ENABLED=true` and default-false `SITE_DRAFTS_ENABLED=true` are required. Policy 2.0.0 replaces client preview intake with revisioned drafts, shared raw uploads, isolated normalization, server snapshots and scoped browser approval before exact-byte deployment. `site.build` and `/api/site-specs` are removed; `change.request` returns `change_requests_unavailable`. Read [current operations](../../docs/sites.md) and [release evidence](../../docs/release-verification.md). All seven migration names/hashes must match; production 006 reconciliation is unresolved. Run `npm run test:browser` for the real local browser check and the separately authorized one-shot hosted runner only with fixture overrides and a disposable local database.
