# a2aviary

An autonomous web agency designed to work with the client's assistant: the human defines goals and authorizes actions, their agent prepares the brief, and the agency builds and manages the website.

Chosen domain: **a2aviary.io**. The domain does not imply that a service has been deployed.

## Status

The agency is in the design phase. This repository records the vision, decisions, and pilot scope, and now includes a runnable static project landing page. No operational agency API, pilot website, or verified deployment is provided.

The project has been licensed under Apache 2.0 since its first commit. The goal is to build in public and publish the repository; remote publication is a separate step from local preparation.

## Landing page

The [static landing page](website/README.md) introduces the project with a genuine
Three.js bird sculpture, accessible motion controls, and SVG fallbacks.

```sh
cd website
npm ci
npm run dev
```

See [setup and deployment](website/README.md),
[verification results](website/verification.md), and the
[landing decision](docs/decisions/001-landing-page.md). Production builds are
prepared for `a2aviary.io`; hosting and DNS configuration are still required.

## Planned workflow

1. The client provides goals and materials to their own agent.
2. The agent prepares a brief with sources, open questions, and acceptance criteria.
3. The agency validates access, mandate, budget, and inputs.
4. The agency builds a preview and receives revision requests.
5. Approvals and delivery are recorded in the project.
6. Work can resume after an interruption using stable identifiers and reauthentication.

## Principles

- Autonomy within agreed permissions and budget.
- Prepare materials on the client agent's side first.
- Business state independent of the chat and AI runtime.
- Initial integration through a skill and API; the A2A standard remains to be chosen.
- Asynchronous and idempotent operations.
- Open source code and fictional examples; private client data and materials.
- Quality, costs, and support effort measured through a pilot.

## Documentation

English is the canonical language for project documentation.

- [Vision and scope](docs/vision.md)
- [Proposed architecture](docs/architecture/overview.md)
- [Decisions and open questions](docs/decisions/README.md)
- [Roadmap and Teco pilot](docs/roadmap.md)
- [Visual identity exploration](docs/brand.md)
- [Building in public](docs/build-in-public.md)
- [Contributing](CONTRIBUTING.md)
- [Reporting vulnerabilities](SECURITY.md)
- [Changelog](CHANGELOG.md)

## Working organization

This repository is the source of truth for code, contracts, and technical documentation. The a2aviary Space is used for conversations, product decisions, and progress tracking; decisions that affect implementation are transferred to versioned documents.

Machine-specific references and private Space links can be kept in `.local/`, which is excluded from Git. There is no automatic synchronization between the folder and the Space.

## License

Apache License 2.0. See [LICENSE](LICENSE). Dependencies retain their own licenses. Permissions to use the name, logo, and client materials must be documented separately; this license does not grant rights to third-party assets.
