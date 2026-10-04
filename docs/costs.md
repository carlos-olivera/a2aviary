# Operating costs and limits

Planning worksheet, 2026-10-04. USD; excludes tax, domain renewal, unrelated AWS services, and credits. These are estimates, not measured monthly costs.

| Component | Low-volume assumption | Planning allowance |
| --- | --- | --- |
| Route 53 | One existing public zone; low query volume | About $0.50/month for the zone |
| Secrets Manager | Four project secrets; low read volume | About $1.60/month plus requests |
| S3, DynamoDB, SNS, SQS, Lambda, API Gateway | Small text tasks and short bounded workers; on-demand billing | Usage-dependent |
| CloudFront | Small static landing; initial low traffic | Usage-dependent |
| CloudWatch | Redacted logs, eight alarms, two custom aggregate metrics | Usage-dependent |
| SES | Existing regional sending service, ordinary receipt rules; shared IPs | Account API confirms NONE (à la carte), existing VDM enabled; no new Mail Manager endpoint |
| OpenAI | GPT-6 Luna, standard tier, environment-free Agents sessions | $0.10/M input and $0.50/M output; conservatively reserve cache-write costs |
| Web search | Up to two requests per task, one built-in call per request | Tool fees plus inference; inspect actual usage |

Expected low-volume AWS cost is roughly $3–8/month. The AWS notification budget is $15/month; the application reserves a separate $10/month model allowance, giving a $25 combined operating target. Higher public traffic, unsolicited inbound messages, long logs, or provider-side execution can exceed estimates.

The runtime reserves $1 atomically before a task starts, admits at most two active model tasks, and releases unused reservation when final usage is available. Unknown usage retains its reservation. Ten accepted tasks per UTC day is an additional admission limit. There is no provisioned throughput, VPC, NAT, EC2, or paid human mailbox.

The five-minute watchdog and observed token thresholds request cancellation; delayed provider usage and cancellation can overshoot allowances. AWS budget alerts are notifications, not hard spending caps. OpenAI charges are outside AWS Budgets. Use the application ledger and owner-controlled pause switches as well as provider billing controls.

The SDK account check reports `CurrentPlan: NONE` and existing VDM enabled in this region. At low volume, published à la carte rates are $0.10/1,000 outbound recipients plus $0.07/1,000 for enabled VDM; ordinary receipt rules cost $0.10/1,000 inbound messages plus $0.09/1,000 incoming 256-KB chunks. Outbound attachment data adds $0.12/GB. Existing unrelated account features are outside this project's estimate. No pricing-plan or VDM setting was changed. [SES pricing](https://aws.amazon.com/ses/pricing/).

A working scenario is 10 tasks/month, 1,000 page views, under 1 GB CDN transfer, under 100 MB logs, and 43,200 one-second 256-MB watchdog invocations/month. Fixed planning items are approximately $0.50 zone + $1.60 secrets + $1.70 for 17 underlying standard alarm metrics across eight alarms + $0.60 two custom metrics = $4.40/month, before usage and account free-tier offsets. Allow $0.20–$3.60 for Lambda, DynamoDB reads/indexes/PITR, queues/topics, API requests, S3 requests/storage, logs, email, and website transfer to retain the $3–8 target. This scenario is sensitive to watchdog duration, table growth and unsolicited inbound volume. Web search reserves $0.01 per built-in call plus inference; model usage and tool fees are charged outside AWS. [CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/).

Sources: [Route 53](https://aws.amazon.com/route53/pricing/), [Secrets Manager](https://aws.amazon.com/secrets-manager/pricing/), [SES](https://aws.amazon.com/ses/pricing/), [OpenAI](https://developers.openai.com/api/docs/pricing). Verify rates before changing capacity or models.

## Launch evidence and billing dependency

The launch research task reported 22,556 Agents input tokens and 1,177 output tokens, with one public-research call. The conservative application ledger charge was $0.015257 including search; this is not an invoice or measured monthly spend. A separate bounded Agents smoke turn reported 6,759 input and eight output tokens.

AWS denied cost-allocation tag activation in this linked account. The management/payer account must activate `Project` before the project-tag AWS budget provides verified coverage. Failure and model-budget alarms also require the owner SNS email confirmation. Their configured state is not evidence that notifications have been received.
