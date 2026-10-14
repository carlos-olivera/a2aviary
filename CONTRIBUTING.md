# Contributing

Use [GitHub issues and pull requests](https://github.com/carlos-olivera/a2aviary) for small changes with a concrete problem, resulting behavior, and relevant validation. English is the canonical documentation language. Review the [vision](docs/vision.md), [accepted decisions](docs/decisions/README.md), and [release status](docs/release-verification.md) before proposing architecture changes. There are no registered client sites; the first client site will use the catalog workflow. Current gates are listed in the [release status](docs/release-verification.md#current-status).

Build/check instructions are in [runbooks](docs/runbooks.md). Use fictional examples, preserve licenses, and keep credentials, client materials, private contacts, raw emails, and operational outputs outside Git. AI-assisted contributions must identify their actual authoring actor and describe review and verification. Do not author automated changes as Carlos Olivera Terrazas.

Routine changes require CI and the trusted policy check. Sensitive paths require Carlos's approval for the current PR head, as described in [governance](GOVERNANCE.md). Agent labels, approvals, or descriptions do not grant authority. Infrastructure administration and publication must stay within the user's authorized scope.

Contributions must be distributable under Apache 2.0 while respecting dependency licenses and third-party attribution. Do not publish exploitable security details in issues; use [private security reporting](SECURITY.md).

## Collaborators with write access

2FA on your GitHub account is required. Start with a small first PR. Publish from
your own account on `<github-login>/<topic>` branches and open PRs against `main`.
Never push to `main` or merge; Carlos merges. GitHub may not enforce this project
rule on a personal-account repository. Never create, move or delete tags, and
agree changes to `.github/` with Carlos beforehand. Your agents identify their
real actor and never use the Operator App, its brokers or Carlos's identity;
the Operator App and `codex/` rules apply to agents acting for Carlos. Your
approvals do not authorize sensitive changes; see [governance](GOVERNANCE.md).

Use Node.js **22.23.3** and root `npm ci` for the workspaces; integration tests
need Postgres. Follow the existing [workspace CI setup](docs/runbooks.md#ci-activation-refresh--2026-10-12)
and [platform test setup](apps/platform/README.md), plus
the separate [AWS local checks](docs/local-development.md) when applicable.
Keep secrets, client data and operational outputs out of Git. Report
vulnerabilities only through the private channel in [SECURITY.md](SECURITY.md).

Any PR changing `infra/` or `services/` must regenerate the source-backed
architecture page and pass `npm --prefix infra run local:test`. See
[local development](docs/local-development.md) for setup, regeneration and the
initially advisory integration CI job. Required website checks enforce map
freshness; local emulation does not establish production readiness. Changes to
represented `apps/platform/`, `packages/generator/`, `plans/` or `contracts/`
also require regeneration and their relevant local checks. The AWS quickstart
does not run the newer platform/generator/CMS tooling.
