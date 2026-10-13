# 016 — Draft-based live edits

Date: 2026-10-13. Status: owner-requested implementation, pending PR review.
No migration, rollout or hosted verification is authorized by this record.
Extends [013](013-server-drafts-and-preview.md) and implements decision 5 of
[015](015-application-types-and-categories.md).

## Decision

Use `site.edit.open {siteId, requestId}`. A distinct operation clearly selects a
live baseline and cannot select a starter, change a slug or create another site.
The draft copies live canonical content and retains server-owned references to
normalized assets in the live snapshot. No upload, normalization or asset copy
occurs on open. New uploads remain draft-local; preview copies the complete
verified asset set into its own snapshot prefix as before.

Migration 010 replaces the all-time site/draft uniqueness constraint with a
partial unique index on active drafts, adds draft baseline/asset reference/policy
columns, and marks already-deployed initial drafts completed. Historical drafts,
approvals and audits remain. No applied migration is edited. Site row locks,
optimistic revisions and actor/request receipts serialize edits. Opening a second
active draft fails; opening after discard/expiry/deployment retains the old row.
Queued, running and unknown deployments block mutation. Approval and worker
admission require the exact baseline snapshot ID as well as revision and hashes.

Every new draft uses policy 2.3.0 / contract 2.3. A 2.2 live site can be edited,
but any missing language, shell labels or presentation tokens must be supplied
before preview. No label, palette, font, motion or layout value is filled in.
The site's policy advances only after successful deployment of the newly
approved snapshot; kind and original starter ID/version never change. Existing
2.2 snapshots retain their canonical specs, approvals and stored bytes and remain
deployable. The retired change tool, validator stub and active change schema are
removed; frozen 2.2 artifacts are untouched.

Redeployment uploads the approved stored web files to the existing web service
in the same protected/isolated Railway project. It neither uploads/restarts the
CMS nor modifies CMS variables, credentials, volume or existing collection
schemas/records. A required collection may be added through the running CMS API;
removed bindings only change the web routes. The deployment call must explicitly
confirm `RETAIN_CMS_RECORDS:<specId>:<sorted removed collection IDs joined by commas>`
when it unbinds any collection. The web serves its platform CMS editor with the
current binding list. That runtime editor is separate from the exact verified
site files, as are the existing Caddy/Docker deployment wrappers.

Collection creation uses a fixed command containing only reviewed catalog
schemas, executed in the existing CMS container. Authentication uses its existing
superuser environment values, which never leave the container. The Railway CLI
requires an owner-provisioned, already-registered SSH identity and trusted host
configuration. An explicit identity skips automatic key registration. No key is
created, registered or permission-expanded by this workflow. Missing access fails
closed before web upload. Source includes the SSH client; installing credentials
or authorizing hosted collection operations remains an owner release gate.

## Accounting and history

One successful edit consumes one change under `changes.perMonth` (four), across
the owner's sites including testers, in the UTC calendar month of completion.
There is no rollover. Initial deployments, validation failures, previews,
unapproved snapshots, CMS record edits and retries do not count. Existing spec
columns are all reused: `accounting` marks an edit; `base_sha256` records the
baseline digest; `reserved` holds capacity for queued/running/unknown deployments.
Owner advisory locks serialize admission and completion. Reservations carry
across month boundaries conservatively; they are not reported as successful
usage. Definitive failures release them; unknown outcomes require reconciliation.
The spec ID deduplicates successful retries. A failed deployment may retry the
same still-current unexpired approval and bytes.

Status/inventory distinguish successful usage and capacity held. Reports include
edit snapshot history and immutable operations. Reset deletes test artifacts and
mutable drafts/specs and clears their allowance, while preserving approvals,
audits and an immutable `tester.reset.edits` operation containing redacted edit
IDs, digests and outcomes. Inventory counts and historical monthly reports read
that archived history even after reset clears the active allowance. Previously live snapshots remain stored and are never
superseded by editing a later draft.

## Deliberate follow-ups

**Public rollback is proposed, not implemented.** Add a separate immutable
release-attempt ledger, rather than reusing the unique `(spec_id, kind)` job and
its original successful accounting timestamp. Proposed `site.rollback` binds
current and target release IDs in its explicit confirmation, rechecks current
membership and stored artifact integrity, retains the original approval, uses
the web-only deployment path and records a distinct result. It must freeze active
edits and handle unknown outcomes. The owner must decide its allowance treatment
before implementation. Local Docker tests exercise restoration through the
provider primitive without rebuilding; they do not establish public rollback.

**Library field ownership is a follow-up.** The policy/compiler currently share
field definitions with library validation, example generation and fixture
compilers. Moving all fields to `library/` affects those contracts and deserves
a separate PR. This delivery does not claim that duplication is resolved.

## Evidence

See [local verification and owner gates](../evidence/site-edits/README.md).
Hosted Railway SSH, migration, exact-byte rollout, real Google approval and
provider cleanup remain separately authorized work. Nothing is for sale.
