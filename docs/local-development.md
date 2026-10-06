# Local development

The local environment deploys the shared CDK constructs and runs the production
Node.js workers against disposable LocalStack resources. OpenAI and GitHub are
safe stand-ins. This verifies the application path, not AWS production delivery,
IAM enforcement, billing, or the planned customer website product.

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
| Planned | Customer website production/hosting, checkout, apps, MCP services and plugins are not implemented by this environment. |

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

Use the [editable map](architecture/map.json) and
[local coverage metadata](architecture/coverage.json). Update responsibilities,
source ranges and local annotations against the changed code. Commit the source
changes first so Archify can validate references against a real revision.
Install Archify temporarily outside the checkout using:

```sh
npx skills add tt-a1i/archify --skill archify --agent codex --copy --yes
```

Read the installed SKILL.md and its repository/authoring references. Set the
map's repository revision to that source commit, then run its `finalize
architecture` command with `--repo-root`, `--quality showcase`, `--json`, and
`ARCHIFY_UPDATE_CHECK_DISABLED=1`; use the output path recorded in map metadata.
Integrate the passing generated artifact from the repository root:

```sh
node website/scripts/integrate-architecture.mjs .local/architecture/raw.html
npm --prefix website run check
npm --prefix website run build
```

Integration extracts generated SVG/CSS, adds accessible site controls and
same-origin assets, and updates source fingerprints/provenance. Preserve MIT
notices, inspect the final page under the production CSP, and remove the
session-only skill. Commit neither the skill package nor its dependencies.

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
