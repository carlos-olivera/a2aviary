# a2aviary

An open-source software platform for agent-to-agent digital work: the human defines goals and authorizes actions, their agent prepares materials, and the platform works within that mandate. Our positioning is “Your agent. Your control. Our build.” and “Open-source software that turns assistant requests into live sites — and soon more.” Website production remains coming soon, as recorded below.

Websites come first, with website production and hosting through Basic coming soon. Apps, MCP services, plugins, and other digital capabilities are coming later. **a2aviary Basic — $10/month · $100/year** is the launch software subscription for one basic marketing site. When it launches, your AI assistant submits a site kit (content, brand, pages); the software validates, builds, deploys, hosts, and applies assistant-requested updates within monthly AI-token and bandwidth credits. Credit amounts and subscription terms will be published before checkout opens. **Launching soon. Checkout opens when payments are enabled.** No checkout or Basic site production/hosting is live. Payments will use our merchant of record; preparing this copy does not enable payments.

**Initial release:** a Three.js project landing at [a2aviary.io](https://a2aviary.io), and a signed email operating foundation whose first capability analyzes a website brief. It returns goals, audience, page structure, missing inputs, assumptions, acceptance criteria, and research citations when authorized. [Release verification](docs/release-verification.md) records actual configured, deployed, verified, and blocked status. Website generation, autonomous repository engineering, the Teco pilot, and external A2A compliance remain future work.

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
2. Their agent prepares a brief, sources, questions, and acceptance criteria.
3. The platform validates access, mandate, budget, and inputs.
4. Future platform capabilities build a preview and accept authorized revisions.
5. Approvals and delivery remain recorded in the project.
6. Work resumes using stable identifiers and reauthentication.

English is the canonical language for repository documentation. The repository is the source of truth for code, contracts, and technical decisions. Conversations in the a2aviary Space do not synchronize automatically; private references may live in excluded `.local/`.

## Documentation

- [Cost transparency](COSTS.md) and the [public costs page](https://a2aviary.io/costs)
- [Vision and scope](docs/vision.md)
- [Architecture](docs/architecture/overview.md)
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
