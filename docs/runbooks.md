# Setup and operational recovery

## Reproducible setup

Use Node.js 22 and AWS credentials for the owner-controlled infrastructure path. Copy `infra/config.example.json` to `.local/deploy.json` and set account, existing zone ID, region `us-east-1`, and private owner alert email. Never publish the real configuration or generated CDK output. Inspect existing DNS records and SES receipt rules before deploying; reconcile conflicts rather than deleting unrelated resources. This initial stack assumes no conflicting apex/MX/DMARC records or active receipt rule set. Deployment does not destroy the imported zone, domain, OIDC provider, or bootstrap.

```sh
(cd website && npm ci && npm run check && npm run build)
(cd services && npm ci && npm run check && npm run build && npm test)
(cd infra && npm ci && npm run build && npm test)
(cd infra && npx cdk diff --output ../.local/cdk)
(cd infra && npx cdk deploy --all --output ../.local/cdk --require-approval never --outputs-file ../.local/services-outputs.json)
```

If the CLI stops after preparing an available change set, use `--method prepare-change-set`, review `aws cloudformation describe-change-set`, execute that exact set with `aws cloudformation execute-change-set`, and wait for stack completion. Prepared is not deployed. This owner-controlled path was used for the launch updates.

The example synth does not deploy. For tests, use `A2AVIARY_CONFIG=config.example.json`. Different concurrent CDK commands must use separate output directories. Owner review of the diff is required before future infrastructure changes; the initial deployment was explicitly authorized in the release plan.

Transfer an OpenAI key directly from a private file, create the ES256 service signing secret, register the controlled partner, and enable the three email switches after verification:

```sh
node services/scripts/setup.mjs seed /absolute/private/openai-key-file
node services/scripts/setup.mjs test-partner
node services/scripts/setup.mjs switches on
```

`seed` reuses `.local/service-signing.json` when it exists and otherwise creates a new signing key; it also rewrites `contracts/service-public-key.json` and turns every switch off, including `developmentEnabled`. Do not rerun it casually. Publish its public key and distribute rotations to partners before switching signing credentials. The test partner expires after seven days and may reply only to the collector. Replace it with individually approved grants for ongoing use. SNS email alerts require confirmation in the owner's inbox. DMARC is enforced (`p=reject`); re-verify SES identity, DKIM, MAIL FROM, MX and outbound authentication after any DNS change.

## Website delivery and rollback

GitHub `main` checks build and test the website, services and infrastructure before the separate OIDC deployment job. The workflow does not build or test `apps/platform` or `packages/generator`; run their checks locally (see [local development](local-development.md)). Set repository variables `WEBSITE_DEPLOYMENT_ROLE`, `WEBSITE_BUCKET`, `RELEASE_BUCKET`, and `DISTRIBUTION_ID` from the website/CI outputs. Configure GitHub's immutable subject template before relying on the role. Third-party Actions are pinned to commit IDs. PR checks have no identity-token permission or deployment credentials.

The deployment script creates a unique release ID on every run, including reruns of the same commit, and snapshots every release file and checksums in the private release bucket, uploads fingerprinted assets first and `index.html` last, invalidates, then verifies the public revision and every file checksum, MIME type, and cache header. A failed public check restores the previous release's mutable files. Deployment jobs serialize and never delete existing assets. Keep current/rollback references indefinitely and retain other fingerprinted assets for at least 365 days; owner cleanup may remove unreferenced files older than that only after checking current and rollback manifests. No automated garbage collection is enabled initially.

For manual rollback, restore snapshot files from `releases/<releaseId>/` (older bootstrap releases use the commit) according to its manifest, preserve immutable asset keys, restore mutable files with revalidation headers, restore `index.html` last, and invalidate changed paths. Confirm `/.well-known/release.json`, public assets, DNS/TLS, and browser behavior. Record the recovered revision and incident. Do not edit a manifest to claim another commit.

## GitHub App and policy

Prepare a private registration form only after the operator API is deployed:

```sh
node services/scripts/setup.mjs app-registration
# Open .local/app-registration.html through a temporary local HTTP server.
node services/scripts/setup.mjs app-installation
```

