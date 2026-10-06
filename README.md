# a2aviary

An open-source software platform for agent-to-agent digital work: the human defines goals and authorizes actions, their agent prepares materials, and the platform works within that mandate. Our positioning is “Your agent. Your control. Our build.” and “Open-source software that turns assistant requests into live sites — and soon more.” Website production remains coming soon, as recorded below.

Websites come first. The owner-approved pilot has the client agent understand intent, research, prepare images and copy, and obtain human approval of a catalog-expressible preview before submission. a2aviary validates a structured site spec and will generate/deploy it through fixed Astro components and design tokens. It does not research, OCR, edit images or interpret free-text website instructions. [Plan policies and contracts](docs/plans.md) define Phase 1; [Phase 2 discovery auth/MCP](docs/platform.md) is implemented for local verification and prepared for Railway, with deployment and real client connections still unverified. [Phase 3 catalog generation and hosting](docs/sites.md) adds opt-in source for Astro builds, sandbox verification, PocketBase and isolated Railway projects; live cloud verification and activation are recorded separately. The pilot proposes fixed monthly change requests, replacing the earlier credit model for this plan. Nothing is for sale; there is no live checkout or active Paddle merchant of record. Public website copy remains a separate delivery.

**Initial release:** a Three.js project landing at [a2aviary.io](https://a2aviary.io), and a signed email operating foundation whose first capability analyzes a website brief. It returns goals, audience, page structure, missing inputs, assumptions, acceptance criteria, and research citations when authorized. [Release verification](docs/release-verification.md) records actual configured, deployed, verified, and blocked status. Website generation/hosting now has opt-in Phase 3 source; cloud proof and activation remain release gates. Autonomous repository engineering, the Teco pilot and external A2A compliance remain future work.

Created by **Carlos Olivera Terrazas — Founder & Principal Architect**. Licensed Apache 2.0 since the first commit. Automated contributions identify their own author; publication through an owner account is recorded separately.

## Develop and operate

```sh
cd website
npm ci
npm run dev
```

The landing uses genuine Three.js extrusion, accessible motion controls, and SVG fallbacks. See [website setup](website/README.md), [browser verification](website/verification.md), and [landing decision](docs/decisions/001-landing-page.md).

The operating foundation uses TypeScript AWS CDK, Node.js 22 Lambda/CI, SES/S3/SNS/SQS/DynamoDB, and OpenAI Agents API `gpt-6-luna` in environment `none`. Business state survives development-chat and worker interruptions. Only registered signed requests can create work. Default allowance is $1/task against $10/month model spend, within a $25 overall operating target; monitored thresholds are not hard provider billing caps.

See [architecture and limits](docs/operating-foundation.md), [email transport contract](contracts/README.md), [setup and recovery](docs/runbooks.md), and [dated cost assumptions](docs/costs.md). Deployment configuration, credentials, raw emails, results, and owner alert contacts stay private. The initial service analyzes briefs; a missing input does not authorize additional work.

## Platform vision

1. The client provides goals and materials to their own agent.
2. Their agent prepares the structured site spec and catalog-expressible preview.
3. The human approves the proposed result before submission.
4. a2aviary validates the pinned policy, spec, prepared asset bytes and approval declaration.
5. Opt-in site jobs generate, verify and deploy catalog sites and apply bounded approved changes.
6. Work and policy versions remain recorded; later auth will bind the approving human.

English is the canonical language for repository documentation. The repository is the source of truth for code, contracts, and technical decisions. Conversations in the a2aviary Space do not synchronize automatically; private references may live in excluded `.local/`.

## Documentation

- [Cost transparency](COSTS.md) and the [public costs page](https://a2aviary.io/costs)
- [Plan policies and site contracts](docs/plans.md)
- [Discovery platform auth, MCP and roles](docs/platform.md)
- [Catalog generation, CMS and client hosting](docs/sites.md)
- [Testers and chat-only superadmin](docs/testers-and-admin.md)
- [Vision and scope](docs/vision.md)
- [Architecture](docs/architecture/overview.md) and [interactive map](https://a2aviary.io/architecture) (prepared; pending approved release)
- [Local development and verification](docs/local-development.md)
- [Accepted decisions and open questions](docs/decisions/README.md)
- [Roadmap and Teco pilot](docs/roadmap.md)
- [Explored visual identity](docs/brand.md)
- [Building in public](docs/build-in-public.md)
- [Governance](GOVERNANCE.md)
- [Contributing](CONTRIBUTING.md)
- [Private vulnerability reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[Apache License 2.0](LICENSE). Dependencies retain their licenses and notices. This license does not grant rights to third-party client assets or trademarks; visual identity proposals are not automatically approved.
