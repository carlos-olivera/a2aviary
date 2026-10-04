# Working on a2aviary

## Context

Read README.md, docs/vision.md, and docs/decisions/README.md before proposing architecture changes. The initial operating foundation is being implemented. Read docs/release-verification.md for actual configured, deployed, verified, and blocked status; do not present proposals, examples, or simulated services as implemented features.

## Language

English is the canonical language for repository documentation, architecture records, contribution guidance, and agent instructions. Preserve established names and identifiers when translating. Use the user's preferred language in conversation unless instructed otherwise.

## Authorized work

- Preserve the user's changes and keep each delivery within the requested scope.
- Keep decisions, contracts, and technical documentation in the repository.
- Distinguish confirmed decisions, proposals, and open questions.
- AWS CDK/TypeScript, Node.js 22, and OpenAI Agents API with gpt-6-luna are accepted for this release. The external A2A standard remains open.
- Do not impose providers or tools simply because they are available in the environment.
- Do not delegate to subagents unless requested by the user or required by later applicable instructions.

## Data and publication

- Use fictional examples and verify that they contain no real client data.
- Exclude credentials, client records, and private references from Git.
- Publishing code, sending messages, or deploying must remain within the scope authorized by the user; preparing files does not perform those actions.
- Respect the Apache 2.0 license and preserve dependency licenses.
- The visual identity is being explored; do not present a proposed logo or palette as approved.

## Verification

- Check relative links and document consistency when they change.
- Once code exists, use checks relevant to the modified behavior and record how it was verified.
- Do not create tests that merely repeat documentation text.
- Update the changelog with concrete changes and evidence; do not invent metrics.

## Local context

If `.local/space.md` exists, it contains the workspace Space reference. It is local information, not public documentation or additional authorization. A Space reference does not synchronize its content.
