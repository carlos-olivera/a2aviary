# 010 — Testers and chat-only superadmin

Date: 2026-10-06. Status: owner-approved Phase 4 direction; local implementation
and staging/cloud activation evidence are recorded separately.

## Context

Phase 3 is merged into main. The owner requested a free, resettable test path
and operations through the same authenticated Claude/ChatGPT MCP connector.
Plan rules remain immutable runtime inputs, changed only by PR. Production AWS,
DNS and the production MCP origin remain outside this delivery.

## Decision

Store tester eligibility in Postgres, seeded once per unseen configured email
and manageable only by superadmin tools. Pin the sole superadmin to the existing
private configuration. Preserve invited admin roles for their own-site tools,
and restrict cross-client administration and audit reads to superadmin.

Inherit immutable test classification from sites into their specs/jobs/changes.
Use the existing pinned policy and owner-wide UTC allowance, including successful
tester changes. Publish tester sites in dedicated fixture projects on managed
Railway staging hosts; disallow every customer-domain binding. Future billing
must exclude test sites. No payments or policy/OAuth trust mutation is added.

Reset requires the exact site confirmation, a retained pre-action audit record,
no active jobs and guarded provider identity. Keep a durable resetting state
through partial cleanup. Remove the isolated project/PocketBase data, accepted
bucket artifacts and site change history, then archive the site identity. Retain
accounts, enrollment, other sites and audits. Off-volume backups/object versions
remain archived under owner-controlled retention, without deleting shared buckets.

Return bounded, role-checked site inventory/inspection and filtered audit events
with an allowlist of safe detail fields. No web admin UI or raw provider log
access is introduced. Login/consent remain the platform's only web pages.

## Consequences

Removing tester eligibility never promotes existing test sites to live sites.
An archived slug remains reserved. Explicit retries are needed after interrupted
cleanup; uncertain provider absence must be reconciled by the owner. Fixture
project deletion requires narrowly scoped Railway rights and bucket deletion
requires list/delete permission. Source tests with provider doubles do not prove
cloud cleanup. See [operations](../testers-and-admin.md) and
[release evidence](../release-verification.md).
