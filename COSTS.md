# What a2aviary costs

Updated 2026-10-04 (USD, excluding taxes). Draft for owner review.

This page lists every known cost of running a2aviary. Each amount is labeled with how we know it:

- **measured**: reported by a provider for real usage.
- **estimated**: calculated from published prices and assumptions in [docs/costs.md](docs/costs.md).
- **budgeted**: a configured allowance or cap, not spend.
- **confirmed**: the price is fixed by configuration plus published pricing (for example, free).
- **to confirm**: Carlos must check an invoice or billing dashboard.

Provider invoices are the authority. Token counts and ledger amounts from launch tests are not a monthly bill. We have no traffic, analytics or tracking figures, and we don't publish any.

## Cost sheet

| Item | Provider | Type | Amount (USD) | Source / evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Domain `a2aviary.io`, registered 2026-10-03, expires 2027-10-03 | Amazon Registrar (Route 53 Domains) | Annual | 72.00 paid (confirmed by Carlos); $71.00/year list price for renewal | WHOIS (registrar, dates); [Route 53 TLD price list](https://d32ze2gidvkk54.cloudfront.net/Amazon_Route_53_Domain_Registration_Pricing_20140731.pdf) (`.io` $71.00, not in the July 2026 price-change table); amount paid confirmed by owner | confirmed |
| TLS certificate for `a2aviary.io` | AWS Certificate Manager | Monthly | 0.00 | `acm.Certificate` attached to CloudFront in [infra/src/app.ts](infra/src/app.ts); [ACM pricing](https://aws.amazon.com/certificate-manager/pricing/): public non-exportable certificates "No cost" | confirmed |
| Route 53 hosted zone | AWS | Monthly | 0.50 | [docs/costs.md](docs/costs.md); [Route 53 pricing](https://aws.amazon.com/route53/pricing/) | estimated |
| Secrets Manager, 4 secrets (OpenAI, signing, GitHub App key, webhook) | AWS | Monthly | 1.60 | `infra/src/email.ts`; [docs/costs.md](docs/costs.md) | estimated |
| CloudWatch: 8 alarms (17 alarm metrics) plus 2 custom metrics | AWS | Monthly | 2.30 (1.70 + 0.60) | `infra/src/controls.ts`; [docs/costs.md](docs/costs.md) working scenario | estimated |
| AWS usage: Lambda (including the 1-minute watchdog), DynamoDB, SQS/SNS, S3, logs, API Gateway, CloudFront, SES | AWS | Monthly (usage) | 0.20–3.60 | [docs/costs.md](docs/costs.md) working scenario (10 tasks, 1,000 page views per month) | estimated |
| AWS actual bill since deployment (2026-10-03) | AWS | Usage | not yet known | AWS Billing / Cost Explorer for the payer account; the `Project` cost tag is not activated yet | to confirm |
| OpenAI: launch research task, 22,556 input / 1,177 output tokens, 1 search | OpenAI | Usage | 0.015257 | [docs/release-verification.md](docs/release-verification.md) (tokens provider-reported; dollars are a conservative ledger estimate) | measured tokens, estimated $ |
| OpenAI: combined-usage research task, research part only, 12,671 input / 381 output tokens | OpenAI | Usage | 0.011775 | [docs/release-verification.md](docs/release-verification.md); the task's final Agents usage was unavailable | measured tokens, estimated $ |
| OpenAI: final no-research task, 14,667 tokens (14,228 input / 439 output) | OpenAI | Usage | 0.001998 | [docs/release-verification.md](docs/release-verification.md) | measured tokens, estimated $ |
| OpenAI: smoke turn, 6,759 input / 8 output tokens | OpenAI | Usage | no dollar figure recorded | [docs/release-verification.md](docs/release-verification.md) | measured tokens |
| OpenAI: reservations held for unknown usage (4 × $1: three cancellation fixtures plus one research task) | OpenAI (internal ledger) | Reserved | up to 4.00 (ceiling, not spend) | [docs/release-verification.md](docs/release-verification.md) | budgeted |
| OpenAI: actual bill | OpenAI | Usage | not yet known | OpenAI billing dashboard | to confirm |
| OpenAI model allowance | a2aviary ledger | Monthly cap | 10.00/month; $1 reserved per task | [docs/costs.md](docs/costs.md); decision 004 | budgeted |
| AWS notification budget | AWS Budgets | Monthly alert | 15.00/month threshold (alerts only, no cap; the budget itself is free) | `infra/src/controls.ts`; [AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/) | budgeted |
| GitHub repository and Actions CI | GitHub | Monthly | 0.00 | Public repo on standard hosted runners: [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) | confirmed |
| ChatGPT Pro (Codex used to build this project) | OpenAI | Monthly subscription | 100.00/month (reported by Carlos) | Carlos's personal plan. Shared, not used only for this project; used for a2aviary since 2026-10-03 | to confirm |

## Totals

These are not invoices.

- **Paid or committed so far (known prices only): about $72.03.** That is the domain ($72.00 paid) plus OpenAI ledger estimates ($0.029030). AWS actuals, the $4.00 held reservations and the ChatGPT subscription are not included.
- **Expected monthly run-rate, project only: about $10.60–$24.00.**
  - AWS: $4.60–$8.00 estimated before free-tier credits ([docs/costs.md](docs/costs.md) headline: $3–8).
  - Domain spread over 12 months: $6.00.
  - Model: $0 to $10.00. Launch usage was about $0.03; the allowance caps it at $10.00.
- **Including the shared ChatGPT Pro subscription at its full amount: about $110.60–$124.00 per month.** We show the full $100 rather than a share, because we have no usage hours to split it by honestly.
- **Configured ceiling:** the $25/month operating target ($15 AWS alert plus $10 model allowance), plus the domain. The AWS budget only sends alerts; it does not stop spending.

## Honesty notes

- Estimates use published prices and the assumptions in [docs/costs.md](docs/costs.md). Replace them with invoice amounts once available.
- Token counts are provider-reported. Dollar figures next to them are conservative application ledger estimates, not invoices.
- Held reservations are ceilings for usage the provider has not reported yet. They are not refunds or spend, and they are released only against provider billing evidence.
- The ChatGPT Pro plan is Carlos's personal subscription, not a project-only expense.
- No metrics are invented. Anything not yet known is marked "to confirm".
