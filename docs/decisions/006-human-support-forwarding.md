# 006 — Human-support forwarding

Date: 2026-10-05

Status: Accepted for implementation by the owner's launch-copy/support plan;
prepared locally, not deployed or delivery-verified.

## Context

The repository manages inbound SES for signed-agent and controlled-test mail,
but neither source nor the observed active rule set routes hello@. Human support
must reach the private owner inbox without entering signed-agent processing.

## Decision

Add an explicit hello@ receipt rule and separate S3/SNS/SQS, delivery ledger and
Node.js 22 forwarding worker. Forward from hello@ only to private `ownerEmail`,
with a readable summary, original MIME attachment and validated reply address.
Use least-privilege support-only access. Preserve agent/test routing, including
messages addressed to multiple supported recipients.

Scan failures, malformed input, loops and oversized mail are quarantined.
Conditional delivery claims suppress duplicates; uncertain sends are held for
owner reconciliation. Expired receipts cannot resend after ledger expiration.
Support storage/ledger expire after seven days, redacted logs after thirty days,
and DLQ entries after fourteen days; owner inbox retention is separate.

## Consequences

Support forwarding adds bounded AWS resources and owner activation work. SES
acceptance is not inbox delivery. Deployment, real inbound/attachment/reply tests,
alert confirmation and inbox retention remain owner actions. The website release
workflow deploys no email infrastructure. No checkout, model execution, agent
permissions or external messaging is enabled by preparing this code.

See the [activation and recovery runbook](../runbooks.md#human-support-and-public-commercial-pages)
and [release status](../release-verification.md).
