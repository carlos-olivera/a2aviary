import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  StaticRailwayProvider,
  validateStaticFiles,
  validateStaticServing,
  staticDigest,
  staticHashes,
  staticRoute,
  staticChecks,
  assertStaticReport,
  staticRuntime,
  publicStaticGet,
  isPublicStaticAddress,
  canonicalJson,
} from "../dist/index.js";
const files = {
  "index.html": Buffer.from("Fictional home").toString("base64"),
  "404.html": Buffer.from("Fictional missing").toString("base64"),
  "guide/index.html": Buffer.from("Fictional guide").toString("base64"),
};
const target = {
  workspaceId: "fictional-workspace",
  projectId: "fictional-project",
  environmentId: "fictional-environment",
  serviceId: "fictional-service",
  domain: "studio.example.invalid",
  previewDomain: "studio.up.railway.app",
};
const serving = {
  caddyfile: ":{$PORT:8080} { root * /srv\n file_server }",
  runtimeImage: "caddy:2.11.2-alpine@sha256:" + "a".repeat(64),
};
function adapter() {
  let state = {
    repo: "fictional/studio",
    branch: "main",
    status: "SUCCESS",
    id: "fictional-old",
    staged: 0,
    workspace: target.workspaceId,
    environments: 1,
    domain: target.domain,
    usage: "valid",
    config: 1,
  };
  const mutations = [],
    commands = [];
  const query = async (q, v) => {
    if (q.includes("serviceDisconnect")) {
      mutations.push(v);
      state.repo = null;
      state.branch = null;
      return { serviceDisconnect: { id: target.serviceId } };
    }
    if (q.includes("project(id:"))
      return {
        project: {
          workspaceId: state.workspace,
          environments: {
            edges: Array.from({ length: state.environments }, (_, i) => ({
              node: {
                id: i ? "other" : target.environmentId,
                name: "production",
                unmergedChangesCount: state.staged,
              },
            })),
          },
          services: { edges: [{ node: { id: target.serviceId } }] },
        },
      };
    if (q.includes("environment(id:"))
      return {
        environment: {
          config: {
            services: {
              [target.serviceId]: {
                source: { repo: state.repo, branch: state.branch },
                build: { builder: "DOCKERFILE" },
                deploy: { numReplicas: state.config },
              },
            },
          },
        },
      };
    if (q.includes("domains("))
      return {
        domains: {
          customDomains: [
            { id: "custom", domain: state.domain, targetPort: 8080 },
          ],
          serviceDomains: [
            { id: "preview", domain: target.previewDomain, targetPort: 8080 },
          ],
        },
      };
    if (q.includes("deployments("))
      return {
        deployments: {
          edges: [
            {
              node: {
                id: state.id,
                status: state.status,
                meta: { commitHash: "b".repeat(40) },
              },
            },
          ],
        },
      };
    throw Error("unexpected query");
  };
  const run = async (args, cwd) => {
    commands.push(args);
    if (args[0] === "usage") {
      if (state.usage === "missing") throw Error("no billing access");
      return JSON.stringify({
        workspace: { id: target.workspaceId },
        project: { id: target.projectId },
        services:
          state.usage === "empty"
            ? []
            : [
                {
                  id: target.serviceId,
                  cpuDollars: 0.1,
                  memoryDollars: 0.2,
                  egressDollars: 0,
                  volumeDollars: 0,
                  backupDollars: 0,
                  totalDollars: 0.3,
                },
              ],
      });
    }
    if (args[0] === "metrics")
      return JSON.stringify({
        cpu: { average: 0.01 },
        memory: { average_mb: 20 },
        window: { since: "fictional" },
        visitor_requests: 99,
      });
    assert.equal(args[0], "up");
    assert.equal(args[args.indexOf("--project") + 1], target.projectId);
    assert.equal(args[args.indexOf("--service") + 1], target.serviceId);
    const docker = await readFile(cwd + "/Dockerfile", "utf8");
    assert.ok(!/RUN|npm|PocketBase/.test(docker));
    assert.equal(
      await readFile(cwd + "/dist/index.html", "utf8"),
      "Fictional home",
    );
    state.id = "fictional-new";
    if (state.status === "UNKNOWN_UPLOAD") throw Error("ambiguous upload");
    return JSON.stringify({ deploymentId: state.id });
  };
  const get = async (host, path) => {
    let name = Object.keys(files).find((p) => staticRoute(p) === path);
    return {
      status: name ? 200 : 404,
      bytes: Buffer.from(files[name ?? "404.html"], "base64"),
      headers: {
        "content-type": "text/html",
        "cache-control": "public,max-age=0",
        ...(host === target.previewDomain ? { "x-robots-tag": "noindex" } : {}),
      },
    };
  };
  return {
    state,
    commands,
    mutations,
    provider: new StaticRailwayProvider(
      {
        apiToken: "fictional",
        protectedProjectIds: new Set([target.projectId]),
      },
      query,
      run,
      get,
    ),
  };
}
test("static intake bounds safe canonical files and binds every required parity check", () => {
  assert.deepEqual(validateStaticFiles(files), files);
  assert.equal(
    validateStaticFiles({ ...files, "fonts/local.woff": "YQ==" })[
      "fonts/local.woff"
    ],
    "YQ==",
  );
  assert.equal(
    staticDigest(files),
    staticDigest(Object.fromEntries(Object.entries(files).reverse())),
  );
  assert.equal(staticRoute("guide/index.html"), "/guide/");
  assert.equal(Object.keys(staticHashes(files)).length, 3);
  for (const path of [
    "../secret.txt",
    "/absolute.txt",
    "a//b.txt",
    "a/./b.txt",
    "a\\b.txt",
    "a%2fb.html",
    ".git/config.txt",
    "node_modules/code.js",
    "script.sh",
  ])
    assert.throws(
      () => validateStaticFiles({ ...files, [path]: "YQ==" }),
      /unsafe_static_file/,
    );
  assert.throws(
    () => validateStaticFiles({ ...files, "a.txt": "YQ" }),
    /invalid_static_encoding/,
  );
  assert.throws(
    () => validateStaticFiles({ "index.html": "YQ==" }),
    /static_routes_required/,
  );
  assert.throws(
    () =>
      validateStaticFiles({
        ...files,
        "large.js": Buffer.alloc(16 * 1024 * 1024 + 1).toString("base64"),
      }),
    /static_bundle_size/,
  );
  validateStaticServing(serving);
  for (const s of [
    { ...serving, runtimeImage: "caddy:2-alpine" },
    { ...serving, caddyfile: "reverse_proxy localhost:22" },
  ])
    assert.throws(() => validateStaticServing(s), /invalid_static_serving/);
  const report = {
    version: 1,
    passed: true,
    artifactSha256: staticDigest(files),
    baselineSha256: staticDigest(files),
    checks: staticChecks(files).map((name) => ({ name, passed: true })),
    artifacts: {},
  };
  assertStaticReport(report, files, files);
  assert.throws(
    () =>
      assertStaticReport(
        { ...report, checks: report.checks.slice(1) },
        files,
        files,
      ),
    /static_verification_failed/,
  );
});
test("imported adapter permits only exact protected targets and observes staged/source/domain drift", async () => {
  const d = adapter();
  await d.provider.observe(target);
  d.state.workspace = "other";
  await assert.rejects(d.provider.observe(target), /static_target_mismatch/);
  d.state.workspace = target.workspaceId;
  d.state.environments = 2;
  await assert.rejects(d.provider.observe(target), /static_shared_source/);
  d.state.environments = 1;
  d.state.domain = "other.example.invalid";
  await assert.rejects(d.provider.observe(target), /static_domain_mismatch/);
  await assert.rejects(
    new StaticRailwayProvider({
      apiToken: "fictional",
      protectedProjectIds: new Set(),
    }).observe(target),
    /imported_target_not_protected/,
  );
  await assert.rejects(
    publicStaticGet("localhost", "/"),
    /invalid_static_host/,
  );
  assert.deepEqual(d.mutations, []);
});
test("static handoff uses only prepared bytes on the same target and records exact new deployment", async () => {
  const d = adapter(),
    expected = await d.provider.observe(target);
  await assert.rejects(
    d.provider.deploy({
      target,
      files,
      serving,
      expected,
      handoff: false,
      onDeployment: async () => {},
    }),
    /static_handoff_required/,
  );
  d.state.staged = 1;
  await assert.rejects(
    d.provider.deploy({
      target,
      files,
      serving,
      expected,
      handoff: true,
      onDeployment: async () => {},
    }),
    /static_production_drift/,
  );
  assert.equal(d.mutations.length, 0);
  d.state.staged = 0;
  let id;
  const result = await d.provider.deploy({
    target,
    files,
    serving,
    expected,
    handoff: true,
    onDeployment: async (v) => (id = v),
  });
  assert.equal(id, "fictional-new");
  assert.equal(result.deploymentId, id);
  assert.equal(result.sourceRepository, null);
  assert.equal(d.mutations.length, 1);
  assert.equal(d.commands.filter((x) => x[0] === "up").length, 1);
});
test("known failed deployment and uncertain upload have distinct recovery dispositions", async () => {
  for (const [status, error] of [
    ["FAILED", "static_deployment_failed"],
    ["UNKNOWN_UPLOAD", "static_deployment_unknown"],
  ]) {
    const d = adapter(),
      expected = await d.provider.observe(target);
    let id;
    d.state.status = status;
    // Keep the expected status matched for admission; recovery permits an already failed deployment.
    const current = await d.provider.observe(target);
    await assert.rejects(
      d.provider.deploy({
        target,
        files,
        serving,
        expected: current,
        handoff: true,
        recovery: true,
        onDeployment: async (v) => (id = v),
      }),
      new RegExp(error),
    );
    assert.equal(d.commands.length, 1);
    if (status === "FAILED") assert.equal(id, "fictional-new");
  }
});
test("service accrued costs and infrastructure metrics exclude visitor data; unavailable billing is never zero", async () => {
  const d = adapter();
  let u = await d.provider.usage(target, "2026-10");
  assert.equal(u.amount, 0.3);
  assert.equal(u.basis, "provider-accrued");
  assert.equal(u.metrics.visitor_requests, undefined);
  assert.ok(
    d.commands.some((x) => x.includes("--period") && x.includes("2026-10")),
  );
  for (const reason of ["missing", "empty"]) {
    d.state.usage = reason;
    u = await d.provider.usage(target, "2026-10");
    assert.equal(u.amount, null);
    assert.equal(u.status, "unavailable");
    assert.equal(u.metricsStatus, "available");
  }
});
test("managed static runtime defaults off and has independent activation/CMS-free configuration", () => {
  assert.equal(staticRuntime({}), undefined);
  assert.equal(
    staticRuntime({ MANAGED_STATIC_DEPLOY_ENABLED: "true" }),
    undefined,
  );
  assert.throws(
    () => staticRuntime({ MANAGED_STATIC_SITES_ENABLED: "yes" }),
    /Invalid/,
  );
  const deps = staticRuntime({
    MANAGED_STATIC_SITES_ENABLED: "true",
    SITE_BUCKET_ENDPOINT: "https://bucket.example.invalid",
    SITE_BUCKET_REGION: "fictional",
    SITE_BUCKET_NAME: "private",
    SITE_BUCKET_ACCESS_KEY_ID: "fictional",
    SITE_BUCKET_SECRET_ACCESS_KEY: "fictional",
    SITE_PROTECTED_PROJECT_IDS: target.projectId,
    OPENAI_API_KEY: "fictional",
    RAILWAY_API_TOKEN: "fictional",
  });
  assert.equal(deps.deploymentEnabled, false);
  assert.equal(deps.handoffEnabled, false);
});

