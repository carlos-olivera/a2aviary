# Platform dependency notices

Project code remains Apache 2.0. Better Auth 1.7.7 and its MCP, OAuth provider
and CIMD packages, the official Model Context Protocol server 2.3.1, pg 8.16.3,
jose 6.2.12 and Zod 4.6.5 retain their upstream MIT licenses. Installed transitive
packages retain their own licenses; they are not relicensed as project code.

The generator workspace's production dependencies also ship in the platform
image after `npm prune --omit=dev`. The following versions and license identifiers
were read from the root [lockfile](../../package-lock.json) and installed package
metadata on 2026-10-14; their top-level license/notice files were checked against
the build inventory and copied bytes:

| Runtime package | Version | License |
| --- | --- | --- |
| `@axe-core/playwright` | 4.13.0 | MPL-2.0 |
| `axe-core` (transitive) | 4.13.0 | MPL-2.0 |
| `sharp` | 0.35.5 | Apache-2.0 |
| `playwright` | 1.63.0 | Apache-2.0 |
| `lighthouse` | 13.5.0 | Apache-2.0 |
| `astro` | 7.3.6 | MIT |
| `openai` | 7.27.0 | Apache-2.0 |
| `@aws-sdk/client-s3` | 3.1146.0 | Apache-2.0 |
| `ajv` | 8.20.0 | MIT |
| `qrcode` (platform dependency) | 1.5.4 | MIT |

Sharp's bundled libvips binaries have their own license. The pinned
`@img/sharp-libvips-*` 1.3.4 packages declare **LGPL-3.0-or-later**, independently
of sharp's Apache-2.0 license. This was verified in the installed Darwin ARM64
package and the lockfile-pinned Linux glibc ARM64/x64 package archives used for
the Docker architectures. Their README license tables identify libvips as LGPLv3
and explain use of the later-version clause of LGPLv2/LGPLv2.1; the bundle also
contains dependencies under their respective licenses.

`npm run build` uses [the notice copier](scripts/licenses.mjs) to copy installed
runtime top-level files named LICENSE, LICENCE, NOTICE or COPYING, optionally
followed by a dot suffix (case-insensitive), into `dist/licenses/`. It records
name/version/license/path in an inventory. Running the copier after root `npm ci`
and then pruning development dependencies confirmed that every package in the
table remains installed and its matching notices were copied byte-for-byte,
including Playwright's NOTICE and qrcode's lowercase `license`. The Docker
runtime copies this directory and the pruned dependency tree. The exact graph
is pinned in the root lockfile; optional binaries vary by platform.

**Finding:** the collection of notices is incomplete. The libvips packages
checked above contain no matching license/notice files, so the inventory records
their LGPL identifier but `dist/licenses/` contains no corresponding LGPL text.
The copier is not recursive and also excludes axe-core's `LICENSE-3RD-PARTY.txt`
because it has a hyphen suffix. That file remains in the copied production
dependency tree. Build behavior is unchanged by this documentation correction;
complete notice collection remains a follow-up.

TypeScript is a development dependency with its Apache 2.0 license. Postgres and
Node base images retain their own distributed notices and licenses.

Upstream sources: [Better Auth](https://github.com/better-auth/better-auth),
[MCP SDK](https://github.com/modelcontextprotocol/typescript-sdk),
[node-postgres](https://github.com/brianc/node-postgres),
[jose](https://github.com/panva/jose), [Zod](https://github.com/colinhacks/zod).


The library compiler pins **Acorn 8.19.0 (MIT)** as a development dependency for
AST validation; regex scanning cannot enforce the restricted behavior language.
Existing **esbuild 0.25.12 (MIT)** minifies approved behavior expressions. Neither
parser nor minifier is shipped in generated sites. Curated Inter and EB Garamond
Latin WOFF2 files retain their pinned @fontsource 5.3.0 provenance and original
SIL Open Font License 1.1 files under `library/fonts/`; generated sites include
those notices. Project Apache-2.0 licensing does not replace dependency licenses.
