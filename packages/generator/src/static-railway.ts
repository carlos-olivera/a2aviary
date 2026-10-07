import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { lookup } from "node:dns/promises";
import { BlockList } from "node:net";
import { request } from "node:https";
import { canonicalJson, sha256 } from "../../../services/src/site/policy.ts";
import { SiteError } from "./render.ts";
import {
  staticRoute,
  validateStaticFiles,
  validateStaticServing,
  type StaticProvider,
  type StaticTarget,
  type StaticObservation,
  type StaticFiles,
  type StaticServing,
  type StaticUsage,
} from "./static.ts";

const blocked = new BlockList();
for (const [ip, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(ip, bits);
for (const [ip, bits] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
] as const)
  blocked.addSubnet(ip, bits, "ipv6");

export function isPublicStaticAddress(address: string, family: number) {
  return (
    (family === 4 || (family === 6 && /^[23][0-9a-f]{3}:/i.test(address))) &&
    !blocked.check(address, family === 6 ? "ipv6" : "ipv4")
  );
}

// No redirects, cookies or credentials. DNS is validated once and pinned for TLS.
export async function publicStaticGet(host: string, path: string) {
  if (
    !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ||
    !path.startsWith("/")
  )
    throw new SiteError("invalid_static_host");
  const answers = await lookup(host, { all: true });
  if (
    !answers.length ||
    answers.some((a) => !isPublicStaticAddress(a.address, a.family))
  )
    throw new SiteError("private_static_host");
  const chosen = answers[0];
  return new Promise<{
    status: number;
    headers: Record<string, string>;
    bytes: Buffer;
  }>((resolve, reject) => {
    const req = request(
      {
        hostname: host,
        path,
        method: "GET",
        servername: host,
        family: chosen.family,
        timeout: 15000,
        lookup: (_h, _o, cb) => cb(null, chosen.address, chosen.family),
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (b) => {
          size += b.length;
          if (size > 16 * 1024 * 1024)
            res.destroy(new SiteError("static_response_size"));
          else chunks.push(b);
        });
        res.on("error", reject);
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: Object.fromEntries(
              Object.entries(res.headers).filter(
                (x): x is [string, string] => typeof x[1] === "string",
              ),
            ),
            bytes: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("timeout", () =>
      req.destroy(new SiteError("static_response_timeout")),
    );
    req.on("error", reject);
    req.end();
  });
}
type Query = (
  query: string,
  variables: Record<string, unknown>,
) => Promise<any>;
type Run = (args: string[], cwd?: string) => Promise<string>;
export class StaticRailwayProvider implements StaticProvider {
  private readonly query: Query;
  private readonly run: Run;
  private readonly apiToken: string;
  private readonly cli: string;
  private readonly protectedIds: ReadonlySet<string>;
  private readonly get: typeof publicStaticGet;
  constructor(
    options: {
      apiToken: string;
      protectedProjectIds: ReadonlySet<string>;
      cliPath?: string;
    },
    query?: Query,
    run?: Run,
    get = publicStaticGet,
  ) {
    this.apiToken = options.apiToken;
    this.protectedIds = options.protectedProjectIds;
    this.cli =
      options.cliPath ??
      fileURLToPath(new URL("./bin/railway", import.meta.url));
    this.get = get;
    this.query =
      query ??
      (async (query, variables) => {
        const r = await fetch("https://backboard.railway.com/graphql/v2", {
          method: "POST",
          headers: {
            authorization: "Bearer " + this.apiToken,
            "content-type": "application/json",
          },
          body: JSON.stringify({ query, variables }),
          signal: AbortSignal.timeout(30000),
        });
        if (!r.ok) throw new SiteError("static_provider_unavailable");
        const data = (await r.json()) as any;
        if (data.errors?.length || !data.data)
          throw new SiteError("static_provider_unavailable");
        return data.data;
      });
    this.run =
      run ??
      (async (args, cwd) => {
        if (cwd) {
          const result = await promisify(execFile)(this.cli, args, {
            cwd,
            timeout: 180000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
              PATH: process.env.PATH,
              HOME: cwd,
              RAILWAY_API_TOKEN: this.apiToken,
              CI: "true",
            },
          });
          return result.stdout;
        }
        const directory = await mkdtemp(join(tmpdir(), "a2aviary-usage-"));
        try {
          const result = await promisify(execFile)(this.cli, args, {
            cwd: directory,
            timeout: 60000,
            maxBuffer: 2 * 1024 * 1024,
            env: {
              PATH: process.env.PATH,
              HOME: directory,
              RAILWAY_API_TOKEN: this.apiToken,
              CI: "true",
            },
          });
          return result.stdout;
        } finally {
          await rm(directory, { recursive: true, force: true });
        }
      });
  }
  async observe(t: StaticTarget): Promise<StaticObservation> {
    // Imported targets must already be protected from ordinary provision/reset.
    if (!this.protectedIds.has(t.projectId))
      throw new SiteError("imported_target_not_protected");
    const p = (
      await this.query(
        "query($id:String!){project(id:$id){id workspaceId environments{edges{node{id name unmergedChangesCount}}} services{edges{node{id}}}}}",
        { id: t.projectId },
      )
    ).project;
    const e = p?.environments.edges.find(
      (x: any) => x.node.id === t.environmentId,
    )?.node;
    if (
      p?.workspaceId !== t.workspaceId ||
      !e ||
      e.name !== "production" ||
      !p.services.edges.some((s: any) => s.node.id === t.serviceId)
    )
      throw new SiteError("static_target_mismatch");
    const config = (
      await this.query(
        "query($id:String!){environment(id:$id){config(decryptVariables:false)}}",
        { id: t.environmentId },
      )
    ).environment?.config;
    const parsed = typeof config === "string" ? JSON.parse(config) : config;
    const service = parsed?.services?.[t.serviceId];
    if (!service) throw new SiteError("static_target_mismatch");
    const domains = (
      await this.query(
        "query($projectId:String!,$environmentId:String!,$serviceId:String!){domains(projectId:$projectId,environmentId:$environmentId,serviceId:$serviceId){serviceDomains{id domain targetPort} customDomains{id domain targetPort}}}",
        t as unknown as Record<string, unknown>,
      )
    ).domains;
    if (
      !domains?.customDomains.some((d: any) => d.domain === t.domain) ||
      !domains.serviceDomains.some((d: any) => d.domain === t.previewDomain)
    )
      throw new SiteError("static_domain_mismatch");
    const dep = (
      await this.query(
        "query($input:DeploymentListInput!){deployments(input:$input,first:1){edges{node{id status meta}}}}",
        {
          input: {
            projectId: t.projectId,
            environmentId: t.environmentId,
            serviceId: t.serviceId,
          },
        },
      )
    ).deployments.edges[0]?.node;
    if (!dep?.id) throw new SiteError("static_live_deployment_required");
    const source = service.source ?? {};
    // serviceDisconnect is shared across environments. Never detach a shared source.
    if (source.repo && p.environments.edges.length !== 1)
      throw new SiteError("static_shared_source");
    const domainList = [...domains.customDomains, ...domains.serviceDomains]
      .map((d: any) => ({
        id: d.id,
        domain: d.domain,
        targetPort: d.targetPort,
      }))
      .sort((a, b) => a.domain.localeCompare(b.domain));
    return {
      target: t,
      deploymentId: dep.id,
      sourceCommit: dep.meta?.commitHash ?? null,
      sourceRepository: source.repo ?? null,
      sourceBranch: source.branch ?? null,
      configSha256: sha256(
        canonicalJson({
          source,
          build: service.build ?? {},
          deploy: service.deploy ?? {},
          networking: service.networking ?? {},
          variables: service.variables ?? {},
          sharedVariables: parsed.sharedVariables ?? {},
        }),
      ),
      servingSha256: sha256(
        canonicalJson({
          build: service.build ?? {},
          deploy: service.deploy ?? {},
          networking: service.networking ?? {},
          variables: service.variables ?? {},
          sharedVariables: parsed.sharedVariables ?? {},
        }),
      ),
      domainsSha256: sha256(canonicalJson(domainList)),
      staged: Boolean(e.unmergedChangesCount),
      deploymentStatus: dep.status,
    };
  }
  async capture(t: StaticTarget, files: StaticFiles) {
    validateStaticFiles(files);
    const evidence: Record<string, unknown> = {};
    for (const [path, b64] of Object.entries(files)) {
      const r = await this.get(t.domain, staticRoute(path));
      if (
        r.status !== 200 ||
        sha256(r.bytes) !== sha256(Buffer.from(b64, "base64"))
      )
        throw new SiteError("static_baseline_mismatch");
      evidence[path] = {
        status: r.status,
        sha256: sha256(r.bytes),
        headers: this.headers(r.headers),
      };
    }
    const redirects: Record<string, unknown> = {};
    for (const path of Object.keys(files).filter((p) =>
      p.endsWith("/index.html"),
    )) {
      const route = staticRoute(path).slice(0, -1);
      const result = await this.get(t.domain, route);
      redirects[route] = {
        status: result.status,
        sha256: sha256(result.bytes),
        headers: this.headers(result.headers),
      };
    }
    const missing = await this.get(t.domain, "/__a2aviary_unknown_route__");
    if (
      missing.status !== 404 ||
      sha256(missing.bytes) !== sha256(Buffer.from(files["404.html"], "base64"))
    )
      throw new SiteError("static_404_mismatch");
    const preview = await this.get(t.previewDomain, "/");
    if (
      preview.status !== 200 ||
      sha256(preview.bytes) !==
        sha256(Buffer.from(files["index.html"], "base64")) ||
      !preview.headers["x-robots-tag"]?.includes("noindex")
    )
      throw new SiteError("static_preview_mismatch");
    evidence.delivery = {
      notFound: { status: missing.status, sha256: sha256(missing.bytes) },
      previewHeaders: this.headers(preview.headers),
      redirects,
      www: "unverified",
    };
    return evidence;
  }
  private headers(headers: Record<string, string>) {
    return Object.fromEntries(
      [
        "content-type",
        "cache-control",
        "content-security-policy",
        "referrer-policy",
        "permissions-policy",
        "x-content-type-options",
        "strict-transport-security",
        "x-frame-options",
        "cross-origin-opener-policy",
        "cross-origin-resource-policy",
        "x-robots-tag",
        "location",
      ]
        .filter((k) => headers[k] !== undefined)
        .map((k) => [k, headers[k]]),
    );
  }
  async deploy(input: {
    target: StaticTarget;
    serving: StaticServing;
    files: StaticFiles;
    expected: StaticObservation;
    handoff: boolean;
    recovery?: boolean;
    onDeployment: (id: string) => Promise<void>;
  }) {
    const { target: t, serving, files } = input;
    validateStaticFiles(files);
    validateStaticServing(serving);
    const observed = await this.observe(t);
    if (
      observed.staged ||
      canonicalJson(observed) !== canonicalJson(input.expected)
    )
      throw new SiteError("static_production_drift");
    if (observed.deploymentStatus !== "SUCCESS" && !input.recovery)
      throw new SiteError("static_live_deployment_required");
    if (!input.handoff && (observed.sourceRepository || observed.sourceBranch))
      throw new SiteError("static_handoff_required");
    const dir = await mkdtemp(join(tmpdir(), "a2aviary-static-"));
    let mutated = false;
    try {
      await mkdir(join(dir, "dist"));
      for (const [p, b] of Object.entries(files)) {
        const path = join(dir, "dist", p);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, Buffer.from(b, "base64"));
      }
      await writeFile(join(dir, "Caddyfile"), serving.caddyfile);
      await writeFile(
        join(dir, "Dockerfile"),
        `FROM ${serving.runtimeImage}\nCOPY Caddyfile /etc/caddy/Caddyfile\nCOPY dist /srv\nENV PORT=8080\nEXPOSE 8080\n`,
      );
      if (input.handoff) {
        mutated = true;
        const d = await this.query(
          "mutation($id:String!){serviceDisconnect(id:$id){id}}",
          { id: t.serviceId },
        );
        if (d.serviceDisconnect?.id !== t.serviceId)
          throw new SiteError("static_deployment_unknown");
      }
      mutated = true;
      const result = await this.run(
        [
          "up",
          dir,
          "--path-as-root",
          "--project",
          t.projectId,
          "--environment",
          t.environmentId,
          "--service",
          t.serviceId,
          "--detach",
          "--json",
        ],
        dir,
      );
      const id = JSON.parse(result).deploymentId;
      if (typeof id !== "string" || !id)
        throw new SiteError("static_deployment_unknown");
      await input.onDeployment(id);
      const deadline = Date.now() + 600000;
      let ready: StaticObservation | undefined;
      while (Date.now() < deadline) {
        try {
          const o = await this.observe(t);
          if (o.deploymentId === id) {
            if (
              ["FAILED", "CRASHED", "REMOVED"].includes(
                o.deploymentStatus ?? "",
              )
            )
              throw new SiteError("static_deployment_failed");
            if (o.deploymentStatus === "SUCCESS") {
              ready = o;
              break;
            }
          } else if (o.deploymentId !== observed.deploymentId)
            throw new SiteError("static_production_drift");
        } catch (error) {
          if (
            error instanceof SiteError &&
            ["static_production_drift", "static_deployment_failed"].includes(
              error.code,
            )
          )
            throw error;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (
        !ready ||
        ready.sourceRepository ||
        ready.sourceBranch ||
        ready.staged ||
        ready.domainsSha256 !== observed.domainsSha256 ||
        ready.servingSha256 !== observed.servingSha256
      )
        throw new SiteError("static_deployment_unknown");
      try {
        await this.capture(t, files);
      } catch {
        throw new SiteError("static_deployment_failed");
      }
      return ready;
    } catch (error) {
      if (
        error instanceof SiteError &&
        error.code === "static_deployment_failed"
      )
        throw error;
      if (mutated) throw new SiteError("static_deployment_unknown");
      throw error;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  async usage(t: StaticTarget, period: string): Promise<StaticUsage> {
    await this.observe(t);
    let data: StaticUsage = {
      currency: "USD",
      status: "unavailable",
      basis: "unavailable",
      amount: null,
      period,
      breakdown: {},
      metrics: null,
      metricsStatus: "unavailable",
      reason: "provider_usage_unavailable",
    };
    try {
      const u = JSON.parse(
        await this.run([
          "usage",
          "projects",
          "--workspace",
          t.workspaceId,
          "--project",
          t.projectId,
          "--period",
          period,
          "--json",
        ]),
      );
      if (u.workspace?.id !== t.workspaceId || u.project?.id !== t.projectId)
        throw Error();
      const s = u.services?.find((s: any) => s.id === t.serviceId);
      if (!s) throw Error();
      const names = [
        "cpuDollars",
        "memoryDollars",
        "egressDollars",
        "volumeDollars",
        "backupDollars",
      ];
      if (
        [...names, "totalDollars"].some(
          (k) => typeof s[k] !== "number" || !Number.isFinite(s[k]) || s[k] < 0,
        )
      )
        throw Error();
      data = {
        ...data,
        status: "available",
        basis: "provider-accrued",
        amount: s.totalDollars,
        breakdown: Object.fromEntries(names.map((k) => [k, s[k]])),
        reason: undefined,
        providerBillingPeriod: u.billingPeriod,
      };
    } catch {}
    try {
      const m = JSON.parse(
        await this.run([
          "metrics",
          "--project",
          t.projectId,
          "--environment",
          t.environmentId,
          "--service",
          t.serviceId,
          "--since",
          "1d",
          "--cpu",
          "--memory",
          "--network",
          "--json",
        ]),
      );
      const allowed = ["cpu", "memory", "public_network_traffic", "window"];
      data.metrics = Object.fromEntries(
        allowed.filter((k) => m[k] !== undefined).map((k) => [k, m[k]]),
      );
      data.metricsStatus = Object.keys(data.metrics).some((k) => k !== "window")
        ? "available"
        : "unavailable";
    } catch {}
    return data;
  }
}
