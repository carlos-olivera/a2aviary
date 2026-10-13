# Platform module boundaries and refactor verification

This is an internal refactor of the existing [platform](platform.md) and
[draft workflow](sites.md), preparing extension points for the direction in
[ADR 015](decisions/015-application-types-and-categories.md). It implements no
starters, quick previews, live editing, new tools, quotas, migrations or policy
changes. [ADR 013](decisions/013-server-drafts-and-preview.md) still governs
snapshots, browser approval and exact-byte deployment. Production status remains
in [release verification](release-verification.md).

## Tool definitions

[The registry](../apps/platform/src/tool-registry.ts) collects one definition
per tool from the discovery, workflow and administration definition modules.
Each definition contains its name, description, schema factory, roles, feature,
read-only annotation, site-failure recording flag and typed handler.
Schema factories keep the pinned plan literal and registry-derived log enum;
handlers receive the current server context. `defineTool` checks the handler's
arguments against its Zod schema before erasing the type for registration.

Registration, capabilities, consent, role admission, restricted-tool detection,
audit redaction and failure recording derive from these definitions. Features
match existing dependency availability: discovery is always available,
site workflow needs the existing runtime (both workflow/draft flags), and
site administration needs its existing administration instance. Cost refresh
also needs workflow. Tester/global administrator operations remain discovery
tools with their existing superadmin restriction. The HTTP preflight still
returns `forbidden` for a known role-restricted tool even when its feature is
unavailable, before schema validation or registration lookup.

Two compatibility details are explicit metadata:

- Registration and capability arrays previously had different orders. Separate
  order fields preserve both, including the order of `logs.query` schema values.
- Discovery-only capabilities historically advertised `library.get` although
  it was absent from `tools/list`. Its `advertiseWithoutFeature` flag preserves
  that discrepancy. It does not register or authorize a disabled handler.

The hand-maintained `TOOL_ROLES` map is removed. A derived compatibility export
with that name remains for the unchanged existing tests and source consumers;
production permission and visibility checks read definitions directly.
`change.request` retains its passthrough schema, annotations, wrapper audit and
failure recording, and throws the same `change_requests_unavailable` SiteError
in its handler. The dead `Sites.change()` method is removed.

To extend tools in a later authorized delivery, add one `defineTool` declaration
in its feature module, give it the required roles and behavior metadata, and
assign its two order positions. The registry collector and wrapper need no new
name lists or feature branches. Update behavioral snapshots deliberately when
observable behavior is authorized to change.

## Domain layout

- `src/identity/`: Google/OAuth setup, identity/role resolution, agent keys,
  audit redaction and the Store transaction facade.
- `src/admin/`: testers, global administrators, logs, catalog memberships,
  inventory and tester reset.
- `src/sites/`: draft operations/content/summaries, upload sessions,
  snapshot admission/approval/nonces/tokens, deployment admission, status,
  verified artifact persistence, worker/recovery and bounded cleanup.
- `src/billing/`: existing eligibility/operation snapshots, provider cost jobs,
  collection and private reports/CSV. Billing activation is unchanged.

`Drafts`, `Sites`, `Store` and `SiteAdministration` remain composition facades:
method delegates invoke domain functions with the same receiver and existing
method signatures. Shared context helpers are marked `@internal`; they are not
new HTTP/MCP capabilities. Old top-level module paths are two-line re-exports,
so existing tests and imports remain valid. Worker and artifact operations are
separate because their lifecycle and storage integrity checks differ from
request admission. Browser serving and draft content stay separate modules.

## Verification and sizes

Baseline: `1a09f565a2c6b81b2c0334daf46a1965349fa1f8`. The baseline snapshots were
written, run and committed in `e352ecc` (rebased as `3320272`) **before any source refactoring**.
[The snapshot test](../apps/platform/test/tool-visibility.test.mjs) exercises
four SQL-resolved roles × eight workflow/draft/administration combinations:
full `tools/list` schemas, descriptions, annotations, order and server metadata;
`capabilities.get`; and the enabled `change.request` error. It uses the real
runtime flag admission and fictional provider configuration without making
provider requests. The fixture is retained unchanged after the refactor.

The existing platform tests remain unchanged. Local Node.js 22.23.3 checks,
build and the full suite pass against disposable schemas in the dedicated
loopback Postgres database. Baseline suite: 71 passed, two opt-in tests skipped
(including the new snapshot test); final suite after rebasing onto `27ebab3`: 75 passed, the same two skipped.
The rebase includes mainline site-core/workspace boundaries and its independent
tool-list snapshot without changing the captured tool/capability fixture.
Three additional regressions cover inherited/unknown tool names, exact existing
site-failure recording with sanitized identifiers, and role revocation between
registration and handler execution.

An AST comparison against the baseline matched all 91 retained constructor and
method bodies to their moved implementations, disregarding formatting and the
audit registry identifier rename. SQL statements, statement order, locks,
transaction calls, provider calls and limits are unchanged. Delegates preserve
default arguments and invoke the same transaction owners. There are **no SQL
or transaction-boundary differences** and no migration/contract/policy edits.
Tests use fictional identities and provider doubles; these checks do not
establish hosted operation, real Google authentication or deployment.

Line counts below use newline counts (`wc -l`), including imports, comments and
facade delegates. Splitting introduces explicit imports and delegates, so the
goal is bounded responsibilities rather than fewer total lines.

| Previous module | Before | Resulting implementation modules (lines) |
| --- | ---: | --- |
| `drafts.ts` | 1,099 | `sites/drafts.ts` 457; `uploads.ts` 328; `snapshots.ts` 304; `cleanup.ts` 116; `draft-summary.ts` 70 |
| `sites.ts` | 1,084 | `sites/deployments.ts` 298; `worker.ts` 394; `artifacts.ts` 89; `status.ts` 163; `admin/inventory.ts` 100; `reset.ts` 156 |
| `store.ts` | 506 | `identity/store.ts` 303; `agent-keys.ts` 114; `roles.ts` 19; `types.ts` 19; `admin/testers.ts` 80; `administrators.ts` 97; `logs.ts` 118 |
| `site-administration.ts` | 653 | `admin/site-administration.ts` 211; `billing/eligibility.ts` 70; `costs.ts` 213; `reports.ts` 268 |
| `tools.ts` | 652 | wrapper 110; registry 39; definition types 43; discovery definitions 343; workflow definitions 283; administration definitions 89; shared schemas 97 |
| `draft-content.ts` | 366 | `sites/draft-content.ts` 368 |
| `site-pages.ts` | 297 | `sites/pages.ts` 293 |
| `auth.ts` | 35 | `identity/auth.ts` 66 |
| `audit.ts` | 95 | `identity/audit.ts` 97 |

Every platform source module is below 500 lines; the largest is
`sites/drafts.ts` at 457. Authentication/audit line growth is formatting only.
The existing real local browser regression also passes: the stored seven-page
checker report contains 52 passing checks and 14 screenshots; relative preview
routes, CSS/fonts/images, browser approval POST, upload QR and direct-open
response-header sandboxing are verified. Fictional verified sessions do not
establish real Google authentication. All six architecture drawings pass their
validation, delivery, provenance and browser gates; website check/build and
changed-document relative links pass. The integrated SVG drawings are
byte-identical to main. Source-evidence links and provenance are refreshed for
the moved modules; topology, styling and activation claims remain unchanged. Owner
review of the Operator-authored PR is the delivery boundary. Merge and
production deployment require separate authorization.
