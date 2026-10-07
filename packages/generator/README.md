# Site generator

Node.js 22 package for the fixed web-simple Astro catalog, original-byte image
validation, deterministic hashes, hosted Agents API verification, bucket storage
and isolated Railway/PocketBase provisioning. It imports the existing pure Phase
1 validator; it does not extend the AWS brief-analysis flow.

Read [site operations](../../docs/sites.md) before activation. `npm ci`,
`npm run check`, `npm run build`, `npm test`, and `npm run fixture` run from this
directory. Build before installing the local dependency in `apps/platform`.
The build emits a bundled runtime and type declarations, copies fixed checker
resources, downloads the SHA-pinned first-party Railway CLI, and preserves
dependency licenses. Astro is pinned to 7.3.6, PocketBase to 0.40.4.

The seven-page fixture reuses Phase 1's fictional text and original one-pixel
PNG, then prepares a complete catalog HTML/CSS/font preview and valid approval
digests. No client material is copied. The local browser checker and Docker CMS
check use actual builds/browsers/PocketBase. Postgres workflow integration uses
explicit provider doubles; those tests do not assert a cloud deployment.

The live test requires `RUN_SITE_CLOUD_E2E=true`, the development variables from
site operations, `SITE_DEPLOY_ENVIRONMENT=fixture`, and a dedicated loopback test
Postgres database. Run `node --env-file=<private-development-env>
--test ../../apps/platform/test/site-cloud.test.mjs` here. It uses the real
Agents API verifier, bucket and Railway deployer; records resource identifiers
only in an ignored private evidence file; asserts an HTTPS fixture response and
CMS login; leaves remote resources for explicit owner-reviewed cleanup. No
platform staging service, AWS resource or DNS record is modified.

The separate [managed-static workflow](../../docs/managed-static-sites.md) accepts prebuilt private Astro outputs, retains their original components and lockfile in the private source repository, and uses a fixed static checker and exact protected-target adapter. It adds no CMS resources and defaults off.