The owner registers the private **a2aviary Operator** App (fallback name **a2aviary Operator Carlos Olivera Terrazas**) and installs it only on this repository. The callback validates a one-hour nonce, exchanges the manifest, and stores the key and webhook secret directly in Secrets Manager. The owner setup command enumerates the whole installation grant (without pre-filtering it to the expected repository), verifies that only a2aviary is included, and revokes that temporary read token. Installation lifecycle events are delivered automatically by GitHub and must be omitted from manifest default_events. Tokens are installation-scoped and short-lived. Only broker Lambda roles read the App key; callback can write it. Do not store keys in GitHub Actions secrets or issue a broad PAT to an agent.

Require CI `checks` and App-bound `a2aviary-policy` on `main`, deny force pushes and deletion, dismiss stale approvals, and give the App no bypass. If registration or required protection fails, leave development disabled and autonomous merge unavailable. Until that check is active, retain blanket owner CODEOWNERS, one owner review with stale approval dismissal, required App-bound Actions CI, and force-push/deletion denial on main; repository auto-merge and the development broker remain disabled. Test both routine and protected-path PRs. Sensitive PRs require Carlos's real approval for the current head; automation must not manufacture that approval through his authenticated account.

## Switches, budgets, and credentials

`CONTROL#flags` separates admission, intake processing, and outbound sending. Edit each boolean independently with owner IAM. The setup `switches` convenience command rewrites the whole flags item: it changes all three task switches and also sets `developmentEnabled` to false, turning off the development broker. Admission off rejects new submissions while accepted tasks may finish. Processing off leaves inbound/accepted work queued and cancels an active provider session on its next runtime check; deadlines and cleanup remain active. Sending off leaves pending outbox work queued. Watch DLQ ages during pauses. AWS budgets only notify. Application budget exhaustion stops reservations; unknown usage stays reserved. Reconcile unknown costs against provider evidence before releasing reservations. Do not reset a ledger to bypass spending limits.

Revoke an individual partner via `revoked: true`; active tasks recheck grants. Rotate/revoke the OpenAI credential at the provider and Secrets Manager. Disable App installation or revoke its key in GitHub and replace the secret; tokens expire independently. Disable workflow role trust if CI is compromised. Never print secret values, MIME, private results, or owner configuration into public evidence.

## Queue, session, and send recovery

Inspect sanitized logs and redacted audit IDs before redriving DLQs. Stream failures have a dedicated DLQ and carry DDBStreamBatchInfo, not the original email/queue body. Retrieve the exact sequence range from the DynamoDB stream while its 24-hour records still exist, replay those records through the dispatcher, verify an empty batch failure result and durable downstream state, then remove only the recovered envelope. If records expired, reconcile work from DynamoDB state through the watchdog; never move a stream envelope into an email queue. Fix the underlying failure first, inspect message/task state, then redrive a bounded batch. Duplicate receipts reuse the inbox; terminal tasks reuse captured results; saved tool outcomes prevent repeated application calls. A scheduled watchdog recovers missed stream publications. Delivery feedback retries if the outbox GSI is not yet visible; exhausted asynchronous feedback goes to its dedicated 14-day DLQ. Inspect that failure destination envelope before replaying the original SNS event. A submission with uncertain session creation blocks instead of starting another paid task. Find the existing session by task metadata and reconcile through an owner operation.

`delivery_unknown` means an SES call may have succeeded. Examine SES delivery/bounce/complaint events and the collector or registered recipient's evidence. Never change it directly to pending or redrive it blindly. If delivery remains unknown, obtain controlled owner recovery authorization and use a new message ID, recording that duplication is possible. Bounce/complaint suppresses a destination; remove suppression only after addressing its cause.

Expired task deadlines cancel provider turns, persist a terminal notification, and schedule session cleanup. Unknown usage retains the full reservation. A concurrency slot remains held until provider deletion confirms settlement; unresolved session submission requires owner reconciliation before releasing the slot. A cancellation acceptance response does not prove settlement. If session deletion returns 409, cleanup requests cancellation again and retries later while emitting a failure signal. Keep new admission paused if provider settlement cannot be verified. Check that session deletion has completed (`providerDeletedAt`) and retry cleanup after provider recovery. Provider retention controls are separate from application lifecycle expiration.

## Private content retention

