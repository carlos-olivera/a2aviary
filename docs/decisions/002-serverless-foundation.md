# 002 — AWS serverless foundation

Date: 2026-10-03. Status: Accepted by the implementation plan.

## Context

The landing and email worker must continue independently of a development chat, with reproducible resources and a small operating budget. The account already has a hosted zone, CDK bootstrap, GitHub OIDC provider, and SES production sending access.

## Decision

Use TypeScript AWS CDK, Node.js 22 Lambda/CI, and serverless resources in `us-east-1`. Separate website, CI identity, email/state, runtime, and controls stacks. Import shared resources rather than owning their lifecycle. Serve the apex through a private versioned S3 REST origin and CloudFront OAC, regional ACM certificate, HTTPS redirect, validated security headers, and DNS aliases. CI assumes a bucket/invalidation-only role with the exact immutable owner/repository/main OIDC subject. Infrastructure administration remains an owner path.

## Consequences

Release snapshots and manifests support rollback; immutable assets are retained for at least one year. Deployment ordering is assets first, HTML last, with serialized runs and public verification. Data and release resources are retained on deletion and require explicit cleanup. CloudFormation ownership and conflicts with existing DNS/receipt rules must be inspected before deployment. The initial cost model is an estimate, not measured monthly spend.
