# Contributing

Use [GitHub issues and pull requests](https://github.com/carlos-olivera/a2aviary) for small changes with a concrete problem, resulting behavior, and relevant validation. English is the canonical documentation language. Review the [vision](docs/vision.md), [accepted decisions](docs/decisions/README.md), and [release status](docs/release-verification.md) before proposing architecture changes. There are no registered client sites; the first client site will use the catalog workflow. Current gates are listed in the [release status](docs/release-verification.md#current-status--2026-10-08).

Build/check instructions are in [runbooks](docs/runbooks.md). Use fictional examples, preserve licenses, and keep credentials, client materials, private contacts, raw emails, and operational outputs outside Git. AI-assisted contributions must identify their actual authoring actor and describe review and verification. Do not author automated changes as Carlos Olivera Terrazas.

Routine changes require CI and the trusted policy check. Sensitive paths require Carlos's approval for the current PR head, as described in [governance](GOVERNANCE.md). Agent labels, approvals, or descriptions do not grant authority. Infrastructure administration and publication must stay within the user's authorized scope.

Contributions must be distributable under Apache 2.0 while respecting dependency licenses and third-party attribution. Do not publish exploitable security details in issues; use [private security reporting](SECURITY.md).

Any PR changing `infra/` or `services/` must regenerate the source-backed
architecture page and pass `npm --prefix infra run local:test`. See
[local development](docs/local-development.md) for setup, regeneration and the
initially advisory integration CI job. Required website checks enforce map
freshness; local emulation does not establish production readiness. Changes to
represented `apps/platform/`, `packages/generator/`, `plans/` or `contracts/`
also require regeneration and their relevant local checks. The AWS quickstart
does not run the newer platform/generator/CMS tooling.
