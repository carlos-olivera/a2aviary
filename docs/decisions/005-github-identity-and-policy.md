# 005 — GitHub operator identity and trusted policy

Date: 2026-10-03. Status: Accepted by the implementation plan; activation requires verified App installation and repository protection.

## Decision

Create a private a2aviary Operator App owned by Carlos Olivera Terrazas, installed only on this repository. Store private key and webhook secret in Secrets Manager; fixed-role credential brokers mint short-lived installation tokens. Development has contents/pull requests write and Actions read. Trusted policy has checks write and contents/pull requests read. Neither default profile has administration/workflow modification; the owner-authorized opt-in exception below is separate. The brief runtime receives no GitHub token.

Run policy evaluation in deployed Lambda, outside PR-controlled code, with verified webhook signatures. Evaluate all paths and rename origins. Governance, license, agent instructions, workflows, infrastructure, credential/policy/security code, and dependency/build controls require Carlos's approval for the current head. Bind the required policy check to the App, also require CI, deny force pushes/deletion, and give the App no bypass. Routine changes may merge only when enforced checks pass. Agent statements and labels confer no authority.

## Consequences

Initial automated commits identify the real automation actor (`Codex Bootstrap`); publication through Carlos's authenticated account is recorded separately. App registration/installation may require owner interaction. Until enforcement is verified, autonomous merging remains disabled. Automation cannot manufacture Carlos's approval by using his login to submit a review. The accepted design is broader than the brief runtime's implemented capability.

## Owner-authorized workflow profile — 2026-10-13

The owner authorized a separate `development-workflows` token profile for tasks
that modify `.github/workflows`, keeping the default development profile
unchanged. The development broker requires explicit selection and a `changedPaths`
array containing a canonical `.github/workflows/*.yml` or `*.yaml` path. The
publisher supplies paths from the actual task diff. Missing/unrelated paths,
traversal and unknown profiles fail before token issuance.

This profile adds only `workflows: write` to development's contents/pull requests
write and Actions read. Both remain restricted to repository ID 1403745581 and
the existing development-enabled switch. GitHub permissions apply to the whole
repository; the path declaration is caller-supplied task context, not a GitHub
path-scoped token or independent diff authorization. Trusted callers must obtain
owner authorization for the task. The policy broker remains unchanged and does
not accept this opt-in. Token issuance records the distinct profile in audit;
responses also expose GitHub's granted permissions for verification.

The owner separately authorized deployment of only the DevelopmentBroker code
for this delivery. Main protection, current-head owner review, disabled
auto-merge and the prohibition on unauthorized merges/deployments remain in
force. No App permission or IAM trust changes are part of this code delivery.
