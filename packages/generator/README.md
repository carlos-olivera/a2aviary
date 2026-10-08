# Site generator

Node.js 22 package for the fixed web-simple Astro catalog, canonical spec hashes,
server image normalization, hosted Agents API verification, private artifact
storage and isolated Railway/PocketBase provisioning. It does not extend the AWS
brief-analysis flow.

Read [site operations](../../docs/sites.md) before activation. Run `npm ci`,
`npm run check`, `npm run build`, `npm test` and `npm run fixture` here. Build
before installing the local dependency in `apps/platform`. The build emits
runtime/types, replaces the copied trusted checker resources, installs the
SHA-pinned Railway CLI and preserves dependency licenses. Astro is pinned to
7.3.6 and PocketBase to 0.40.4.

The local fictional seven-page fixture uses complete catalog content and a
server-normalized WebP. Its actual browser checker builds Astro, checks axe,
links and Lighthouse, and captures every authored page at 390 and 1280 px.
Approval and client preview bundles are absent from canonical specs. Image
decoding runs in a bounded, secret-free child; the controller checks output
hashes and WebP headers. Approved deployments use the stored verified file map.

Postgres behavioral tests use explicit provider doubles. The real local browser
and Docker PocketBase/Caddy checks exercise actual builds and editing without
redeployment; they do not establish cloud deployment or Google authentication.

The separately authorized hosted tester fixture uses the one-shot
`apps/platform/scripts/run-hosted-fixture.mjs` runner with read-only Railway
configuration, child-only credentials and a disposable loopback database. It
stops at the first failure and attempts teardown once. Do not rerun an existing
attempt marker or substitute production database credentials. See
[release evidence](../../docs/release-verification.md) for the observed result,
cleanup limits, unavailable billing amounts and unresolved rollout gates.
