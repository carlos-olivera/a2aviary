# Operating costs and limits

Planning worksheet, 2026-10-03. USD; excludes tax, domain renewal, unrelated AWS services, and credits. These are estimates, not measured monthly costs.

| Component | Low-volume assumption | Planning allowance |
| --- | --- | --- |
| Route 53 | One existing public zone; low query volume | About $0.50/month for the zone |
| Secrets Manager | Four project secrets; low read volume | About $1.60/month plus requests |
| S3, DynamoDB, SNS, SQS, Lambda, API Gateway | Small text tasks and short bounded workers; on-demand billing | Usage-dependent |
| CloudFront | Small static landing; initial low traffic | Usage-dependent |
| CloudWatch | Redacted logs, aggregate error alarm, three DLQ alarms | Usage-dependent |
| SES | Existing regional sending service, ordinary receipt rules; shared IPs | Verify the existing account's pricing plan; no new paid Mail Manager endpoint |
| OpenAI | GPT-6 Luna, standard tier, environment-free Agents sessions | $0.10/M input and $0.50/M output; conservatively reserve cache-write costs |
| Web search | Up to two requests per task, one built-in call per request | Tool fees plus inference; inspect actual usage |

Expected low-volume AWS cost is roughly $3–8/month. The AWS notification budget is $15/month; the application reserves a separate $10/month model allowance, giving a $25 combined operating target. Higher public traffic, unsolicited inbound messages, long logs, or provider-side execution can exceed estimates.

The runtime reserves $1 atomically before a task starts, admits at most two active model tasks, and releases unused reservation when final usage is available. Unknown usage retains its reservation. Ten accepted tasks per UTC day is an additional admission limit. There is no provisioned throughput, VPC, NAT, EC2, or paid human mailbox.

The five-minute watchdog and observed token thresholds request cancellation; delayed provider usage and cancellation can overshoot allowances. AWS budget alerts are notifications, not hard spending caps. OpenAI charges are outside AWS Budgets. Use the application ledger and owner-controlled pause switches as well as provider billing controls.

Sources: [Route 53](https://aws.amazon.com/route53/pricing/), [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/), [SES](https://aws.amazon.com/ses/pricing/), [OpenAI](https://developers.openai.com/api/docs/pricing). Verify rates before changing capacity or models.
