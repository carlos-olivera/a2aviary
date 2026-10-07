# Local development

The local environment deploys the shared CDK constructs and runs the production
Node.js workers against disposable LocalStack resources. OpenAI and GitHub are
safe stand-ins. This verifies the application path, not AWS production delivery,
IAM enforcement, billing, or the customer-site pilot. Carlos reports that pilot
deployed and in progress; its independently verified cloud evidence is separate.

## Prerequisites and quickstart

Use Node.js 22 (including npm), Docker with Compose, and Git. Allow several GB of
Docker disk/memory. Initial dependency and container downloads need internet;
no AWS account, OpenAI key, GitHub credentials, LocalStack signup, or license
key is required. Run from the repository root:

```sh
npm --prefix infra run local:quickstart
```

This installs locked dependencies, starts Compose, builds the website and
services, bootstraps/deploys local CDK stacks, and runs the integration test.
Visit [the local website](http://localhost:8080) and
[architecture](http://localhost:8080/architecture). Leave Docker running to
inspect the site; remove only this disposable environment with:

```sh
npm --prefix infra run local:down
```

Individual commands are `local:up`, `local:deploy`, `local:seed`, `local:test`, and
`local:down`, each run with `npm --prefix infra run`. `local:test` sends its own
fresh signed fixture; a separate seed is optional. Only one integration test may
run at a time. Repeated seeds consume the real application admission allowances;
use down/up/deploy for a fresh disposable environment rather than increasing limits.

## Configuration and boundaries

[.env.local.example](../.env.local.example) lists the accepted defaults. An
optional ignored `.env.local` may contain those settings; no copy is necessary.
Only fake credentials and the Compose loopback endpoints are accepted. Local
commands discard production profile/configuration selectors and never read
`.local/deploy.json`. Production workers reject local endpoint overrides unless
explicitly running the local target. Do not run the production `deploy` script
for local development.

The pinned Community image is 4.12.0, locked to its pulled digest. It is the
legacy token-free distribution and receives no future updates/backports; see
[LocalStack's distribution transition](https://blog.localstack.cloud/the-road-ahead-for-localstack/).
Docker's socket is mounted so LocalStack can start Lambda containers. Run this
trusted checkout on a development machine; ports bind only to loopback. The
Compose project/network name is fixed, so one checkout owns the environment at
a time. Images/packages may be downloaded; the application endpoints are local.

Generated identities, signing keys, synthetic AWS identifiers, deployment
outputs and detailed command diagnostics stay in ignored `.local/local/` or
Docker memory. Fixtures are fictional and contain no real client material.
Public output includes only sanitized assertion summaries. Never upload raw
Docker/CDK/worker diagnostics or captured MIME as public evidence.

## Local coverage

| Area | Behavior and limits |
| --- | --- |
| Website S3 | Normal production build uploaded to local S3; local HTTP server reads those objects with the production CSP. CloudFront/TLS caching is not emulated. |
| Signed email receipt | Community CFN does not provision receipt rules/configuration sets; local deploy materializes them through SES v1 from the synthesized CDK specification. The local adapter reads the active rules, stores raw MIME using their S3 actions, and publishes their SNS notifications. It does not receive internet email, authenticate SMTP, or prove SPF/DKIM/DMARC. |
| Processing | SNS/SQS, intake, DynamoDB/Streams, dispatcher, executor, outbox/sender, EventBridge watchdog and provider cleanup run asynchronously in deployed Lambda containers. |
| OpenAI | Local HTTP session/tool/turn/item protocol returns a fixed schema-valid analysis with synthetic usage. No inference, paid call, research, or real API key. |
| Signed reply | Sender's SES v2 raw request is bridged to Community SES v1 SendRawEmail. LocalStack captures it; the test verifies the original ES256 signature and correlation. No real mailbox delivery. |
| Operator | Existing development broker mints against mock GitHub; fake PR requests are recorded. No Git push, real PR, owner approval, or deployment is simulated as real. |
| Human support | Separate support storage/ledger/queue/worker are deployed. The signed-agent fixture does not establish support inbox/attachment/reply delivery. |
| Retention | S3 seven/thirty-day policies, state TTL, ninety-day audit/replay policies, log retention and fourteen-day DLQs remain configured. Expiry is asynchronous; elapsed-day deletion is not tested. |
| Controls | CloudWatch alarms/logs and scheduled watchdog run as supported. Alarm existence/log activity do not prove AWS alarm evaluation or owner notification. |
| Cloud-only | CloudFront, Route 53, public TLS/DNS, production OIDC, Operator public API hosting, AWS billing budgets, real SES delivery and owner notifications are skipped. |
| Separate local tooling | Auth/MCP and durable platform jobs use the platform Postgres setup; Astro verification and PocketBase/Caddy use generator/site tooling. See [platform](platform.md), [sites](sites.md), and [tester/admin](testers-and-admin.md) instructions. They are not started or tested by the AWS quickstart. |
| Planned | Payments/checkout and future customer apps, MCP products and plugins. The implemented platform MCP connector is separate from those future products. |

## Verification and contributing

`local:test` checks completed analysis, stored input/result, provider cleanup,
released concurrency, signed/correlated reply, duplicate/tamper handling,
mock broker/PR recording, scheduled watchdog observation and configured alarms/
retention. It fails on assertion failure or bounded timeout. A failing command
prints a sanitized error and leaves private diagnostics available locally.

The PR integration workflow is **advisory/non-blocking initially**, with a
bounded timeout and unconditional cleanup. Existing required checks and branch
protection are unchanged. Authors must still pass `local:test` and regenerate
architecture for infrastructure/service changes. The required source-fingerprint
check rejects a stale map without downloading Archify in CI.

## Architecture regeneration

Use the [five-stage membership manifest](architecture/stages.json),
[editable overview](architecture/map.json), five candidates in
`docs/architecture/diagrams/`, and [coverage/status metadata](architecture/coverage.json).
Assign each technical node to exactly one stage. Labeled boundary nodes link to
another stage; implementation/deployment status stays separate from local coverage.
The signed-email diagrams are explicitly legacy pathways. Update source ranges,
boundaries and notes against committed code. Commit source changes first so
Archify validates references against a real revision.

Install Archify in a temporary directory outside the checkout:

```sh
npx skills add tt-a1i/archify --skill archify --agent codex --copy --yes
```

Read its SKILL.md and repository/authoring references. Set the manifest and all six
candidates to the same committed source revision. With
`ARCHIFY_UPDATE_CHECK_DISABLED=1`, finalize the overview and every stage candidate
using `finalize architecture <candidate> <output> --repo-root <checkout> --quality
showcase --json`. Use each candidate's metadata output path. All four gates must
pass for all six drawings; inspect any perceptual review recommendation. From the
repository root, integrate those artifacts and their matching receipts:

```sh
node website/scripts/integrate-architecture.mjs
npm --prefix website run check
npm --prefix website run build
```

An optional argument selects a directory containing the six raw HTML files and
receipts. Integration extracts generated SVG, namespaces its IDs, adds accessible
stage controls and native JavaScript-free disclosures, and records candidate,
manifest, coverage, asset and source fingerprints. The initial page contains no
active technical panel; switching stages replaces the diagram/evidence and resets
its disclosures. Preserve MIT notices and same-origin assets, inspect desktop and
mobile behavior under production CSP, run `website/scripts/verify-architecture.js`
through Playwright CLI against the local build, and remove the temporary skill.
Commit neither its package nor dependencies. Freshness covers infrastructure,
services, platform, generator, policy/contract sources and local tooling without
installing Archify in CI.

## Troubleshooting

- **Node version:** select Node 22 before running npm commands. Global Node or
  CDK installations are not used by the local wrapper.
- **Ports/project already owned:** stop the previous checkout's local Compose
  environment; do not remove unrelated containers.
- **Docker or Lambda timeout:** check Docker health/disk/memory and private
  diagnostics. Initial Lambda image pulls can be slow. Do not replace queue/
  stream processing with direct handler calls to make a test pass.
- **Interrupted deployment/test:** run down, then quickstart. This clears the
  disposable stacks, keys and test lock; it does not touch cloud resources.
- **Missing architecture in an old build:** rebuild/deploy the current checkout.
- **Unsupported provider behavior:** keep the named cloud-only/adapted boundary
  explicit. A passing local test is not production release verification.
