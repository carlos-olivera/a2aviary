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
fictional examples. Auth, MCP, site generation/deployment and PocketBase remain
future integration. Fixed monthly change requests replace credits for this pilot;
CMS content edits will not consume that allowance. Initial numerical limits await
owner PR review. Nothing is for sale; no live checkout or active Paddle merchant
of record exists. Earlier Basic pricing/credit presentation is historical and
public website copy is unchanged by Phase 1.

## Hypotheses to test

- The client agent can prepare a usable brief and operate the integration.
- Preparing materials on the client's side reduces duplicated work and total cost.
- The project survives the end of a session and can be recovered by another authorized agent.
- The service can sustain quality and margin with measurable costs and support effort.

## Initial scope

A bounded case with Teco: brief, preview production, review, approval, and delivery. The specific website scope, materials, and acceptance criteria still need to be agreed.

The owner selected a future MCP connector for the pilot; it is outside Phase 1. The client agent must have real tools to call an implemented service; instructions and contracts do not replace those capabilities.

## Continuity

The platform retains the current state. Callbacks and polling are proposed task-tracking paths; an email to the human and a portable Resume Package are proposed recovery paths. The package contains no secrets and does not grant access by itself. The implemented signed-email task/status and recovery foundation is documented in [release verification](release-verification.md).

## Context sources

The foundation comes from the recap of the conversation originally titled “Agente para páginas web” (Website agent), the user's decisions in this session, and the current a2aviary Space introduction, which extends the vision to applications and digital services. The recap combines recovered history with proposals; it does not establish a deployed implementation or finalized operational agreements. Provider options and pricing must be verified when making technical decisions.
