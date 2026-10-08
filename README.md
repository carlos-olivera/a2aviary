# a2aviary

An open-source software platform for agent-to-agent digital work: the human defines goals and authorizes actions, their agent prepares materials, and the platform works within that mandate. Our positioning is “Your agent. Your control. Our build.” and “Open-source software that turns assistant requests into live sites — and soon more.” There are no registered client sites. The first client site will be created through the normal catalog workflow.

Websites come first. The client's agent supplies catalog content incrementally through server drafts. a2aviary normalizes uploaded images, generates and verifies immutable previews, obtains owner or scoped-administrator browser approval, and deploys the exact approved bytes. Both workflow and draft flags default off. [Current site operations](docs/sites.md) and [decision 013](docs/decisions/013-server-drafts-and-preview.md) define policy 2.0.0 and contract 2.0; historical intake artifacts remain frozen. Change requests are unavailable pending redesign; CMS edits remain supported. Nothing is for sale; there is no live checkout or active Paddle merchant of record. Decision 013 reached main on 2026-10-08 at 15:49 -0400; a single public health GET at 16:46:22 -0400 returned HTTP 503, leaving its production rollout, migration inventory and workflow activation unverified. Earlier catalog activation is agent-reported historical evidence. Observed operation and fixture cleanup are tracked in the [current status](docs/release-verification.md#current-status--2026-10-08). The public pricing page still shows the superseded Basic/credit copy; correcting it is a separate delivery.

**Initial release:** a Three.js project landing at [a2aviary.io](https://a2aviary.io), and a signed-email operating foundation, now a legacy path supported without extension, whose capability analyzes a website brief. It returns goals, audience, page structure, missing inputs, assumptions, acceptance criteria, and research citations when authorized. [Release verification](docs/release-verification.md) records actual configured, deployed, verified, and blocked status. Catalog website generation and hosting are implemented; current production activation is unverified. No non-test site was recorded in the last inventory. Scoped site administration and private cost reports are described in [site operations](docs/sites.md). Autonomous repository engineering and external A2A compliance remain future work.

Created by **Carlos Olivera Terrazas — Founder & Principal Architect**. Licensed Apache 2.0 since the first commit. Automated contributions identify their own author and are published through the a2aviary Operator App.

## Develop and operate

```sh
cd website
npm ci
npm run dev
```

The landing uses genuine Three.js extrusion, accessible motion controls, and SVG fallbacks. See [website setup](website/README.md), [browser verification](website/verification.md), and [landing decision](docs/decisions/001-landing-page.md).

The legacy signed-email foundation uses TypeScript AWS CDK, Node.js 22 Lambda/CI, SES/S3/SNS/SQS/DynamoDB, and OpenAI Agents API `gpt-6-luna` in environment `none`. Business state survives development-chat and worker interruptions. On this path only registered signed requests can create work. Default allowance is $1/task against $10/month model spend, within a $25 operating target for AWS and brief-analysis model spend; Railway, buckets and verification sandboxes are not yet costed. Monitored thresholds are not hard provider billing caps.

See [email foundation and limits](docs/operating-foundation.md), [email transport contract](contracts/README.md), [setup and recovery](docs/runbooks.md), and [dated cost assumptions](docs/costs.md). Deployment configuration, credentials, raw emails, results, and owner alert contacts stay private. The initial service analyzes briefs; a missing input does not authorize additional work.

The product platform runs on Railway: the `apps/platform` service (Google sign-in, OAuth, MCP, roles and the site job worker) with Postgres, plus one isolated Railway project per client site (Caddy and PocketBase). See [platform](docs/platform.md), [site operations](docs/sites.md) and the [Railway platform runbook](docs/runbooks.md#railway-platform).

## Platform vision

1. The human supplies goals and materials to their agent.
2. Their LLM incrementally applies catalog content to a server draft.
3. Images reach a shared agent/human upload session and are normalized server-side.
4. a2aviary builds and verifies an immutable revision snapshot.
5. The owner or scoped administrator approves its exact bytes through a verified browser session.
6. Explicit deployment confirmation admits those stored bytes; revisions, approvals and operation history remain recorded.

English is the canonical language for repository documentation. The repository is the source of truth for code, contracts, and technical decisions. Conversations in the a2aviary Space do not synchronize automatically; private references may live in excluded `.local/`.

## Documentation

- [Cost transparency](COSTS.md) and the [public costs page](https://a2aviary.io/costs)
- [Plan policies and site contracts](docs/plans.md)
- [Discovery platform auth, MCP and roles](docs/platform.md)
- [Catalog generation, CMS and client hosting](docs/sites.md)
- [Testers and chat-only superadmin](docs/testers-and-admin.md)
- [Vision and scope](docs/vision.md)
- [Architecture](docs/architecture/overview.md) and [interactive map](https://a2aviary.io/architecture)
- [Local development and verification](docs/local-development.md)
- [Accepted decisions and open questions](docs/decisions/README.md)
- [Roadmap and first catalog pilot](docs/roadmap.md)
- [Explored visual identity](docs/brand.md)
- [Building in public](docs/build-in-public.md)
- [Governance](GOVERNANCE.md)
- [Contributing](CONTRIBUTING.md)
- [Private vulnerability reporting](SECURITY.md)
- [Changelog](CHANGELOG.md)

## License

[Apache License 2.0](LICENSE). Dependencies retain their licenses and notices. This license does not grant rights to third-party client assets or trademarks; visual identity proposals are not automatically approved.
