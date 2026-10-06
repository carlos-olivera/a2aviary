# Architecture

Status: broader agency design, with a scoped initial implementation described below.

The [interactive architecture map](https://a2aviary.io/architecture) is prepared for
owner review and release. It distinguishes the project landing and signed-email
foundation from planned customer products. See [local development](../local-development.md)
for the shared CDK environment, adapters and cloud-only boundaries.

## Responsibilities

```text
Human
  ↕ goals, materials, authorizations, and decisions
Client agent
  ↕ brief, sources, requests, results, and events
Agency API
  ↕ authorization and project state transitions
Work coordination
  ↕ durable tasks and production
Project workspace and execution tools
```

## Pilot direction — 2026-10-06

For the owner-approved website pilot, the client agent prepares a structured spec,
assets and a catalog-expressible preview, approved by the human before submission.
a2aviary validates the versioned policy and will generate/deploy through fixed
Astro templates. It does not research, OCR, edit images or interpret free text for
pilot production. Phase 1 provides isolated contracts/local validation; the
[Phase 2](../platform.md) implements local discovery OAuth/MCP and prepares a
Railway service. Deployment and real client compatibility are unverified;
PocketBase and website production remain future work. Existing
AWS brief analysis and signed email v1 remain supported. See [plans](../plans.md)
and [decision 007](../decisions/007-pilot-policy-and-site-contracts.md).

## Planned components

- Versioned API to create projects, submit inputs, query state, answer questions, and record approvals.
- Identity and authorization by client, project, and operation.
- Mandate defining actions, budget, validity period, and revocation.
- Structured state and event log independent of the model session.
- Task queue, retries, checkpoints, and idempotency for commercial effects.
- Artifacts and versions with project-scoped access.
- Production runtime adapter to evaluate providers while keeping execution separate from business state.
- Event and recovery channels that tolerate an unavailable client agent.

## Minimum contract to define

Each exchange should identify the schema version, project, task, operation, inputs, permissions, state, next action, and deliverables. Adoption of a specific A2A standard remains pending.

Candidate states: received, awaiting inputs, running, awaiting approval, under review, completed, recoverable failure, and canceled. Their transitions and conditions still need to be specified.

## Trust boundaries

The server verifies authorization and mandate on every operation. Files, agent messages, and web content are data; they do not expand permissions. Approvals must be tied to the version of the scope or deliverable they authorize.

The Resume Package is a portable reference for locating the project and querying its state after authentication. Switching agents requires granting the corresponding permissions.

## Pending choices

AWS CDK/TypeScript, Node.js 22, DynamoDB/SQS/S3, SES, and OpenAI Agents API are selected for the initial brief-analysis foundation. Broader agency APIs, client onboarding, website production, and the external A2A standard remain open.

## Initial release implementation

The accepted release uses AWS CDK/TypeScript, Node.js 22, signed SES email, durable DynamoDB state, and OpenAI Agents API. The implemented capability is website brief analysis only. The broader agency components above remain design direction. See [operating foundation](../operating-foundation.md), [accepted release decisions](../decisions/README.md), and [verification status](../release-verification.md) for concrete behavior and evidence.
