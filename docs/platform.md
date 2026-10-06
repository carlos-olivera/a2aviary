# Discovery platform: auth, MCP and roles

Status: Phase 2 source verified locally; Carlos reported Railway deployment on
2026-10-06. Public health, OAuth discovery and login responses were observed.
Chrome reproduced a native login form failure (`Origin: null`, HTTP 403); the
referrer-policy repair is verified locally and awaits owner review/redeployment.
External Google authentication and real ChatGPT/Claude tool calls remain
unverified. No site submission, production,
plan activation, payment, PocketBase provisioning or authenticated site-approval
binding is enabled. The AWS signed-email v1 workers remain unchanged.

## Package and identity choices

[apps/platform](../apps/platform/README.md) pins Better Auth and its MCP, OAuth
provider and CIMD packages to 1.7.7, official `@modelcontextprotocol/server` to
2.3.1, and Node.js to 22.23.3. `mcp()` already composes the OAuth provider; the
service registers it once, alongside `jwt()` and CIMD with
`metadataProfile: "mcp-2026-07-28"`. The bundled Node CIMD fetch transport rejects
special-use addresses, pins resolved DNS and refuses redirects. No unrestricted
metadata-fetch wrapper is substituted. See [Better Auth MCP](https://better-auth.com/docs/plugins/mcp)
and [CIMD](https://better-auth.com/docs/plugins/cimd).

Verified Google sign-in is the implementation default. It keeps the only pages
at login and consent and prevents an unverified email claim from bootstrapping
an owner or invited admin. Password signup and account linking are disabled.
The owner must privately set PLATFORM_SUPERADMIN_EMAIL to the exact approved
owner identity; no default, public example or application code embeds it.
Changing identity providers requires a reviewed implementation and verified
identity semantics.

## Endpoints

The production default accepts only `https://mcp.a2aviary.io`, with resource
`https://mcp.a2aviary.io/mcp`. Alternate staging deployments require an explicit
`PLATFORM_ALLOWED_ORIGINS` allowlist. Bare HTTP loopback origins are allowed locally.
The server constructs URLs from configuration, ignoring Host/proxy URL overrides.

| Endpoint | Purpose |
| --- | --- |
| `POST /mcp` | Strict MCP 2026-07-28; all tools behind requireMcpAuth |
| `GET /healthz` | DB connectivity and required migration records; no private data |
| `GET/POST /sign-in` | Server-rendered Google login; signed OAuth query continuation |
| `GET/POST /consent` | Verified session, client/scopes/identity claims, plan summary and discovery-only mandate |
| `GET /.well-known/oauth-authorization-server/api/auth` | RFC 8414 metadata for issuer `https://mcp.a2aviary.io/api/auth` |
| `GET /api/auth/.well-known/oauth-authorization-server` | Issuer-relative discovery alias |
| `GET /.well-known/oauth-protected-resource/mcp` | RFC 9728 resource metadata |
| `GET /.well-known/oauth-protected-resource` | Protected-resource discovery alias |
| `GET /api/auth/jwks` | OAuth signing public keys; distinct from agent public keys |
| `GET /api/auth/oauth2/authorize`, `POST /api/auth/oauth2/token` | Provider-managed authorization-code/refresh flow |
| `/api/auth/oauth2/userinfo`, `/api/auth/oauth2/revoke`, `/api/auth/oauth2/introspect` | Provider-managed identity, token revocation and introspection |
| `/api/auth/callback/google` | Google callback; register this exact URL privately |
| `POST /api/auth/oauth2/register` | DCR unavailable by default; explicit flag opt-in |

OAuth supports authorization code + S256 PKCE and refresh tokens, not
client-credentials grants. Access tokens last five minutes. requireMcpAuth checks
signature, issuer, resource audience, expiry and `mcp:tools` scope. Every accepted
human subject must still exist with verified email; live DB/config role checks
control visibility and action authorization. Client-supplied role/email claims
and tool arguments cannot grant a role. Tokens may contain both MCP and OIDC
UserInfo audiences when identity scopes are requested; the MCP audience must
still be present. Refresh/revoke behavior is provider-managed. Local JWT checking
does not perform revocation introspection on every request: an already-issued
access token may survive OAuth revocation until its five-minute expiry. Role
revocation is checked live regardless of token expiry.

Forms require the exact Origin and a signed, unexpired OAuth query for consent
or OAuth login continuation. Client text/claims are escaped, scripts and frames
are blocked, responses are not cached, and no admin web UI exists. Responses
from login/consent pages use `Referrer-Policy: strict-origin`: native HTML form
POSTs retain their real Origin while referrers omit paths and OAuth query strings.
Other routes use `no-referrer`. A `no-referrer` policy on the form document makes
browsers submit `Origin: null` and triggers `Origin required`; missing, null and
foreign origins remain rejected. See [MDN's Origin/referrer policy behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy#effect_on_the_origin_header).
HTTP bodies
are capped at 512 KiB. Better Auth uses database rate limits, keyed by the socket
address supplied by our adapter, not caller-supplied IP headers. Railway proxies
can share a bucket; MCP separately admits at most 60 requests per human per DB
calendar minute, including malformed authenticated requests. Concurrency controls
and monthly plan accounting remain separate later work. pg int8 timestamps are safely parsed as numbers so provider retry arithmetic
works; audit IDs are read as text. Secrets, tokens and key material are not included in app logs.

## Private configuration and Railway preparation

| Variable | Meaning |
| --- | --- |
| `PLATFORM_ORIGIN` | One canonical deployment origin: production above, explicitly allowlisted HTTPS staging, or local `http://localhost:3000` |
| `PLATFORM_ALLOWED_ORIGINS` | Optional comma-separated exact bare HTTPS origins permitted as alternate deployment origins; empty by default. No wildcards, credentials, paths, trailing slashes, query strings or fragments |
| `DATABASE_URL` | Private Postgres connection string, e.g. Railway Postgres reference variable |
| `BETTER_AUTH_SECRET` | Random secret, at least 32 characters; protects sessions, OAuth context and stored signing keys |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Private Google web OAuth client; exact callback above and local callback as needed |
| `PLATFORM_SUPERADMIN_EMAIL` | Exact owner-approved verified email, privately configured; sole superadmin identity |
| `PLATFORM_TESTER_EMAILS` | Optional comma-separated verified-email allowlist; cannot include the owner |
| `OAUTH_ENABLE_DCR` | `false` by default; `true` enables unauthenticated legacy OAuth client registration |
| `PORT` | Railway-injected listener port; local default 3000 |
| `NODE_ENV` | `production` in the container |
| `TEST_DATABASE_URL` | Test runner only; dedicated loopback Postgres database, never production |

For the requested Railway staging host, explicitly set both variables:

```dotenv
PLATFORM_ORIGIN=https://platform-production-d84c.up.railway.app
PLATFORM_ALLOWED_ORIGINS=https://platform-production-d84c.up.railway.app
```

This opt-in also works with `NODE_ENV=production`, as used by the container.
The service still uses only `PLATFORM_ORIGIN` for its issuer, resource audience,
OAuth metadata, trusted origin, forms and callback; the allowlist does not add
CORS origins, trusted login origins or client redirect URLs. For this staging
configuration the issuer is `https://platform-production-d84c.up.railway.app/api/auth`,
the MCP URL is `https://platform-production-d84c.up.railway.app/mcp`, and Google
must have the exact callback
`https://platform-production-d84c.up.railway.app/api/auth/callback/google`.
Use separate private staging credentials/database and connect clients to this
staging MCP URL. Tokens for a different deployment resource remain invalid.
Remove the allowlist in canonical production to retain the strict default.
These settings prepare staging boot; they do not establish a deployed or
verified Railway service, Google callback or connector.

Set the Railway repository root to `/`, config file to
`apps/platform/railway.json`, Dockerfile to `apps/platform/Dockerfile`, and keep
one service replica for the pilot. Add a Postgres service with durable storage
and privately reference its connection string. Use private networking, configure
backups/restore and data access, and attach the canonical domain/SSL only after
Carlos authorizes activation. Keep auto-deploy disabled until that authorization.
No Railway resources are created by these files. The config uses a pre-deploy
migration command and a DB readiness check; see [Railway config reference](https://docs.railway.com/config-as-code/reference).

Committed SQL includes the pinned Better Auth schema and separate role,
invitation, public-key and audit tables. The migrator holds a Postgres advisory
transaction lock, stores checksums, skips applied migrations and rejects edited
history. Changes require new numbered SQL files and owner review, not runtime
schema generation. `npm run migrate` applies them locally; Railway's prepared
pre-deploy command runs `node dist/migrate.js`. Back up before later schema
changes; no down/reset/drop tool is provided.

## Tools and authority

| Tools | Roles | Confirmation |
| --- | --- | --- |
| `capabilities.get`, `plans.list`, `plan.get_manifest`, `plan.get_schemas`, `policy.version` | All four roles | Read-only |
| `agent_keys.list` | All roles, own keys only | Read-only |
| `agent_keys.register` | All roles, own identity only | `REGISTER_MY_AGENT_KEY` |
| `agent_keys.revoke` | All roles, own active key only | `REVOKE_MY_AGENT_KEY:<keyId>` |
| `admin.invite` | Superadmin | `INVITE_ADMIN:<lowercase-email>` |
| `admin.revoke` | Superadmin; cannot revoke configured owner | `REVOKE_ADMIN:<userId>` |
| `admin.audit.list` | Admin/superadmin | `READ_PRIVATE_AUDIT_LOG` |

Default role is client. Verified allowlisted testers receive tester role, with
`testMode` on MCP request logs, tool-call audits and privileged-action records.
No payment or enrollment exists, so the role does not imply a free hosted plan.
The verified configured owner bootstraps automatically with an audit record.
Admin invitations last seven days and are consumed on verified sign-in/use;
acceptance is durable. No email or other invitation message is sent. An admin
cannot invite another admin or promote themselves. The same connector exposes
admin tools only to the authorized role. Reconnect/refresh client tool caches
after a role change; hidden calls remain rejected server-side.

Key/admin mutations and their audit insert share one transaction. Failed audit
writes roll back the mutation. Audit reads and bootstrap/role transitions are
also recorded. Logs are private application records, not cryptographic or
operator-proof storage. Plan artifacts are packaged from Phase 1, checked
against its generator at build/check time, and checked for pinned provenance at
startup. Tools require the exact plan ID/version; there is no latest fallback,
file path input, policy editing, sale or plan enrollment.

## Existing signed-email registry bridge

Platform registration binds a public ES256/P-256 JWK to the OAuth human, validates
the curve/coordinates, rejects secret fields, computes its RFC 7638 thumbprint
and permanently prevents duplicate bindings. Keys remain server-IDed and audited.
It neither changes DynamoDB nor grants existing email projects/actions/research.
The platform has no AWS permissions or credentials. This preserves the existing
[owner-only registry contract](../contracts/README.md) and [revocation runbook](runbooks.md).

For an individually approved email enrollment:

1. The user registers their public JWK with explicit confirmation and retains
   the private key on their own agent. Obtain the own-key list, platform key ID
   and thumbprint through the connector; never send private keys.
2. Carlos verifies the active platform binding and separately approves sender
   ID, allowed projects/actions, reply destination, expiry and research flag.
   Discovery consent and an admin role do not substitute for that approval.
3. Using the existing owner-controlled DynamoDB registry operation, insert a
   private `PARTNER#<platform-key-id>` record with `kid` equal to that key ID,
   `publicKey` equal to the validated public JWK, and the individually approved
   grant fields. Retain human/user ID and thumbprint in the private enrollment
   evidence. Do not overwrite another partner or publish grants/identifiers.
4. The agent uses the existing JWS v1 client with that `kid`, sender ID and private
   key; verify the grant and email transport separately before claiming it works.
5. To revoke an enrolled key, Carlos first sets the existing DynamoDB grant's
   `revoked: true` and verifies the AWS boundary, then the human revokes their
   platform key. A platform-only revocation does **not** disable an existing
   email grant. Synchronization and automated enrollment are later work.

No bridge write, email send or live partner enrollment was performed in Phase 2.
No registry reset/seed or AWS transport behavior was changed.

## Connect from ChatGPT and Claude after authorized deployment

First verify public HTTPS discovery, Google callback/consent, a test human's
role-scoped list and July 2026 tool calls. These are instructions, not evidence
of an already live connector.

ChatGPT: in [Plugins](https://chatgpt.com/plugins), choose **Add custom MCP server**,
enter a name/description and `https://mcp.a2aviary.io/mcp`, configure OAuth,
create/install the plugin, complete Google sign-in/consent, then select it with
`@` in a new conversation. Refresh metadata after tool/role changes. Account and
workspace policies apply. Follow the [official connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).
OAuth discovery advertises CIMD; ChatGPT supports CIMD, DCR or configured clients
with PKCE, per its [auth guide](https://developers.openai.com/apps-sdk/build/auth).

Claude: in **Customize → Connectors**, choose **Add custom connector**, enter
`https://mcp.a2aviary.io/mcp`, use sign-in and **Claude's published identity**
(CIMD), then finish Google/consent and enable the connector in the conversation.
Organization owners may need to add it first. **Register automatically** needs
the explicit DCR flag; it is not the default. See the [official Claude guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).
Remote clients must reach the deployed service; their localhost is not this laptop.

The strict MCP transport accepts POST only and rejects 2025-era initialization
or sessions. Modern requests need the matching `MCP-Protocol-Version`,
`Mcp-Method` (and `Mcp-Name` for tool calls), plus the protocol-version and
client-capabilities `_meta` envelope. The observed SDK rejects omissions and
header/body disagreement. This discovery service advertises no list-change
subscriptions and admits no long-lived listen streams; clients refresh metadata
explicitly. DCR changes OAuth registration only; it cannot make
an older MCP client compatible. There is no GET/SSE legacy endpoint or automatic
protocol fallback. ChatGPT/Claude UI documentation does not establish the actual
protocol sent by a specific account/release. Real client compatibility, external
Google callback, refresh and provider settings must be observed at activation.
If a client still uses a 2025 MCP revision, stop and request a separately reviewed
compatibility decision; do not weaken `legacy: "reject"` silently.

## Verification and owner actions

The test suite exercises real Postgres migrations, provider OAuth discovery,
consent/PKCE/token issuance, local JWKS/DPoP possession/replay checking, role filtering/call denial,
verified bootstrap/invitations, confirmations, key ownership and concurrent
registration, transaction rollback on audit failure, plan artifacts, strict
transport and body limits. Google sessions are fictional fixtures; there is no
live external sign-in or client connection claim.

Before activation Carlos must review the dependent Phase 1 and Phase 2 PR heads,
merge in the appropriate order, configure private identity/database/domain
settings, and separately authorize deploy/migrations and trusted-policy activation.
Source protection now includes `apps/` and `.dockerignore`, including rename
origins; the deployed AWS evaluator is unchanged. CI workflow wiring, persistent
monthly accounting and approved-spec/preview/human binding remain future work.
