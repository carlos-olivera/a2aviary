# 011 — Imported static sites, scoped administrators and cost records

Date: 2026-10-07. Status: owner-approved implementation direction; local evidence
and remote activation gates are recorded separately.

## Context

The owner approved bringing the existing private Teco Astro site under platform
management while retaining its source, dependencies, component tree, output,
Railway workspace/service/domain and current hosting. The private inspection
confirmed static Markdown/local assets and no CMS requirement. Initial onboarding
must observe hosting without modifying it; production handoff needs separate
explicit authorization. Teco may be called the first real client only after the
live platform inventory has been reconciled.

## Decision

Add `imported-static` beside `catalog`, with `cmsMode:none`. Store private bindings,
baseline hashes and imported releases separately from catalog specifications.
Reuse the artifact bucket, Postgres admission/audit and isolated verification
mechanism. Accept bounded prebuilt bytes; never run client build scripts. Keep
three independently disabled flags for registration, deployment and first handoff.
The imported adapter may operate only on the exact owner-registered protected
target. Ordinary catalog provision/reset continues rejecting protected projects.

Keep one site owner. Only the configured, verified superadmin may register targets
or assign/remove multiple verified-email site grants. Pending grants take effect
only after verified sign-in. Grants confer scoped access, never a platform role.
Check live membership on every request and immediately before queued provider
work. Serialized site work prevents revocation from racing an admitted mutation;
action already admitted to the provider may settle or recover after revocation.
No invitation or reporting messages are sent.

Billing eligibility follows the current owner's platform role. Admin/superadmin
owners are exempt, while tester classification remains separate. Record effective
changes and admission/execution snapshots without rewriting prior records. No
payment or retrospective charge engine is added. Collect attributable provider
costs even for exempt sites, retaining unknown costs as unavailable and shared
platform overhead as unallocated. Reports are private MCP/chat results and CSV.

For this preservation release, verification requires byte equality against the
imported baseline and zero unexplained visual/interaction differences. Retained
source commits may be redeployed or rolled back when their output preserves this
baseline. Content-changing imported releases require a later approved preview/
change contract; catalog contracts and their allowance remain unchanged.

## Consequences

A branch, passing local tests or successful registration does not establish live
platform readiness, billing access or production control. Initial handoff also
needs a pinned compatible serving image, current drift-free baseline, owner
approval, disabled legacy Git push deployment, exact deployment-ID/public-byte
checks and retained-release recovery. Unknown provider outcomes block subsequent
mutations until exact-ID reconciliation; they are never replayed automatically.
Existing contrast findings may be retained with equivalent baseline evidence;
no accessibility regression is accepted and no client styles are silently changed.

Source, assets, provider bindings, screenshots and reports stay private. Public
contracts and tests use fictional examples. Workspace migration, DNS, visitor
tracking, dashboards, outbound messages and payments remain outside this delivery.
See [operations](../managed-static-sites.md), [contract](../../contracts/managed-static/README.md)
and [release verification](../release-verification.md).

The checker records raw pixel differences. At most 100 pixels differing by no more than two channel values may be classified as observed Chromium edge quantization, and only when the entire candidate bundle is byte-identical to the baseline. Larger differences, dimension changes, DOM/focus/state differences or any changed file fail. This explained rendering noise is never used to approve changed content or styles.