test("static public fetch rejects private, reserved and IPv4-mapped IPv6 addresses while allowing public IPv4", () => {
  assert.equal(isPublicStaticAddress("69.46.46.98", 4), true);
  for (const ip of [
    "127.0.0.1",
    "10.1.2.3",
    "192.168.0.1",
    "169.254.169.254",
    "198.18.0.1",
    "192.0.2.1",
    "224.0.0.1",
  ])
    assert.equal(isPublicStaticAddress(ip, 4), false);
  assert.equal(isPublicStaticAddress("2606:4700:4700::1111", 6), true);
  for (const ip of [
    "::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "fc00::1",
    "fe80::1",
  ])
    assert.equal(isPublicStaticAddress(ip, 6), false);
});

test("static Agents verification uses trusted setup, no uploaded build execution, bounded completed-turn artifacts and session cleanup", async () => {
  const { StaticAgentsVerifier } = await import("../dist/index.js");
  let sent,
    deletes = 0;
  const report = {
    version: 1,
    passed: true,
    artifactSha256: staticDigest(files),
    baselineSha256: staticDigest(files),
    checks: staticChecks(files).map((name) => ({ name, passed: true })),
  };
  const stream = {
    withResultCollection() {},
    controller: { abort() {} },
    async *[Symbol.asyncIterator]() {
      yield {
        type: "agent.session.created",
        session: { id: "fictional-static-session" },
      };
    },
    async finalResult() {
      return { session_id: "fictional-static-session", turn_id: "completed" };
    },
  };
  const client = {
    beta: {
      agents: {
        sessions: {
          async create(body) {
            sent = body;
            return stream;
          },
          async delete(id) {
            assert.equal(id, "fictional-static-session");
            deletes++;
          },
          artifacts: {
            async *list() {
              yield {
                id: "stale",
                turn_id: "prior",
                path: "/workspace/outputs/report.json",
                size_bytes: 0,
              };
              yield {
                id: "report",
                turn_id: "completed",
                path: "/workspace/outputs/report.json",
                size_bytes: 100,
              };
            },
            async content(id) {
              assert.equal(id, "report");
              return new Response(JSON.stringify(report));
            },
          },
        },
      },
    },
  };
  const result = await new StaticAgentsVerifier(client).verify(
    files,
    files,
    serving,
  );
  assert.equal(result.passed, true);
  assert.equal(deletes, 1);
  assert.deepEqual(sent.agent.tools, []);
  assert.equal(sent.agent.multi_agent.enabled, false);
  assert.deepEqual(sent.environment.env, {});
  assert.equal(sent.environment.network.access, "restricted");
  assert.ok(
    sent.environment.setup_commands.every(
      (c) => !c.command.includes("npm run build"),
    ),
  );
  assert.ok(
    sent.environment.files.some((f) => f.path === "/workspace/verify.mjs"),
  );
  assert.ok(
    sent.environment.files.some(
      (f) => f.path === "/workspace/candidate/index.html",
    ),
  );
  assert.ok(
    !sent.environment.files.some(
      (f) => f.path === "/workspace/candidate/package.json",
    ),
  );
  report.artifactSha256 = "0".repeat(64);
  await assert.rejects(
    new StaticAgentsVerifier(client).verify(files, files, serving),
    /static_verification_failed/,
  );
  assert.equal(deletes, 2);
});
