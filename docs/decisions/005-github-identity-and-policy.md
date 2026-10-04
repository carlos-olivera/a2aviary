# 005 — GitHub operator identity and trusted policy

Date: 2026-10-03. Status: Accepted by the implementation plan; activation requires verified App installation and repository protection.

## Decision

Create a private a2aviary Operator App owned by Carlos Olivera, installed only on this repository. Store private key and webhook secret in Secrets Manager; fixed-role credential brokers mint short-lived installation tokens. Development has contents/pull requests write and Actions read. Trusted policy has checks write and contents/pull requests read. Neither has administration/workflow modification. The brief runtime receives no GitHub token.

Run policy evaluation in deployed Lambda, outside PR-controlled code, with verified webhook signatures. Evaluate all paths and rename origins. Governance, license, agent instructions, workflows, infrastructure, credential/policy/security code, and dependency/build controls require Carlos's approval for the current head. Bind the required policy check to the App, also require CI, deny force pushes/deletion, and give the App no bypass. Routine changes may merge only when enforced checks pass. Agent statements and labels confer no authority.

## Consequences

Initial automated commits identify the real automation actor (`Codex Bootstrap`); publication through Carlos's authenticated account is recorded separately. App registration/installation may require owner interaction. Until enforcement is verified, autonomous merging remains disabled. Automation cannot manufacture Carlos's approval by using his login to submit a review. The accepted design is broader than the brief runtime's implemented capability.
