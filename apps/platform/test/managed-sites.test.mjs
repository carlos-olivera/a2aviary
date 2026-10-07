import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./helpers.mjs";
import { managedDependencies, staticFiles } from "./managed-dependencies.mjs";
const period = () => new Date().toISOString().slice(0, 7);

test("imported static sites: authenticated onboarding, memberships, parity, durable release jobs and reports", async (t) => {
  const d = managedDependencies(),
    f = await fixture(undefined, d.dependencies);
  t.after(f.close);
  const owner = await f.user("owner@example.invalid"),
    admin = await f.user("site-admin@example.invalid"),
    other = await f.user("other@example.invalid"),
    unverified = await f.user("pending@example.invalid", false);
  const managed = f.app.managed;
  let site;
  const call = async (user, name, args = {}) => {
    const r = await (
      await f.rpc(await f.token(user), "tools/call", { name, arguments: args })
    ).json();
    return r.result
      ? {
          isError: r.result.isError ?? false,
          ...JSON.parse(r.result.content[0].text),
        }
      : r;
  };
  await t.test(
    "adoption checks owner identity, baseline and first-client inventory without provider mutation",
    async () => {
      await assert.rejects(
        managed.importSite(other.id, d.input()),
        /forbidden/,
      );
      await assert.rejects(
        managed.importSite(
          owner.id,
          d.input({ expectedOwnerEmail: other.email }),
        ),
        /static_owner_identity_mismatch/,
      );
      const upload = await f.request("/api/site-releases", {
        method: "POST",
        headers: {
          authorization: "Bearer " + (await f.token(owner)),
          "content-type": "application/json",
        },
        body: JSON.stringify({ kind: "import-baseline", files: staticFiles }),
      });
      assert.equal(upload.status, 201);
      const uploaded = await upload.json();
      const input = d.input();
      delete input.files;
      site = await call(owner, "site.import", {
        ...input,
        uploadId: uploaded.uploadId,
      });
      assert.equal(site.isError, false);
      assert.equal(site.kind, "imported-static");
      assert.equal(site.cmsMode, "none");
      assert.equal(site.hostingChanged, false);
      assert.equal(site.billing.eligible, false);
      assert.equal(d.calls.deploy, 0);
      await assert.rejects(
        managed.importSite(
          owner.id,
          d.input({
            slug: "duplicate-target",
            firstClientPilot: false,
            confirmation:
              "IMPORT_SITE:duplicate-target:" + d.observation.deploymentId,
          }),
        ),
        /static_target_already_registered/,
      );
      await assert.rejects(
        managed.importSite(
          owner.id,
          d.input({
            slug: "second-studio",
            confirmation:
              "IMPORT_SITE:second-studio:" + d.observation.deploymentId,
          }),
        ),
        /first_client_reconciliation_required/,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT count(*)::int AS count FROM platform_site WHERE NOT test_mode",
          )
        ).rows[0].count,
        1,
      );
      assert.equal(
        (
          await f.pool.query(
            "SELECT count(*)::int AS count FROM platform_site_spec",
          )
        ).rows[0].count,
        0,
      );
      const list = await call(owner, "sites.list", { limit: 25 });
      assert.equal(list.sites[0].kind, "imported-static");
      assert.equal(list.sites[0].firstClientPilot, true);
    },
  );
  await t.test(
    "batch scoped grants, pending identity, owner protection and cross-site/CSV isolation",
    async () => {
      const token = await f.token(admin);
      assert.equal(
        (await call(admin, "site.status", { siteId: site.siteId })).error,
        "owned_site_required",
      );
      await managed.admins(owner.id, site.siteId, "assign", [
        admin.email,
        unverified.email,
      ]);
      assert.equal((await f.app.store.principal(admin.id)).role, "client");
      assert.equal(
        (await call(admin, "site.status", { siteId: site.siteId }))
          .currentReleaseId,
        site.releaseId,
      );
      await assert.rejects(
        managed.status(unverified.id, site.siteId),
        /verified_user_required/,
      );
      await assert.rejects(
        managed.status(admin.id, randomUUID()),
        /owned_site_required/,
      );
      await assert.rejects(
        managed.admins(admin.id, site.siteId, "assign", [other.email]),
        /forbidden/,
      );
      await assert.rejects(
        managed.admins(owner.id, site.siteId, "remove", [owner.email]),
        /site_owner_membership_reserved/,
      );
      const headers = { authorization: "Bearer " + (await f.token(other)) };
      assert.equal(
        (
          await f.request(
            "/api/site-reports/" + site.siteId + "/" + period() + ".csv",
            { headers },
          )
        ).status,
        403,
      );
      await managed.admins(owner.id, site.siteId, "remove", [admin.email]);
      const denied = await (
        await f.rpc(token, "tools/call", {
          name: "site.status",
          arguments: { siteId: site.siteId },
        })
      ).json();
      assert.equal(
        JSON.parse(denied.result.content[0].text).error,
        "owned_site_required",
      );
      await managed.admins(owner.id, site.siteId, "assign", [admin.email]);
      await f.pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1', [
        unverified.id,
      ]);
      assert.equal(
        (await managed.status(unverified.id, site.siteId)).currentReleaseId,
        site.releaseId,
      );
      await managed.admins(owner.id, site.siteId, "remove", [unverified.email]);
    },
  );
  await t.test(
    "intake refuses unsafe paths, encoding, extra verification claims, wrong origin and OAuth audience",
    async () => {
      const post = async (body, extra = {}) =>
        f.request("/api/site-releases", {
          method: "POST",
          headers: {
            authorization: "Bearer " + (await f.token(admin)),
            "content-type": "application/json",
            ...extra,
          },
          body: JSON.stringify(body),
        });
      const base = {
        siteId: site.siteId,
        sourceCommit: "a".repeat(40),
        files: staticFiles,
      };
      assert.equal(
        (await post({ ...base, report: { passed: true } })).status,
        400,
      );
      assert.equal(
        (
          await post({
            ...base,
            files: { ...staticFiles, "../secret.txt": "YQ==" },
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await post({
            ...base,
            files: { ...staticFiles, "nested/evil.js": "YQ" },
          })
        ).status,
        422,
      );
      assert.equal(
        (await post(base, { origin: "https://foreign.example.invalid" }))
          .status,
        403,
      );
      assert.equal(
        (
          await post(base, {
            authorization:
              "Bearer " +
              (await f.token(admin, {
                aud: "https://foreign.example.invalid/mcp",
              })),
          })
        ).status,
        401,
      );
      const r = await post(base);
      assert.equal(r.status, 201);
      assert.equal((await r.json()).releaseId, site.releaseId);
    },
  );
  await t.test(
    "revocation before queued work denies provider access; failed/tampered verification cannot authorize release",
    async () => {
      await managed.verify(admin.id, site.siteId, site.releaseId);
      await managed.admins(owner.id, site.siteId, "remove", [admin.email]);
      await managed.processOne();
      assert.equal(d.calls.verify, 0);
      await managed.admins(owner.id, site.siteId, "assign", [admin.email]);
      d.failVerification(true);
      await managed.verify(admin.id, site.siteId, site.releaseId);
      await managed.processOne();
      await assert.rejects(
        managed.deploy(
          owner.id,
          site.siteId,
          site.releaseId,
          "HANDOFF_SITE:" + site.siteId + ":" + site.releaseId,
        ),
        /static_verified_release_required/,
      );
      d.failVerification(false);
      d.tamperReport(true);
      await managed.verify(owner.id, site.siteId, site.releaseId);
      await managed.processOne();
      await assert.rejects(
        managed.deploy(
          owner.id,
          site.siteId,
          site.releaseId,
          "HANDOFF_SITE:" + site.siteId + ":" + site.releaseId,
        ),
        /static_verified_release_required/,
      );
      d.tamperReport(false);
      await managed.verify(owner.id, site.siteId, site.releaseId);
      await managed.processOne();
      assert.equal(
        (await managed.status(owner.id, site.siteId)).releases[0].report.passed,
        true,
      );
    },
  );
  await t.test(
    "disabled deployment/handoff, confirmation and drift are enforced; first handoff stays owner-only",
    async () => {
      const confirmation = "HANDOFF_SITE:" + site.siteId + ":" + site.releaseId;
      d.dependencies.deploymentEnabled = false;
      await assert.rejects(
        managed.deploy(owner.id, site.siteId, site.releaseId, confirmation),
        /static_deployment_disabled/,
      );
      d.dependencies.deploymentEnabled = true;
      d.dependencies.handoffEnabled = false;
      await assert.rejects(
        managed.deploy(owner.id, site.siteId, site.releaseId, confirmation),
        /static_handoff_disabled/,
      );
      d.dependencies.handoffEnabled = true;
      await assert.rejects(
        managed.deploy(admin.id, site.siteId, site.releaseId, confirmation),
        /static_handoff_disabled/,
      );
      await assert.rejects(
        managed.deploy(owner.id, site.siteId, site.releaseId, "yes"),
        /confirmation_required/,
      );
      const original = d.observation;
      d.observation = { ...original, staged: true };
      await assert.rejects(
        managed.deploy(owner.id, site.siteId, site.releaseId, confirmation),
        /static_production_drift/,
      );
      d.observation = original;
      const j = await managed.deploy(
        owner.id,
        site.siteId,
        site.releaseId,
        confirmation,
      );
      assert.equal(
        (
          await managed.deploy(
            owner.id,
            site.siteId,
            site.releaseId,
            confirmation,
          )
        ).jobId,
        j.jobId,
      );
      await managed.processOne();
      assert.equal(d.calls.deploy, 1);
      assert.equal(
        (await managed.status(admin.id, site.siteId)).handedOff,
        true,
      );
    },
  );
  await t.test(
    "unknown deployment is not replayed; reconciliation requires actual pinned deployment and retained bytes",
    async () => {
      const candidate = await managed.submit(admin.id, {
        siteId: site.siteId,
        sourceCommit: "f".repeat(40),
        files: staticFiles,
      });
      await managed.verify(admin.id, site.siteId, candidate.releaseId);
      await managed.processOne();
      const confirmation =
        "DEPLOY_RELEASE:" + site.siteId + ":" + candidate.releaseId;
      d.failDeployment(true, true);
      await managed.deploy(
        admin.id,
        site.siteId,
        candidate.releaseId,
        confirmation,
      );
      await managed.processOne();
      d.failDeployment(false);
      assert.equal(
        (await managed.status(owner.id, site.siteId)).jobs[0].state,
        "unknown",
      );
      await assert.rejects(
        managed.deploy(
          admin.id,
          site.siteId,
          candidate.releaseId,
          confirmation,
        ),
        /static_job_busy/,
      );
      const before = d.calls.deploy;
      await managed.processOne();
      assert.equal(d.calls.deploy, before);
      await assert.rejects(
        managed.reconcile(
          admin.id,
          site.siteId,
          candidate.releaseId,
          "RECONCILE_SITE:" + site.siteId + ":" + candidate.releaseId,
        ),
        /forbidden/,
      );
      const rec = await managed.reconcile(
        owner.id,
        site.siteId,
        candidate.releaseId,
        "RECONCILE_SITE:" + site.siteId + ":" + candidate.releaseId,
      );
      assert.equal(rec.applied, true);
      await managed.deploy(
        admin.id,
        site.siteId,
        site.releaseId,
        "ROLLBACK_SITE:" + site.siteId + ":" + site.releaseId,
        true,
      );
      await managed.processOne();
      assert.equal(
        (await managed.status(admin.id, site.siteId)).currentReleaseId,
        site.releaseId,
      );
    },
  );
  await t.test(
    "queued deployment revocation and concurrent admission block provider mutation",
    async () => {
      const candidate = await managed.submit(admin.id, {
        siteId: site.siteId,
        sourceCommit: "2".repeat(40),
        files: staticFiles,
      });
      await managed.verify(admin.id, site.siteId, candidate.releaseId);
      await managed.processOne();
      const confirmation =
        "DEPLOY_RELEASE:" + site.siteId + ":" + candidate.releaseId;
      const jobs = await Promise.all([
        managed.deploy(
          admin.id,
          site.siteId,
          candidate.releaseId,
          confirmation,
        ),
        managed.deploy(
          admin.id,
          site.siteId,
          candidate.releaseId,
          confirmation,
        ),
      ]);
      assert.equal(jobs[0].jobId, jobs[1].jobId);
      await managed.admins(owner.id, site.siteId, "remove", [admin.email]);
      const before = d.calls.deploy;
      await managed.processOne();
      assert.equal(d.calls.deploy, before);
      await managed.admins(owner.id, site.siteId, "assign", [admin.email]);
    },
  );
  await t.test(
    "tampered stored artifact and failed start audit prevent provider mutation",
    async () => {
      const candidate = await managed.submit(admin.id, {
        siteId: site.siteId,
        sourceCommit: "1".repeat(40),
        files: staticFiles,
      });
      await managed.verify(admin.id, site.siteId, candidate.releaseId);
      await managed.processOne();
      await managed.deploy(
        admin.id,
        site.siteId,
        candidate.releaseId,
        "DEPLOY_RELEASE:" + site.siteId + ":" + candidate.releaseId,
      );
      const key = "static/releases/" + candidate.releaseId + "/files.json",
        saved = d.data.get(key);
      d.data.set(
        key,
        Buffer.from(
          JSON.stringify({
            ...staticFiles,
            "index.html": Buffer.from("modified").toString("base64"),
          }),
        ),
      );
      const before = d.calls.deploy;
      await managed.processOne();
      assert.equal(d.calls.deploy, before);
      d.data.set(key, saved);
      await managed.verify(admin.id, site.siteId, candidate.releaseId);
      await managed.processOne();
      await f.pool.query(
        "CREATE FUNCTION reject_static_started() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.result='started' THEN RAISE EXCEPTION 'fictional audit failure'; END IF;RETURN NEW;END $$",
      );
      await f.pool.query(
        "CREATE TRIGGER reject_static_started BEFORE INSERT ON platform_site_operation FOR EACH ROW EXECUTE FUNCTION reject_static_started()",
      );
      await managed.deploy(
        admin.id,
        site.siteId,
        candidate.releaseId,
        "DEPLOY_RELEASE:" + site.siteId + ":" + candidate.releaseId,
      );
      await managed.processOne();
      assert.equal(d.calls.deploy, before);
      await f.pool.query(
        "DROP TRIGGER reject_static_started ON platform_site_operation",
      );
    },
  );
  await t.test(
    "exempt sites retain accrued costs; daily snapshots do not double count and unavailable costs remain null",
    async () => {
      await managed.refresh(admin.id, site.siteId);
      await managed.processOne();
      await managed.refresh(owner.id, site.siteId);
      await managed.processOne();
      const r = await managed.report(admin.id, site.siteId, period());
      assert.equal(r.billing.eligible, false);
      assert.equal(r.costs.data.amount, 0.37);
      assert.equal(r.costs.data.basis, "provider-accrued");
      assert.equal(r.sharedPlatformOverhead.amount, null);
      assert.equal(
        (
          await f.pool.query(
            "SELECT count(*)::int AS count FROM platform_site_cost",
          )
        ).rows[0].count,
        1,
      );
      d.failUsage(true);
      await managed.refresh(admin.id, site.siteId);
      await managed.processOne();
      assert.equal(
        (await managed.report(owner.id, site.siteId, period())).costs.data
          .amount,
        null,
      );
      const csv = await f.request(
        "/api/site-reports/" + site.siteId + "/" + period() + ".csv",
        { headers: { authorization: "Bearer " + (await f.token(admin)) } },
      );
      assert.equal(csv.status, 200);
      assert.match(csv.headers.get("content-type"), /text\/csv/);
      assert.equal(csv.headers.get("cache-control"), "no-store");
      assert.match(await csv.text(), /"unavailable"/);
      await assert.rejects(
        managed.report(owner.id, site.siteId, "2026-13"),
        /invalid_report_period/,
      );
    },
  );
  await t.test(
    "positively identified failed deployment automatically restores retained predecessor without replaying an unknown upload",
    async () => {
      const current = (await managed.status(owner.id, site.siteId))
        .currentReleaseId;
      const candidate = await managed.submit(admin.id, {
        siteId: site.siteId,
        sourceCommit: "3".repeat(40),
        files: staticFiles,
      });
      await managed.verify(admin.id, site.siteId, candidate.releaseId);
      await managed.processOne();
      d.failDeployment(true);
      const before = d.calls.deploy;
      await managed.deploy(
        admin.id,
        site.siteId,
        candidate.releaseId,
        "DEPLOY_RELEASE:" + site.siteId + ":" + candidate.releaseId,
      );
      await managed.processOne();
      d.failDeployment(false);
      assert.equal(d.calls.deploy, before + 2);
      const status = await managed.status(owner.id, site.siteId);
      assert.equal(status.currentReleaseId, current);
      assert.equal(status.jobs[0].state, "failed");
      assert.ok(
        (await managed.report(owner.id, site.siteId, period())).operations.some(
          (o) => o.kind === "site.release.recovery" && o.result === "restored",
        ),
      );
    },
  );
  await t.test(
    "interrupted verification jobs fail without replay",
    async () => {
      const candidate = await managed.submit(owner.id, {
        siteId: site.siteId,
        sourceCommit: "3".repeat(40),
        files: staticFiles,
      });
      await managed.verify(owner.id, site.siteId, candidate.releaseId);
      await f.pool.query(
        "UPDATE platform_static_job SET state='running' WHERE release_id=$1 AND kind='verify' AND state='queued'",
        [candidate.releaseId],
      );
      await managed.recoverInterrupted();
      assert.equal(
        (await managed.status(owner.id, site.siteId)).jobs[0].state,
        "failed",
      );
    },
  );
});