Authenticated inputs are uploaded with a pending tag before the admission transaction. A successful transaction promotes them to accepted; the runtime also promotes committed inputs after an interrupted intake worker. Rejected or abandoned pending inputs expire after seven days; accepted inputs/results and raw accepted email expire after thirty days. Rejected raw email has a seven-day tag. Redacted audit/replay records expire after ninety days. Lifecycle and DynamoDB TTL deletion are asynchronous, not exact deletion deadlines. Retained backups/provider retention are separate; do not place private content in public verification records.

## Failed stacks and teardown

Use CloudFormation stack events and a reviewed CDK diff to repair a failed stack. Do not force-delete retained buckets/tables or imported resources to clear a deployment. Infrastructure deploys are separate from the website role. Repeated no-change deployment should not replace data resources.

For teardown, disable admission/processing/sending and development; cancel and reconcile active sessions; retain private audit/results until their scheduled expiry; deactivate only this receipt rule set; remove this project's DNS records; disable OIDC role and App installation. Disable termination protection only after owner authorization. Retained S3, DynamoDB, Secrets Manager, log groups, and release snapshots need explicit inventory and cleanup. Do not destroy the hosted zone/domain/bootstrap/OIDC provider. Document remaining resources and recurring charges.

## Reducing limits

The default limits are centralized in `contracts/limits.defaults.json`. The owner's private deployment configuration may supply a `limits` object with positive integer reductions. CDK validates it before deployment; workers validate it again. Increases require a reviewed code/default change. Partner registry entries may contain a `limits` object to further reduce request/task allowances and daily admissions. Global monthly budget and concurrency remain service controls and cannot be expanded by a partner. Capabilities returns the requester's applicable limits and actions. Brief plus text attachments must fit `totalInputBytes` (48,000 by default), in addition to each transport limit.

Changing monthly allowance does not reset an existing ledger. Reconcile committed/reserved amounts before an owner adjusts its available balance. Unknown reservations remain held until final usage evidence supports a controlled settlement.

## Alert activation

Confirm the AWS SNS subscription email sent to the configured owner address. Until confirmed, failure/model-budget alerts are configured but cannot reach that inbox. The project-tag AWS budget also requires the `Project` cost-allocation tag to be active in the AWS management/payer account. The current linked account cannot activate it; a management-account owner must perform that step. Do not treat an inactive tagged budget as verified spending coverage. AWS budget emails and alarms are notifications, not spending stops.

## Human support and public commercial pages

