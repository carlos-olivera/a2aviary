# 004 — Agents API and operating limits

Date: 2026-10-03. Status: Accepted by the implementation plan.

## Decision

Use the current OpenAI SDK's Agents API with `gpt-6-luna`, environment `none`, disabled multi-agent delegation, asynchronous sessions, persisted session references, saved-item recovery, and successful-turn/schema-valid completion. Expose only project-scoped input retrieval and approved public research via bounded OpenAI web search. Delete sessions after durable capture; retry cleanup.

The initial capability analyzes a website brief. It does not build websites or modify repositories. Defaults: two active tasks, ten submissions/day, five minutes/task, two research requests, six application tools, 32,000 input/8,000 output monitored tokens. Reserve $1/task against $10/month application allowance within a $25 overall target. Reject new reservations on exhaustion; preserve unknown reservations. Keep admission, processing, and sending switches independent. Configure private owner failure and budget notifications.

## Consequences

Managed usage reporting and cancellation can lag; monitored thresholds are not hard billing caps. Search charges are included. Provider-side retention is independent of local deletion. Missing details are analysis output rather than authorization for more work. Cost assumptions and verification evidence must remain dated and distinguish estimates from observed usage.
