import { randomUUID } from "node:crypto";
import {
  canonicalJson,
  staticDigest,
  staticHashes,
  staticChecks,
  SiteError,
} from "@a2aviary/generator";
export const staticFiles = {
  "index.html": Buffer.from(
    '<!doctype html><html lang="en"><head><title>Fictional studio</title></head><body><main><h1>Fictional studio</h1></main></body></html>',
  ).toString("base64"),
  "404.html": Buffer.from(
    '<!doctype html><html lang="en"><head><title>Not found</title></head><body><main><h1>Not found</h1></main></body></html>',
  ).toString("base64"),
};
export function managedDependencies() {
  const data = new Map(),
    target = {
      workspaceId: randomUUID(),
      projectId: randomUUID(),
      environmentId: randomUUID(),
      serviceId: randomUUID(),
      domain: "studio.example.invalid",
      previewDomain: "studio.up.railway.app",
    };
  let observation = {
    target,
    deploymentId: randomUUID(),
    sourceCommit: "a".repeat(40),
    sourceRepository: "fictional/studio-private",
    sourceBranch: "main",
    configSha256: "b".repeat(64),
    domainsSha256: "c".repeat(64),
    staged: false,
  };
  let failVerify = false,
    failDeploy = false,
    failCapture = false,
    unknown = false,
    failUsage = false,
    tamperReport = false,
    deployPause;
  const calls = { observe: 0, capture: 0, deploy: 0, verify: 0, usage: 0 };
  const objects = {
    async put(k, b) {
      data.set(k, Buffer.from(b));
    },
    async get(k) {
      if (!data.has(k)) throw Error("missing artifact");
      return data.get(k);
    },
    async deletePrefix(p) {
      for (const k of data.keys()) if (k.startsWith(p)) data.delete(k);
    },
  };
  const dependencies = {
    objects,
    deploymentEnabled: true,
    handoffEnabled: true,
    verifier: {
      async verify(files, baseline) {
        calls.verify++;
        return {
          version: 1,
          passed: !failVerify,
          artifactSha256: tamperReport ? "0".repeat(64) : staticDigest(files),
          baselineSha256: staticDigest(baseline),
          checks: staticChecks(files).map((name) => ({
            name,
            passed: !failVerify,
          })),
          artifacts: { "report.json": Buffer.from("{}").toString("base64") },
        };
      },
    },
    provider: {
      async observe(t) {
        calls.observe++;
        if (canonicalJson(t) !== canonicalJson(target))
          throw new SiteError("static_target_mismatch");
        return structuredClone(observation);
      },
      async capture(t, files) {
        calls.capture++;
        if (failCapture) throw new SiteError("static_delivery_mismatch");
        return { files: staticHashes(files), delivery: { www: "unverified" } };
      },
      async deploy(input) {
        calls.deploy++;
        if (canonicalJson(input.expected) !== canonicalJson(observation))
          throw new SiteError("static_production_drift");
        if (deployPause) await deployPause;
        const id = randomUUID();
        await input.onDeployment(id);
        observation = {
          ...observation,
          deploymentId: id,
          sourceCommit: null,
          sourceRepository: null,
          sourceBranch: null,
          configSha256: "d".repeat(64),
        };
        if (failDeploy && !input.recovery)
          throw new SiteError(
            unknown ? "static_deployment_unknown" : "static_deployment_failed",
          );
        return structuredClone(observation);
      },
      async usage(t, period) {
        calls.usage++;
        return failUsage
          ? {
              period,
              currency: "USD",
              status: "unavailable",
              basis: "unavailable",
              amount: null,
              breakdown: {},
              metrics: null,
              metricsStatus: "unavailable",
              reason: "provider_usage_unavailable",
            }
          : {
              period,
              currency: "USD",
              status: "available",
              basis: "provider-accrued",
              amount: 0.37,
              breakdown: { cpuDollars: 0.1, memoryDollars: 0.27 },
              metrics: { memory: { average_mb: 20 } },
              metricsStatus: "available",
            };
      },
    },
  };
  return {
    dependencies,
    data,
    target,
    calls,
    get observation() {
      return observation;
    },
    set observation(v) {
      observation = v;
    },
    input(extra = {}) {
      return {
        slug: "fictional-studio",
        expectedOwnerEmail: "owner@example.invalid",
        firstClientPilot: true,
        target,
        sourceCommit: observation.sourceCommit,
        deploymentId: observation.deploymentId,
        serving: {
          caddyfile:
            "{ admin off\n auto_https off }\n:{$PORT:8080} { root * /srv\n file_server }",
          runtimeImage: "caddy:2.11.2-alpine@sha256:" + "e".repeat(64),
        },
        files: staticFiles,
        confirmation:
          "IMPORT_SITE:fictional-studio:" + observation.deploymentId,
        ...extra,
      };
    },
    failVerification(v) {
      failVerify = v;
    },
    failDeployment(v, u = false) {
      failDeploy = v;
      unknown = u;
    },
    failCapture(v) {
      failCapture = v;
    },
    failUsage(v) {
      failUsage = v;
    },
    tamperReport(v) {
      tamperReport = v;
    },
    pauseDeployment(p) {
      deployPause = p;
    },
  };
}
