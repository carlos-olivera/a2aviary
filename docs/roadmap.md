# Roadmap and first catalog pilot

## Foundation

- [x] Record the vision, proposed architecture, and decisions.
- [x] Choose the license for the first commit.
- [x] Publish the remote repository and enable private security reports.
- [ ] Confirm the initial visual identity.

## First verifiable workflow

- [ ] Agree on the first new catalog-site brief and website acceptance criteria.
- [ ] Define the mandate, budget, and approval responsibilities.
- [ ] Specify the minimum contract and client agent capabilities.
- [ ] Compare execution options using a bounded task.
- [x] Build an experiment that receives a fictional brief, reports state, and returns a result.
- [ ] Deliver a pilot preview, collect a revision request, and record approval.

## Continuity and evaluation

- [ ] Recover work after closing a session.
- [ ] Test polling and callbacks when a compatible endpoint exists.
- [ ] Validate a Resume Package without secrets.
- [ ] Verify idempotency and revocation.
- [ ] Measure costs by stage, time, revisions, quality, and support.

No delivery dates have been committed; operating limits follow [decision 004](decisions/004-openai-runtime-and-limits.md) and [plans](plans.md). Each milestone requires reproducible evidence before it is marked complete.

## Accepted initial release

Publish the licensed repository and landing, then deploy the signed email and durable brief-analysis foundation under the [accepted release decisions](decisions/README.md). Release completion requires independent controlled email execution/recovery and active operational controls, as recorded in [verification evidence](release-verification.md). Phase 3 adds opt-in [catalog site jobs](sites.md); live cloud verification and activation are separate gates. Phase 4 adds [staging-only testers and chat-only superadmin](testers-and-admin.md); rollout and live cleanup proof remain separate gates. There are no registered clients. The first site will be created through the catalog workflow; [administration and billing](decisions/012-catalog-site-administration-and-billing.md) are retained. Earlier production schema reconciliation, workflow activation and a passing hosted fixture are recorded (owner- and agent-reported). Decision 013 is now on main, but current health, migration 007 and activation remain unverified after the public HTTP 503; a non-test site, remote backup/restore and the [open gates](release-verification.md#open-gates-before-the-first-client-site) remain.
