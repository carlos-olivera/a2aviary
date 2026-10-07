# Managed imported static sites

The owner approved the Teco preservation plan on 2026-10-07. This implementation
adds platform controls around an existing private Astro site. Initial registration
is read-only toward hosting. Teco remains in its existing Railway workspace and
private repository, using its existing components, styles, Markdown, local assets,
fonts and dependency lockfile. Inspection confirmed no CMS requirement. This does
not claim that Teco has been registered on the live platform or transferred to
platform deployment control. See [release evidence](release-verification.md).

## Activation and private configuration

Apply migration `006-managed-static.sql` through the normal platform migration
path only during a separately authorized rollout. The following flags default off:

| Variable | Effect |
| --- | --- |
| `MANAGED_STATIC_SITES_ENABLED=true` | Enable imported-site registration, scoped administrators, prepared releases and private reports |
| `MANAGED_STATIC_DEPLOY_ENABLED=true` | Permit deployment/rollback admission and worker execution |
| `MANAGED_STATIC_HANDOFF_ENABLED=true` | Permit the superadmin's first switch of deployment control |

Registration reuses `SITE_BUCKET_ENDPOINT`, `SITE_BUCKET_REGION`,
`SITE_BUCKET_NAME`, `SITE_BUCKET_ACCESS_KEY_ID`, `SITE_BUCKET_SECRET_ACCESS_KEY`,
`SITE_BUCKET_FORCE_PATH_STYLE`, `OPENAI_API_KEY`, `RAILWAY_API_TOKEN` and
`SITE_PROTECTED_PROJECT_IDS`. Use the existing private artifact bucket and scoped
credentials. No infrastructure or shared-bucket creation is added. Imported-only
operation does not require `SITE_WORKFLOW_ENABLED`, PocketBase, CMS credentials,
backup secrets or a volume. Never add a CMS route to an imported `cmsMode:none` site.
The platform's own Railway project is protected automatically when its ID exists.
The owner must also configure the imported project's exact ID as protected.
Catalog provision/reset remains unable to operate on that project.

Do not replace `PLATFORM_SUPERADMIN_EMAIL` silently. Verify its current value
against the owner-approved private identity and a real verified Google sign-in.
Inspect live `sites.list` before registering a first-client pilot. Preserve tester
classification/IDs. Any existing non-test site with a specification, including an
archived real client, requires reconciliation before claiming a new site is first.
The server serializes pilot admission and refuses a duplicate provider target.

## Registration and administration

Prepare baseline files privately from the pinned source under Node.js 22; keep
all client source/assets/bindings outside Git. Upload the prebuilt file map through
`POST /api/site-releases` with `kind:import-baseline`, then call `site.import` with
the actor-bound upload ID, exact target, commit/deployment IDs, serving configuration
and confirmation. The adapter observes workspace, production environment, service,
domains, source, deployment status, undecrypted configuration digests and every
public file hash, checking drift before committing registration. It also observes
actual 404 and preview `noindex` behavior. Preserve the existing `www` serving
configuration; its public availability remains explicitly unverified.

Record a digest-pinned compatible Caddy runtime image before registration/handoff.
Do not guess the digest from a floating tag. Inspect the current runtime and verify
the chosen immutable image against the baseline delivery configuration before
activation. The adapter uploads only a trusted Docker/Caddy wrapper and prepared
static bytes; it cannot execute source build scripts or provision CMS resources.
The provider's environment config, domain bindings and protected target must all
remain unchanged. A Git source shared across environments is refused because the
Railway disconnect mutation affects the service's source globally.

Only the verified superadmin calls `site.admin.assign/remove/list`. Batch email
grants remain pending until verified sign-in. No invitation is sent. A grant is
site membership, not a platform role or billing exemption. The owner cannot be
removed through membership operations. Assigned administrators can inspect their
site, prepare/verify releases, retrieve reports, deploy verified bytes after
activation, and confirm rollback. Other sites and platform-wide administration
remain denied. Revocation checks use current state even for existing OAuth tokens
and queued jobs. Site locks serialize membership changes and provider mutation;
a provider action already admitted must settle safely rather than be replayed.

## Release and recovery procedure

1. Retain the deployed revision, source commit, complete file map/hashes, serving
   configuration, domain bindings, metadata, redirects, headers and private
   screenshots. For Teco the privately checked baseline contains 58 built files.
2. Build from the pinned private source with Node.js 22 and existing dependencies.
   Upload prepared bytes. The preservation release requires complete equality
   against the imported baseline; no content/style/component conversion is needed.
