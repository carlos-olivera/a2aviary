# Vision and scope

## Product

**Your agent. Your control. Our build.**

Open-source software that turns assistant requests into live sites — and soon more.

We are building an open-source software platform for agent-to-agent digital work. “Agency” is branding and a metaphor for coordinated digital work. The client talks to their usual AI assistant; that agent prepares materials, coordinates with the platform, and presents results and decisions to the human. Websites are the first planned catalog item; website production is coming soon. Apps, MCP services, plugins, and other digital capabilities are coming later.

The platform is intended to provide production, verification, and continuity within the client's mandate, budget, and approvals. Verified website brief analysis is discovery, not implemented website production; actual release status is recorded in [release verification](release-verification.md).

## Owner-approved pilot direction — 2026-10-06

The client agent understands intent, performs research, prepares images and copy,
and produces a fixed-catalog HTML preview for human approval before submission.
a2aviary validates a structured site spec against a versioned plan policy and
will generate/deploy the result faithfully using Astro components/design tokens.
Pilot production does not research, OCR, edit images or interpret free text.
Legacy `website.brief.analyze` remains supported without extension.

[Phase 1 contracts](plans.md) define schemas, manifests, local validators and
fictional examples. [Phase 2 auth/MCP](platform.md) is deployed on Railway (owner-reported);
authenticated client connections are not yet independently recorded. [Phase 3](sites.md) adds catalog generation, verification, PocketBase and Railway client-site provisioning; earlier workflow activation on 2026-10-08 is agent-reported, while current activation is unverified after the public HTTP 503 (see [current status](release-verification.md#current-status--2026-10-08)). [Phase 4](testers-and-admin.md) adds free staging-only testers and audited chat-only superadmin operations; activation and provider cleanup verification remain separate. Fixed monthly change requests replace credits for this pilot;
CMS content edits will not consume that allowance. Limits are set in web-simple
policy 1.0.1. Nothing is for sale; no live checkout or active Paddle merchant
of record exists. Earlier Basic pricing/credit presentation is historical and
the public pricing page still shows it; correcting that copy is a separate delivery.

## Hypotheses to test

- The client agent can prepare a usable brief and operate the integration.
- Preparing materials on the client's side reduces duplicated work and total cost.
- The project survives the end of a session and can be recovered by another authorized agent.
- The service can sustain quality and margin with measurable costs and support effort.

## Initial scope

There are no registered client sites. The first client site will be created new through the normal catalog workflow, with scoped administrators, recorded owner billing eligibility and private costs. Site adoption is retired; see [decision 012](decisions/012-catalog-site-administration-and-billing.md).

The owner selected an MCP connector for the pilot; Phase 2 deployment is owner-reported,
while current site activation is unverified after the health failure. The client agent must have real tools to call an implemented service; instructions and contracts do not replace those capabilities.

## Continuity

The platform retains the current state. Callbacks and polling are proposed task-tracking paths; an email to the human and a portable Resume Package are proposed recovery paths. The package contains no secrets and does not grant access by itself. The implemented signed-email task/status and recovery foundation is documented in [release verification](release-verification.md).

## Context sources

The foundation comes from the owner's original website-agent brief and the owner decisions recorded from 2026-10-03 onward, later extended to applications and digital services. That history combines recovered notes with proposals; it does not establish a deployed implementation or finalized operational agreements. Provider options and pricing must be verified when making technical decisions.

## Current initial-site boundary — 2026-10-08

Decision [013](decisions/013-server-drafts-and-preview.md) moves draft persistence, image normalization, preview generation and browser approval to the server. The client's LLM supplies catalog content incrementally. Approval binds an immutable revision and exact artifact; deployment does not rebuild. Both flags default off in source, change requests await redesign, and decision 013 reached main at 15:49 -0400 on 2026-10-08. Its production rollout and migration inventory remain unverified after the public health HTTP 503 at 16:46:22 -0400; see the [current status](release-verification.md#current-status--2026-10-08). See [current workflow](sites.md) and [observed release evidence](release-verification.md).
