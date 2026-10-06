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
