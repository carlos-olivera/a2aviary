import OpenAI from "openai";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { SiteError } from "./render.ts";
import {
  assertStaticReport,
  staticDigest,
  validateStaticFiles,
  type StaticFiles,
  type StaticServing,
  type StaticVerifier,
  type StaticReport,
} from "./static.ts";

export class StaticAgentsVerifier implements StaticVerifier {
  private readonly client: OpenAI;
  constructor(client: OpenAI) {
    this.client = client;
  }
  async verify(
    files: StaticFiles,
    baseline: StaticFiles,
    serving: StaticServing,
  ): Promise<StaticReport> {
    validateStaticFiles(files);
    validateStaticFiles(baseline);
    const inputs: Record<string, string> = {};
    for (const name of ["package.json", "package-lock.json"])
      inputs[name] = Buffer.from(
        await readFile(new URL("./resources/" + name, import.meta.url)),
      ).toString("base64");
    inputs["verify.mjs"] = Buffer.from(
      await readFile(new URL("./resources/static-verify.mjs", import.meta.url)),
    ).toString("base64");
    inputs["verification-input.json"] = Buffer.from(
      JSON.stringify({
        artifactSha256: staticDigest(files),
        baselineSha256: staticDigest(baseline),
        serving,
      }),
    ).toString("base64");
    for (const [p, b] of Object.entries(files)) inputs["candidate/" + p] = b;
    for (const [p, b] of Object.entries(baseline)) inputs["baseline/" + p] = b;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20 * 60000);
    timer.unref();
    let sessionId: string | undefined;
    let stream: any;
    try {
      stream = await this.client.beta.agents.sessions.create(
        {
          agent: {
            model: "gpt-6-luna",
            reasoning: { effort: "low" },
            multi_agent: { enabled: false },
            tools: [],
            instructions:
              "The fixed static checker ran during setup. Do not edit inputs or outputs. No tools, credentials or research. Acknowledge completion.",
          },
          environment: {
            type: "openai_hosted",
            container_size: "medium",
            network: {
              access: "restricted",
              allowed_domains: [
                "registry.npmjs.org",
                "cdn.playwright.dev",
                "playwright.download.prss.microsoft.com",
                "cdn.playwright.download.prss.microsoft.com",
                "deb.debian.org",
                "security.debian.org",
                "archive.ubuntu.com",
                "security.ubuntu.com",
              ],
            },
            env: {},
            files: Object.entries(inputs).map(([path, data]) => ({
              type: "inline",
              path: "/workspace/" + path,
              data,
            })),
            setup_commands: [
              {
                command: "npm ci --ignore-scripts --no-audit --no-fund",
                cwd: "/workspace",
              },
              {
                command:
                  "npx --no-install playwright install --with-deps chromium",
                cwd: "/workspace",
              },
              {
                command: "node verify.mjs; test -f outputs/report.json",
                cwd: "/workspace",
              },
            ],
          },
          input:
            "Publish fixed setup checker outputs as artifacts. Acknowledge completion.",
          stream: true,
        },
        {
          timeout: 20 * 60000,
          idempotencyKey: "static-verify-" + randomUUID(),
          signal: controller.signal,
          maxRetries: 0,
        },
      );
      stream.withResultCollection();
      for await (const event of stream)
        if (event.type === "agent.session.created")
          sessionId = event.session.id;
      const result = await stream.finalResult();
      sessionId = result.session_id;
      const artifacts: Record<string, string> = {};
      let total = 0;
      for await (const a of this.client.beta.agents.sessions.artifacts.list(
        sessionId!,
        { signal: controller.signal, timeout: 30000, maxRetries: 0 },
      )) {
        if (
          a.turn_id !== result.turn_id ||
          !a.path.startsWith("/workspace/outputs/")
        )
          continue;
        const name = a.path.slice("/workspace/outputs/".length);
        if (
          !/^(?:report\.json|(?:baseline|candidate)-[a-f0-9]{16}-[0-9]+\.png)$/.test(
            name,
          ) ||
          a.size_bytes > 64 * 1024 * 1024
        )
          throw new SiteError("static_artifact_invalid");
        const response =
          await this.client.beta.agents.sessions.artifacts.content(
            a.id,
            { session_id: sessionId! },
            { signal: controller.signal, timeout: 30000, maxRetries: 0 },
          );
        const b = Buffer.from(await response.arrayBuffer());
        total += b.length;
        if (b.length > 64 * 1024 * 1024 || total > 128 * 1024 * 1024)
          throw new SiteError("static_artifact_size");
        artifacts[name] = b.toString("base64");
      }
      const parsed = JSON.parse(
        Buffer.from(artifacts["report.json"] ?? "", "base64").toString(),
      );
      const report: StaticReport = {
        ...parsed,
        artifacts,
        sessionId,
        usage: {
          status: "unavailable",
          reason: "provider_verification_cost_not_reported",
        },
      };
      // Persist failed reports too: the controller validates before marking verified.
      if (report.passed) assertStaticReport(report, files, baseline);
      return report;
    } catch (error) {
      throw error instanceof SiteError
        ? error
        : new SiteError("static_sandbox_failed");
    } finally {
      clearTimeout(timer);
      stream?.controller.abort();
      if (sessionId)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await this.client.beta.agents.sessions.delete(sessionId, {
              timeout: 30000,
              maxRetries: 0,
            });
            break;
          } catch {
            if (attempt < 2) {
              await new Promise((resolve) =>
                setTimeout(resolve, 250 * (attempt + 1)),
              );
              continue;
            }
            console.error(
              JSON.stringify({ event: "static.sandbox.cleanup.pending" }),
            );
          }
        }
    }
  }
}
