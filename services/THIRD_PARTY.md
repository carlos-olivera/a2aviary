# Bundled dependency notices

The service build copies runtime dependencies' LICENSE, LICENCE, NOTICE, and COPYING files to `dist/licenses/`, together with a pinned name/version/license inventory. OpenAI SDK vendored parser/schema/query-string notices are copied separately. The Lambda deployment asset retains this directory. npm lockfiles retain the dependency graph; each upstream package keeps its own license. Project code is Apache 2.0.

The landing preserves separate Three.js MIT and font SIL Open Font License notices under `website/public/licenses/`. Infrastructure CDK packages retain their Apache 2.0 license and NOTICE in the installed dependency tree; dependencies are not relicensed as project code.
