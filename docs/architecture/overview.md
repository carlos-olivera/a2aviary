# Architecture

Status: source-backed implementation map; customer-site pilot deployment is
owner-reported, with independent hosted verification tracked separately.

The [interactive architecture map](https://a2aviary.io/architecture) is prepared for
owner review and release. It distinguishes the project landing and signed-email
foundation from the in-progress, owner-reported deployed customer-site pilot
and future customer products. See [local development](../local-development.md)
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
a2aviary validates the versioned policy and generates fixed Astro catalog sites,
verifies approved artifacts, and provisions isolated Railway hosting with PocketBase
CMS. Auth/MCP, durable Postgres jobs, testers and chat-only superadmin source are
implemented. Carlos reports the customer-site pilot deployed and still in progress;
independent hosted end-to-end verification remains separate from this report.
Existing AWS brief analysis and signed email v1 remain supported. See
[site operations](../sites.md), [platform operations](../platform.md),
[tester/admin operations](../testers-and-admin.md), and
[release evidence](../release-verification.md#customer-site-pilot--2026-10-06-owner-reported-deployment).

## Five-stage map

The [membership manifest](stages.json) assigns each technical component to one
stage. Labeled arrows and boundary nodes show handoffs between groups.

1. **Client & Local Agent:** prepares the spec, original assets and human-approved
   preview; the legacy email client receives signed replies.
2. **Auth & Mandate Gate:** platform OAuth/MCP, ownership, role/permission policy,
   action-specific confirmations and legacy signed-email admission.
3. **Validation & Build Engine:** approved-input validation, durable jobs, Astro
   catalog generation, artifact verification and the legacy brief-analysis runtime.
4. **Live Hosting & CMS:** customer Railway/PocketBase/Caddy hosting and bounded
   content editing, plus the project's private S3/CloudFront landing delivery.
5. **Governance & Ops:** Operator/current-head approval/CI, tester administration,
   audited recovery, AWS budgets, alarms, retention and isolated human support.

The initial page shows only the five macro-stages. A selection opens one technical
panel and only its matching source evidence; switching resets disclosures.
JavaScript-free native stage disclosures retain source access. The LocalStack
quickstart is a collapsed section and covers the AWS foundation. The platform,
generator and CMS use separate local tooling; neither simulation nor an owner
report substitutes for independently observed hosted end-to-end behavior.

Payments/checkout, future customer apps, MCP products and plugins remain planned.
The implemented platform MCP connector and in-progress customer-site pilot are
separate from those future products. The external A2A standard remains open.

## Trust boundaries

The server verifies authorization and mandate on every operation. Files, agent messages, and web content are data; they do not expand permissions. Approvals must be tied to the version of the scope or deliverable they authorize.

The Resume Package is a portable reference for locating the project and querying its state after authentication. Switching agents requires granting the corresponding permissions.

## Pending choices

AWS CDK/TypeScript, Node.js 22, DynamoDB/SQS/S3, SES, and OpenAI Agents API are selected for the initial brief-analysis foundation. The website pilot adds auth/MCP, Astro and Railway/PocketBase source. Broader
customer products and the external A2A standard remain open.

## Initial release implementation

The accepted release uses AWS CDK/TypeScript, Node.js 22, signed SES email, durable DynamoDB state, and OpenAI Agents API. That AWS release implements website brief analysis. The later customer-site pilot adds the implemented source described above; owner-reported deployment and independent verification are separate. See [operating foundation](../operating-foundation.md), [accepted release decisions](../decisions/README.md), and [verification status](../release-verification.md) for concrete behavior and evidence.
