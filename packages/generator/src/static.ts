import { canonicalJson, sha256 } from "../../../services/src/site/policy.ts";
import { SiteError } from "./render.ts";
import { safePath } from "./verification.ts";

export type StaticFiles = Record<string, string>;
export interface StaticTarget {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  serviceId: string;
  domain: string;
  previewDomain: string;
}
export interface StaticServing {
  caddyfile: string;
  runtimeImage: string;
}
export interface StaticObservation {
  target: StaticTarget;
  deploymentId: string;
  sourceCommit: string | null;
  sourceRepository: string | null;
  sourceBranch: string | null;
  configSha256: string;
  domainsSha256: string;
  staged: boolean;
  deploymentStatus?: string;
  servingSha256?: string;
}
export interface StaticReport {
  version: 1;
  passed: boolean;
  artifactSha256: string;
  baselineSha256: string;
  checks: { name: string; passed: boolean; details?: unknown }[];
  artifacts: Record<string, string>;
  sessionId?: string;
  usage?: { status: "unavailable"; reason: string };
}
export interface StaticVerifier {
  verify(
    files: StaticFiles,
    baseline: StaticFiles,
    serving: StaticServing,
  ): Promise<StaticReport>;
}
export interface StaticUsage {
  currency: "USD";
  status: "available" | "unavailable";
  amount: number | null;
  basis: "provider-accrued" | "unavailable";
  period: string;
  providerBillingPeriod?: { start: string; end: string };
  breakdown: Record<string, number>;
  metrics: Record<string, unknown> | null;
  metricsStatus: "available" | "unavailable";
  reason?: string;
}
export interface StaticProvider {
  observe(target: StaticTarget): Promise<StaticObservation>;
  capture(
    target: StaticTarget,
    files: StaticFiles,
  ): Promise<Record<string, unknown>>;
  deploy(input: {
    target: StaticTarget;
    serving: StaticServing;
    files: StaticFiles;
    expected: StaticObservation;
    handoff: boolean;
    recovery?: boolean;
    onDeployment: (id: string) => Promise<void>;
  }): Promise<StaticObservation>;
  usage(target: StaticTarget, period: string): Promise<StaticUsage>;
}

export function validateStaticFiles(input: unknown): StaticFiles {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new SiteError("invalid_static_bundle");
  const entries = Object.entries(input);
  if (!entries.length || entries.length > 1000)
    throw new SiteError("static_bundle_size");
  let total = 0;
  const files: StaticFiles = {};
  for (const [path, value] of entries) {
    if (
      !safePath(path) ||
      !/\.(html|css|js|mjs|png|jpg|jpeg|webp|svg|ico|woff|woff2|txt|xml|json)$/.test(
        path,
      ) ||
      /(^|\/)(?:node_modules|\.git|outputs)(\/|$)/.test(path) ||
      typeof value !== "string"
    )
      throw new SiteError("unsafe_static_file");
    const b = Buffer.from(value, "base64");
    if (b.toString("base64") !== value)
      throw new SiteError("invalid_static_encoding");
    total += b.length;
    if (b.length > 16 * 1024 * 1024 || total > 32 * 1024 * 1024)
      throw new SiteError("static_bundle_size");
    files[path] = value;
  }
  if (!files["index.html"] || !files["404.html"])
    throw new SiteError("static_routes_required");
  return files;
}
export function staticDigest(files: StaticFiles) {
  return sha256(canonicalJson(files));
}
export function staticHashes(files: StaticFiles) {
  return Object.fromEntries(
    Object.entries(files).map(([p, b]) => [
      p,
      sha256(Buffer.from(b, "base64")),
    ]),
  );
}
export function staticRoute(path: string) {
  return path === "index.html"
    ? "/"
    : path.endsWith("/index.html")
      ? "/" + path.slice(0, -10)
      : "/" + path;
}
export function staticChecks(files: StaticFiles): string[] {
  return [
    "files-unchanged",
    "delivery",
    "interactions",
    ...Object.keys(files)
      .filter((p) => p.endsWith(".html"))
      .flatMap((p) => [
        "links:" + p,
        "a11y:" + p,
        ...[360, 375, 768, 1440].map((w) => "visual:" + p + ":" + w),
      ]),
  ];
}
export function assertStaticReport(
  report: StaticReport,
  files: StaticFiles,
  baseline: StaticFiles,
) {
  if (
    report.version !== 1 ||
    !report.passed ||
    report.artifactSha256 !== staticDigest(files) ||
    report.baselineSha256 !== staticDigest(baseline) ||
    !Array.isArray(report.checks) ||
    staticChecks(files).some(
      (name) =>
        !report.checks.some((c) => c.name === name && c.passed === true),
    ) ||
    report.checks.some((c) => !c.passed)
  )
    throw new SiteError("static_verification_failed");
}
export function validateStaticServing(s: StaticServing) {
  if (
    !/^caddy:[0-9]+\.[0-9]+\.[0-9]+(?:-alpine)?@sha256:[a-f0-9]{64}$/.test(
      s.runtimeImage,
    ) ||
    !s.caddyfile ||
    Buffer.byteLength(s.caddyfile) > 16384 ||
    /\b(?:import|reverse_proxy|forward_proxy|exec|php_fastcgi)\b/.test(
      s.caddyfile,
    )
  )
    throw new SiteError("invalid_static_serving");
}