3. Call `site.release.verify`. The fixed isolated checker loads local fonts/images,
   settles reveals, compares seven pages at 360, 375, 768 and 1440 px, and checks
   FAQ/menu/Escape/focus/reduced-motion states, internal references, metadata and
   actual 404 behavior. Require zero unexplained visual differences. Existing
   accessibility findings must match the baseline exactly; record them privately
   without modifying approved content/styles. The controller binds the report to
   both artifact digests and all named checks; caller reports are never proof.
4. Verify the pinned serving image with the existing Caddyfile, canonical/trailing
   slash/redirect/security/cache behavior, structured data, sharing assets, sitemap,
   robots and preview `noindex`. Server capture checks public hashes and stable
   headers after deployment; local browser verification alone cannot prove Caddy
   or Railway edge behavior. Pinning a runtime is not itself serving parity proof.
5. Reobserve source, deployment, domain and configuration immediately before
   deployment. Drift invalidates admission. The binding is immutable: if the
   baseline genuinely changes during preparation, stop and reconcile it in an
   owner-reviewed maintenance transaction before creating fresh candidates. There
   is no tool that silently updates approved baseline bindings.
6. Obtain separate explicit authorization for first handoff. Enable the necessary
   flags only then and use `HANDOFF_SITE:<siteId>:<releaseId>`. The adapter detaches
   the exact service's Git source before uploading, preventing competing push
   deployments. The service/domain/workspace remain the same; DNS is not changed.
   Later deploy/rollback operations use exact release-specific confirmations.
7. Verify the exact newly recorded deployment ID, successful status, detached
   source, unchanged configuration/domain digests, HTTPS, public file hashes and
   stable headers. Known failed deployments trigger recovery of the retained
   predecessor on that target, with a separate recorded recovery deployment ID.
8. Ambiguous uploads, timeouts, crashes or unexpected competing deployments become
   `unknown` and block further mutations. Never retry a provider upload blindly.
   The superadmin uses `site.release.reconcile` only when exact recorded original/
   recovery/prior deployment IDs and public byte evidence identify the outcome.
   A restored release records failure of the attempted release and the recovery.

Interrupted verification/usage jobs fail and can be explicitly retried. Interrupted
mutations become unknown. Admission and provider-start audits must commit before
provider work. One durable worker drains imported jobs with a global lease and
site-specific leases; it runs alongside the catalog worker in the existing process.

This preservation contract currently admits output-identical releases only.
Source-only changes with identical build bytes and retained-release rollback are
supported. Content-changing imported releases need a separately approved preview/
change contract. Existing catalog submissions/changes keep their original limits.

## Eligibility, usage and private reports

Owners whose current platform role is `admin` or `superadmin` are exempt; testers
remain a separate immutable site classification. Effective-dated history and
operation/job admission and execution snapshots preserve past eligibility. Role
changes affect future operations, without retrospective charges. Charges are
explicitly disabled; exempt sites still record operations and costs.

The worker schedules daily current-period Railway usage collection. `site.costs.refresh`
can request an explicit `YYYY-MM` period. The existing SHA-pinned Railway CLI uses
[project/service usage breakdowns](https://docs.railway.com/cli/usage); available
history is provider-limited. Accrued service costs, actual provider billing-period
boundaries and CPU/memory/network resource windows are retained separately.
HTTP visitor metrics are not collected. Repeated same-day snapshots replace the
same key and monthly accrued snapshots are never summed into an invented invoice.

`site.report` returns a private UTC-month report and authenticated CSV path with
operations, verification/deployment/rollback/failure records, applied catalog
changes, effective eligibility, provider resource data and attributable costs.
CSV includes the same cost components and explicit unavailable categories.
Verification/storage costs remain unavailable until attributable billing evidence
exists; shared overhead remains separately unallocated. Missing credentials,
permissions, historical data or billing access never means zero cost. No estimates
or allocation rates are invented. Stale snapshots retain their collection time.

Use the current authorized connector to fetch CSV/report artifacts with its token;
a returned path is not a public download grant. Preserve private source, screenshots
and reports in existing private storage/local ignored evidence. Configure lifecycle
retention for abandoned baseline uploads and unreferenced objects without deleting
retained releases. No dashboard, tracking, reporting email or payment integration
is introduced. See [contract](../contracts/managed-static/README.md),
[decision 011](decisions/011-imported-static-managed-sites.md) and
[release evidence](release-verification.md).

The checker records raw pixel differences. At most 100 pixels differing by no more than two channel values may be classified as observed Chromium edge quantization, and only when the entire candidate bundle is byte-identical to the baseline. Larger differences, dimension changes, DOM/focus/state differences or any changed file fail. This explained rendering noise is never used to approve changed content or styles.