test("owner-role billing history applies prospectively and site grants never promote identity or exemption", async (t) => {
  const d = managedDependencies(),
    f = await fixture(undefined, d.dependencies);
  t.after(f.close);
  const owner = await f.user("owner@example.invalid"),
    client = await f.user("client-owner@example.invalid"),
    member = await f.user("member@example.invalid");
  const m = f.app.managed;
  await f.app.store.principal(client.id);
  const site = await m.importSite(
    owner.id,
    d.input({ ownerEmail: client.email }),
  );
  assert.equal(site.billing.eligible, true);
  await m.admins(owner.id, site.siteId, "assign", [member.email]);
  assert.equal(
    (await m.report(member.id, site.siteId, period())).billing.eligible,
    true,
  );
  await f.app.store.inviteAdmin(
    owner.id,
    client.email,
    "INVITE_ADMIN:" + client.email,
  );
  await f.app.store.principal(client.id);
  assert.equal(
    (await m.report(member.id, site.siteId, period())).billing.eligible,
    false,
  );
  await m.refresh(member.id, site.siteId);
  await m.processOne();
  const before = await m.report(member.id, site.siteId, period());
  await f.app.store.revokeAdminEmail(
    owner.id,
    client.email,
    "REVOKE_ADMIN:" + client.email,
  );
  const after = await m.report(member.id, site.siteId, period());
  assert.equal(after.billing.eligible, true);
  assert.equal(after.costs.data.amount, 0.37);
  assert.ok(after.eligibility.some((e) => e.reason === "owner_admin"));
  assert.ok(
    after.operations.some(
      (o) => o.kind === "site.costs.refresh" && o.billing.eligible === false,
    ),
  );
  assert.equal((await f.app.store.principal(member.id)).role, "client");
  await assert.rejects(
    f.pool.query(
      "UPDATE platform_site_billing SET eligible=true WHERE site_id=$1",
      [site.siteId],
    ),
    /immutable history/,
  );
  await assert.rejects(
    f.pool.query("DELETE FROM platform_site_operation WHERE site_id=$1", [
      site.siteId,
    ]),
    /immutable history/,
  );
  assert.ok(after.eligibility.length > before.eligibility.length);
});
