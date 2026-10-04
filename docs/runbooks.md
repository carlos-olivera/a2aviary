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

The example synth does not deploy. For tests, use `A2AVIARY_CONFIG=config.example.json`. Different concurrent CDK commands must use separate output directories. Owner review of the diff is required before future infrastructure changes; the initial deployment was explicitly authorized in the release plan.

Transfer an OpenAI key directly from a private file, create the ES256 service signing secret, and initialize disabled switches:

```sh
node services/scripts/setup.mjs seed /absolute/private/openai-key-file
node services/scripts/setup.mjs test-partner
node services/scripts/setup.mjs switches on
```

`seed` creates a new signing key and must not be rerun casually. Publish its public key and distribute rotations to partners before switching signing credentials. The test partner expires after seven days and may reply only to the collector. Replace it with individually approved grants for ongoing use. SNS email alerts require confirmation in the owner's inbox. Verify SES identity, DKIM, MAIL FROM, MX and outbound authentication before switching DMARC from monitoring to enforcement.

## Website delivery and rollback

GitHub `main` checks build all packages before the separate OIDC deployment job. Set repository variables `WEBSITE_DEPLOYMENT_ROLE`, `WEBSITE_BUCKET`, `RELEASE_BUCKET`, and `DISTRIBUTION_ID` from the website/CI outputs. Configure GitHub's immutable subject template before relying on the role. Third-party Actions are pinned to commit IDs. PR checks have no identity-token permission or deployment credentials.

The deployment script snapshots every release file and checksums in the private release bucket, uploads fingerprinted assets first and `index.html` last, invalidates, then verifies the public revision/CTA. A failed public check restores the previous release's mutable files. Deployment jobs serialize and never delete existing assets. Keep current/rollback references indefinitely and retain other fingerprinted assets for at least 365 days; owner cleanup may remove unreferenced files older than that only after checking both manifests. No automated garbage collection is enabled initially.

For manual rollback, restore snapshot files from `releases/<commit>/` according to its manifest, preserve immutable asset keys, restore mutable files with revalidation headers, restore `index.html` last, and invalidate changed paths. Confirm `/.well-known/release.json`, public assets, DNS/TLS, and browser behavior. Record the recovered revision and incident. Do not edit a manifest to claim another commit.

## GitHub App and policy

Prepare a private registration form only after the operator API is deployed:

```sh
node services/scripts/setup.mjs app-registration
# Open .local/app-registration.html through a temporary local HTTP server.
node services/scripts/setup.mjs app-installation
```

The owner registers the private **a2aviary Operator** App (fallback name **a2aviary Operator Carlos Olivera**) and installs it only on this repository. The callback validates a one-hour nonce, exchanges the manifest, and stores the key and webhook secret directly in Secrets Manager. The owner setup command verifies the sole repository. Tokens are installation-scoped and short-lived. Only broker Lambda roles read the App key; callback can write it. Do not store keys in GitHub Actions secrets or issue a broad PAT to an agent.

Require CI `checks` and App-bound `a2aviary-policy` on `main`, deny force pushes and deletion, dismiss stale approvals, and give the App no bypass. If registration or required protection fails, leave development disabled and autonomous merge unavailable. Test both routine and protected-path PRs. Sensitive PRs require Carlos's real approval for the current head; automation must not manufacture that approval through his authenticated account.

## Switches, budgets, and credentials

`CONTROL#flags` separates admission, intake processing, and outbound sending. Edit each boolean independently with owner IAM. The setup `switches` convenience command changes all three and keeps development disabled. Admission off also causes active tasks to cancel on their next runtime check. Processing off leaves inbound work queued; sending off leaves pending outbox work queued. Watch DLQ ages during pauses. AWS budgets only notify. Application budget exhaustion stops reservations; unknown usage stays reserved. Reconcile unknown costs against provider evidence before releasing reservations. Do not reset a ledger to bypass spending limits.

Revoke an individual partner via `revoked: true`; active tasks recheck grants. Rotate/revoke the OpenAI credential at the provider and Secrets Manager. Disable App installation or revoke its key in GitHub and replace the secret; tokens expire independently. Disable workflow role trust if CI is compromised. Never print secret values, MIME, private results, or owner configuration into public evidence.

## Queue, session, and send recovery

Inspect sanitized logs and redacted audit IDs before redriving DLQs. Fix the underlying failure first, inspect message/task state, then redrive a bounded batch. Duplicate receipts reuse the inbox; terminal tasks reuse captured results; saved tool outcomes prevent repeated application calls. A scheduled watchdog recovers missed stream publications. A submission with uncertain session creation blocks instead of starting another paid task. Find the existing session by task metadata and reconcile through an owner operation.

`delivery_unknown` means an SES call may have succeeded. Examine SES delivery/bounce/complaint events and the collector or registered recipient's evidence. Never change it directly to pending or redrive it blindly. If delivery remains unknown, obtain controlled owner recovery authorization and use a new message ID, recording that duplication is possible. Bounce/complaint suppresses a destination; remove suppression only after addressing its cause.

Expired task deadlines cancel provider turns, persist a terminal notification, and schedule session cleanup. Unknown usage retains the full reservation. Check that session deletion has completed (`providerDeletedAt`) and retry cleanup after provider recovery. Provider retention controls are separate from application lifecycle expiration.

## Failed stacks and teardown

Use CloudFormation stack events and a reviewed CDK diff to repair a failed stack. Do not force-delete retained buckets/tables or imported resources to clear a deployment. Infrastructure deploys are separate from the website role. Repeated no-change deployment should not replace data resources.

For teardown, disable admission/processing/sending and development; cancel and reconcile active sessions; retain private audit/results until their scheduled expiry; deactivate only this receipt rule set; remove this project's DNS records; disable OIDC role and App installation. Disable termination protection only after owner authorization. Retained S3, DynamoDB, Secrets Manager, log groups, and release snapshots need explicit inventory and cleanup. Do not destroy the hosted zone/domain/bootstrap/OIDC provider. Document remaining resources and recurring charges.
