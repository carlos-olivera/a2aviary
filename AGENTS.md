# Working on a2aviary

## Context

Read README.md, docs/vision.md, and docs/decisions/README.md before proposing architecture changes. The AWS foundation and the Railway platform are deployed, and the catalog site workflow is enabled in production (2026-10-08). Read docs/release-verification.md for actual configured, deployed, verified, and blocked status; do not present proposals, examples, or simulated services as implemented features.

## Language

English is the canonical language for repository documentation, architecture records, contribution guidance, and agent instructions. Preserve established names and identifiers when translating. Use the user's preferred language in conversation unless instructed otherwise.

## Authorized work

- Preserve the user's changes and keep each delivery within the requested scope.
- Keep decisions, contracts, and technical documentation in the repository.
- Distinguish confirmed decisions, proposals, and open questions.
- Accepted stack: AWS CDK/TypeScript, Node.js 22 and the OpenAI Agents API with gpt-6-luna (decisions 002–004); Railway, Postgres, Better Auth, MCP, Astro and PocketBase for the platform and client sites (decisions 008–009). The external A2A standard remains open.
- Do not impose providers or tools simply because they are available in the environment.
- Do not delegate to subagents unless requested by the user or required by later applicable instructions.

## Data and publication

- Use fictional examples and verify that they contain no real client data.
- Exclude credentials, client records, and private references from Git.
- Publishing code, sending messages, or deploying must remain within the scope authorized by the user; preparing files does not perform those actions.
- Respect the Apache 2.0 license and preserve dependency licenses.
- The visual identity is being explored; do not present a proposed logo or palette as approved.

## Persistent owner instructions for future tasks

Confirmed by the owner on 2026-10-05; apply to future work in this project unless the owner explicitly changes the scope or rules.

- For authorized implementation deliveries, use a `codex/` feature branch and a pull request. Never push directly to `main`.
- Publish branches and create PRs only through the **a2aviary Operator App** (`app/a2aviary-operator`, PR author `a2aviary-operator[bot]`). Never use Carlos Olivera Terrazas's personal GitHub login or credentials as a fallback.
- The owner authorized enabling the existing Operator development broker for App-authored PRs. Keep repository auto-merge **disabled**. Verify current access and settings rather than treating this recorded authorization as proof of live configuration; do not expand App permissions or bypass policy checks.
- After opening the PR, stop for the owner's review and approval. Do not manufacture owner approval, merge, or deploy unless separately and explicitly authorized.
- Complete relevant local checks before publication. In the PR, describe the changes, observed verification, and remaining owner-only actions. Do not equate a branch, PR, successful build, or provider configuration with deployment or verified operation.
- Use **Carlos Olivera Terrazas** in project attribution and public/legal content. Preserve established GitHub usernames, URLs, App slugs, and other stable identifiers.
- Human support and privacy/refund contact use **hello@a2aviary.io**. **agent@a2aviary.io** is the registered signed-agent pipeline, not human support. Do not claim mailbox delivery until verified.
- Do not invent commercial prices or metrics. Until a real catalog and sales readiness are confirmed, clearly state that nothing is for sale and there is no live checkout or active Paddle merchant of record; distinguish verified brief discovery from future agency services. Record later status changes only against evidence.
- Do not add infrastructure, analytics/tracking, payment integrations, or unrelated branding outside the explicitly authorized task scope. Preserve Apache 2.0 and dependency licenses, exclude secrets and client data, and keep English documentation and confirmed/proposed/unverified distinctions.

## Verification

- Check relative links and document consistency when they change.
- Once code exists, use checks relevant to the modified behavior and record how it was verified.
- Do not create tests that merely repeat documentation text.
- Update the changelog with concrete changes and evidence; do not invent metrics.

## Local context

If `.local/space.md` exists, it contains the workspace Space reference. It is local information, not public documentation or additional authorization. A Space reference does not synchronize its content.
