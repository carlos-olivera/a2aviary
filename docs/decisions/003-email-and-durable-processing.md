# 003 — Signed email and durable processing

Date: 2026-10-03. Status: Accepted by the implementation plan.

## Decision

Publish a2aviary Email Transport v1, independently of an external A2A standard. Use JSON MIME and standard compact JWS ES256 through JOSE. Verify signed bytes directly. Owner-controlled partner grants define keys, projects, actions, destinations, expiration, revocation, and research permission. Invalid or unverified requests never create model work or arbitrary replies.

SES stores raw MIME in private S3; its S3 receipt action publishes SNS notifications to SQS. Intake validates MIME, signature, schema, authority, replay, and attachment hashes. DynamoDB transactions record inbox, replay, task, admission counter, and acceptance outbox together. Streams plus scheduled reconciliation dispatch durable work. Separate roles cover intake, execution, and outbound sending. The collector recipient has no task intake path.

## Consequences

Task state survives worker/process interruptions. External model submissions and SES sends still have ambiguous outcomes. Persist intent before submission, reconcile sessions, save tool outputs before replying to provider calls, and hold unknown budget reservations. SES acceptance is distinct from delivery. An ambiguous send is `delivery_unknown` and requires controlled recovery; exactly-once email delivery is not claimed. Content, audit, rejected mail, and DLQs have separate expiration policies.
