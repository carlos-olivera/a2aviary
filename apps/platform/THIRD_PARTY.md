# Platform dependency notices

Project code remains Apache 2.0. Better Auth 1.7.7 and its MCP, OAuth provider
and CIMD packages, the official Model Context Protocol server 2.3.1, pg 8.16.3,
jose 6.2.12 and Zod 4.6.5 retain their upstream MIT licenses. Installed transitive
packages retain their own licenses; they are not relicensed as project code.

`npm run build` copies installed runtime LICENSE, LICENCE, NOTICE and COPYING
files into `dist/licenses/` and records name/version/license/path in an inventory.
The Docker runtime includes that directory and the production dependency tree
with its original notices. The exact graph is pinned in package-lock.json.
TypeScript is a development dependency with its Apache 2.0 license. Postgres and
Node base images retain their own distributed notices and licenses.

Upstream sources: [Better Auth](https://github.com/better-auth/better-auth),
[MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk),
[node-postgres](https://github.com/brianc/node-postgres),
[jose](https://github.com/panva/jose), [Zod](https://github.com/colinhacks/zod).