`hello@a2aviary.io` is the human support/privacy/refund contact. On 2026-10-05,
a read-only check found only agent/test rules in the active `a2aviary-prod` SES
rule set. SES production sending was enabled. Neither observation establishes
hello@ delivery. After separate owner authorization, the email, runtime and
controls stacks were deployed on 2026-10-05. The support rule and worker trigger
are active; actual inbox/reply delivery remains unverified. See the
[deployment evidence](release-verification.md#human-support-forwarding--2026-10-05-deployed).

### Prepared forwarding behavior

The hello@ rule stores mail in a separate private support bucket, publishes its
receipt to a dedicated SNS/SQS path, and runs a Node.js 22 support worker. It runs
before the agent rule without stopping further evaluation, preserving agent/test
routing for mail with multiple recipients. The worker validates the SNS topic,
receipt recipient, timestamp, S3 bucket and exact `support/<messageId>` key.
Only PASS spam/virus verdicts proceed; other verdicts, malformed sender/reply
addresses (single ASCII mailboxes), loops and oversized mail are quarantined. Raw messages are bounded
at 28,000,000 bytes and encoded outbound messages at 40,000,000 bytes.

The worker sends from hello@ to private `config.ownerEmail` only. It includes a
plain-text summary and the original `.eml` attachment; validated original
Reply-To (or From when absent) is retained. Incoming addresses cannot change
the forwarding destination. The worker has no agent-state, model or secret
access, and sends no automatic response to the original sender. Owner replies
use the owner's mail application; this delivery does not configure an outbound
hello@ mailbox or send-as identity in that application.

A separate ledger conditionally claims each SES receipt before sending. SES
acceptance means `accepted_by_ses`, not inbox delivery. Completed duplicates
are suppressed. Pre-send errors and definite SES refusals retry through SQS;
uncertain sends and interrupted claims remain held and ultimately enter the
DLQ. The SES SDK has sending retries disabled. An expired seven-day receipt
cannot resend after its ledger entry expires. Support objects/ledger expire
seven days after storage/receipt respectively; expiry is asynchronous. Support
logs are redacted and retained thirty days; DLQ envelopes are retained fourteen
days and may include original receipt metadata. Inbox/provider copies follow
separate retention. Quarantines, processing errors and DLQ depth use owner
alerts; the owner's SNS subscription must be confirmed for alerts to arrive.

### Owner activation and delivery verification

1. Review and approve the PR as Carlos Olivera Terrazas. Merge/release and AWS
   deployment need separate authorization. The existing main workflow deploys
   website files only; it does not activate support infrastructure.
2. Privately confirm `.local/deploy.json` `ownerEmail` is the intended inbox and
   is not hello@. Keep the real address/configuration out of Git.
3. With Node.js 22, build and check all packages using the reproducible setup
   above. From `infra`, run `npx cdk diff a2aviary-prod-email
   a2aviary-prod-runtime a2aviary-prod-controls --output ../.local/support-cdk`.
   Review the support resources, agent rule ordering, worker permissions and
   alarms. The live-template comparison also includes pre-existing owner-name
   tag drift; review that attribution change separately. Existing Lambda code assets also change because workers share the
   service bundle. Do not replace unrelated resources or alter DNS.
4. After separate deployment authorization, from `infra` run `npx cdk deploy
   a2aviary-prod-email a2aviary-prod-runtime a2aviary-prod-controls --output
   ../.local/support-cdk --outputs-file ../.local/services-outputs.json` and wait
   for all stack updates to complete. Inspect any prepared change set before
   execution; preparation is not deployment.
5. Run `aws ses describe-active-receipt-rule-set --region us-east-1` and confirm
   the hello@ rule, support S3/SNS action, and preserved agent/test rules. Run
   `aws sesv2 get-email-identity --email-identity a2aviary.io --region us-east-1`
   and `aws sesv2 get-account --region us-east-1`; confirm sending identity,
   DKIM/MAIL FROM and enabled sending. If sandboxed, verify the private owner
   recipient in SES before testing. Preserve the existing inbound MX.
6. Confirm the existing OwnerAlerts SNS subscription in the owner inbox and
   observe an owner-authorized test alert. Inspect the support Lambda event
   source mapping and empty support DLQ before testing delivery.
7. From a separately authorized external test address, send a unique fictional
   support message and attachment to hello@. Confirm owner inbox arrival,
   original attachment bytes, From and Reply-To, and ledger SES acceptance.
   Reply from the inbox and confirm arrival at the test sender. Check the
   forwarding message's authentication results; the owner's reply uses its
   own mailbox authentication. Verify agent/test routing with separately
   authorized controlled checks. Do not send client data.
8. Record dated deployment, receipt, inbox/reply and authentication evidence
   privately, with only redacted status in release verification. Confirm the
   owner inbox retention policy separately. Do not claim delivery from SES
   acceptance, DNS, stack completion, or a passing local test alone.

### Raw send permission and refusal diagnostics

SESv2 raw-content forwarding requires the SendRawEmail action in addition to
SendEmail in this worker's policy. Keep both actions restricted to the existing
sending identity, hello@ From address and private owner recipient. The 2026-10-05
live diagnostic reproduced AccessDeniedException under the original policy;
SendEmail-only IAM simulation did not detect the missing raw action. An explicit
SES access denial is a definite refusal, while transport uncertainty stays held.
Log only known error names and receipt identifiers, never provider messages
containing addresses or message content. Empty MIME is not a safe no-send probe:
SES accepted it in the corrected diagnostic session. Use local tests and IAM
simulation for routine checks, and authorize any actual sending test explicitly.

### Held delivery recovery

Inspect the support ledger and private SES/inbox evidence before any redrive.
For `sending` or `delivery_unknown`, reconcile whether the owner actually
received the message. If confirmed, conditionally change that exact ledger
status to `accepted_by_ses` and remove the recovered failure envelope. Only
when non-delivery is established and the receipt is still younger than seven
days may the owner conditionally reset it to `ready` and redrive that one
receipt. Uncertainty is not permission to resend. Quarantined messages require
owner inspection, a confirmed reason/fix and the same bounded recovery; never
route them into the agent queue. Expired receipts require independent owner
handling, not resetting timestamps to bypass expiry.

### Public launch status

The build emits exact `/terms`, `/privacy`, `/refunds`, and `/pricing` HTML
objects. Pricing presents Basic at $10/month · $100/year with a disabled CTA
and “Launching soon. Checkout opens when payments are enabled.” Credit amounts
and subscription policies will be published before checkout opens. This pricing
copy predates decision 007 and is superseded; correcting it is a separate website
change. Earlier catalog activation is agent-reported; current production
health and activation are unverified (see [release verification](release-verification.md#public-health-observation--2026-10-08)).
After an authorized website release, verify public route/MIME/cache behavior,
copy, metadata, navigation, contact, and sitemap. Payment activation remains a
separate owner action; no payment integration is included here.

## Railway platform

The platform service (`apps/platform`) and its Postgres run on Railway; each
client site runs in its own Railway project. This is a minimum operating
procedure. The Railway console is the authority for live settings; the repository
holds only `apps/platform/railway.json`.

### Deploy

- `railway.json` builds `apps/platform/Dockerfile`, runs `node dist/migrate.js`
  before each deployment, starts `node dist/main.js` and checks `/healthz`.
- Auto-deploy from `main` is enabled (owner-reported, 2026-10-08): every merge
  deploys and migrates production. CI does not build or test the platform, so run
  the `packages/generator` and then `apps/platform` checks and tests locally before
  merging platform changes. Keeping auto-deploy is an open owner decision.
- After a deployment, confirm that the serving deployment is the expected commit,
  then that `/healthz` returns HTTP 200, every migration name in the deployed
  source (seven on current main after decision 013) and the expected `mandate`.
  Decision 013 reached main at 15:49 -0400 on 2026-10-08; the single public health
  GET at 16:46:22 -0400 returned HTTP 503, leaving rollout and inventory unverified.

### Migrations and rollback

- The migrator holds an advisory lock, records checksums and rejects edited or
  unknown applied migrations. There are no down migrations. Never edit an applied
  migration; add a new numbered file.
- Rolling back to an earlier image does not revert the schema. If a migration
  fails, fix forward with a reviewed migration or an owner-approved reconciliation
  transaction (as on 2026-10-07) and record it in
  [release verification](release-verification.md).

### Backups

- Take a Postgres backup and restore it to a separate database before schema
  changes and before the first non-test site. A backup schedule is not evidence
  until a restore succeeds.
- Each client PocketBase backs up daily at 03:00 UTC to the `PB_BACKUP_*` bucket,
  keeping seven snapshots. No remote restore has been executed.

### Site workflow switch

- Every site variable must be set before the site workflow is enabled; a missing
  required value stops startup when both flags are true. Current main requires
  both `SITE_WORKFLOW_ENABLED=true` and `SITE_DRAFTS_ENABLED=true`; neither
  production flag is verified by the failed health request.
- Setting either flag to `false` and redeploying hides the site tools and does not
  start the job worker. Queued jobs remain in Postgres. An interrupted deployment
  becomes `unknown` and needs owner reconciliation as described in
  [site operations](sites.md#exact-deployment-cleanup-and-administration).
- Do not change `SITE_DEPLOY_ENVIRONMENT` while non-test sites exist; see the
  [production test procedure](sites.md#production-test-procedure).

### Cleanup

- Tester sites: `tester.reset` with `RESET <siteId>` deletes the Railway project,
  PocketBase volume and bucket artifacts (`drafts/<UUID>/` and `specs/<UUID>/`),
  keeping audit and approval history. The bucket credential must allow listing and
  deleting prefixes; a listing returned `AccessDenied` on 2026-10-08.
- Projects left by a failed fixture or created outside the platform: review the
  resource IDs privately, confirm they are not in `SITE_PROTECTED_PROJECT_IDS`,
  then remove them in Railway with the owner's approval, together with matching
  bucket prefixes.
- Non-test sites have no cleanup tool.

### Credentials

- Rotate `RAILWAY_API_TOKEN`, `SITE_BUCKET_*`, `OPENAI_API_KEY` and the Google
  OAuth client at the provider, update the Railway variables and redeploy.
- `PB_BACKUP_*` values are copied into every client CMS service; a rotation must
  also update each of those services.
- Keep `SITE_CREDENTIAL_KEY` while any job is pending; it encrypts initial CMS
  passwords until they are delivered.
- `BETTER_AUTH_SECRET` protects sessions, OAuth context and stored signing keys;
  plan its rotation as a maintenance event.
