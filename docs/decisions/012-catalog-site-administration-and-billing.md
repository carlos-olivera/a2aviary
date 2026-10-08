# 012 — Catalog site administration and billing records

Date: 2026-10-07
Status: Accepted by the owner; implementation and verification recorded separately.
Supersedes: [011](011-retired-site-adoption.md).

## Context

There are no registered client sites. The first client site will be created new through the normal catalog workflow. The former adoption implementation is preserved at [archive/imported-static](https://github.com/carlos-olivera/a2aviary/tree/archive/imported-static) and removed from the active core.

## Decision

Retain Railway, Astro, PocketBase, fixed catalog contracts and the five-stage architecture. Preserve generic protected project IDs and domains without client-specific configuration or examples.

Verified-email administrators have scoped access to approved catalog submission, build, change, deploy, artifacts and reports. Superadmin alone manages memberships and global inventory/tester operations. Membership grants no global role or exemption. Queued work rechecks live identity, role, membership, lifecycle and test classification; CMS credentials and change allowances follow the site owner.

Keep effective-dated immutable owner eligibility, operation snapshots and private UTC-month JSON/CSV reports. Owner admin/superadmin and test sites are exempt; administrator assignment is independent. Collect provider-accrued web/CMS costs and resource windows through catalog usage jobs, at most once per site/period/UTC day. Unavailable amounts stay null; shared storage and platform overhead stay unallocated. Charges, payments and tracking remain disabled.

Atomically designate the first non-test catalog site with `first_client_pilot`; retries preserve it and tester fixtures never consume or reassign it. Publish policy 1.0.1 with rationale-only corrections, unchanged limits, and untouched historical 1.0.0 artifacts.

## Consequences

Rewrite migration 006 as `006-site-administration-billing.sql` for clean databases. Production already applied the former 006 on October 7 at 21:20 America/La_Paz. Its migration inventory is incompatible: migrator and readiness must reject it until separately approved owner reconciliation. Preserve authentication, roles, OAuth, audits and infrastructure; no drop migration or production reset is performed by this delivery.

Site adoption may return later as a separate local CLI that prepares artifacts. The core alone validates and deploys. This boundary does not authorize or design a replacement.
