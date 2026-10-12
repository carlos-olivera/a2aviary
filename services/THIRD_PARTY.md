# Bundled dependency notices

The service build copies runtime dependencies' LICENSE, LICENCE, NOTICE, and COPYING files to `dist/licenses/`, together with a pinned name/version/license inventory. OpenAI SDK vendored parser/schema/query-string notices are copied separately. The Lambda deployment asset retains this directory. npm lockfiles retain the dependency graph; each upstream package keeps its own license. Project code is Apache 2.0.

The landing preserves separate Three.js MIT and font SIL Open Font License notices under `website/public/licenses/`. Infrastructure CDK packages retain their Apache 2.0 license and NOTICE in the installed dependency tree; dependencies are not relicensed as project code.

Standalone site asset validation pins Sharp 0.35.5 (Apache 2.0). Its optional,
platform-specific shared libvips packages retain their own LGPL-3.0-or-later
metadata and dependency versions; they are not relicensed as Apache 2.0. The
inventory skips absent optional platform packages and copies notices for installed
packages. Native shared libraries remain external to JavaScript bundles; no AWS
worker imports the site validator. Upstream sources and notices are maintained in
[Sharp](https://github.com/lovell/sharp) and
[sharp-libvips](https://github.com/lovell/sharp-libvips).


The library compiler pins **Acorn 8.19.0 (MIT)** as a development dependency for
AST validation; regex scanning cannot enforce the restricted behavior language.
Existing **esbuild 0.25.12 (MIT)** minifies approved behavior expressions. Neither
parser nor minifier is shipped in generated sites. Curated Inter and EB Garamond
Latin WOFF2 files retain their pinned @fontsource 5.3.0 provenance and original
SIL Open Font License 1.1 files under `library/fonts/`; generated sites include
those notices. Project Apache-2.0 licensing does not replace dependency licenses.
