import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { canonicalJson, sha256 } from '../../../services/src/site/policy.ts';
import type { SiteSpec } from '../../../services/src/site/types.ts';
import { SiteError, type SourceBundle } from './render.ts';

export interface PreviewBundle {
  files: Record<string, string>;
}
export interface VerificationReport {
  version: 1;
  sourceSha256: string;
  specSha256: string;
  passed: boolean;
  outputSha256: string | null;
  checks: { name: string; passed: boolean; details: unknown }[];
}
export interface VerifiedBuild {
  report: VerificationReport;
  files: Record<string, string>;
  artifacts: Record<string, string>;
  sessionId: string;
}
// Failed checker artifacts remain available for owner correction, never deployment.
export class VerificationFailure extends SiteError {
  readonly build: VerifiedBuild;
  constructor(build: VerifiedBuild) {
    super('verification_failed');
    this.build = build;
  }
}
export interface BuildVerifier {
  verify(
    source: SourceBundle,
    spec: SiteSpec,
    preview: PreviewBundle,
    context?: { test: boolean }
  ): Promise<VerifiedBuild>;
}
export function safePath(path: string): boolean {
  return (
    /^[a-zA-Z0-9_./-]+$/.test(path) &&
    !path.startsWith('/') &&
    !path.split('/').some((p) => !p || p === '.' || p === '..')
  );
}
export function validatePreview(spec: SiteSpec, preview: PreviewBundle) {
  if (!spec.preview || sha256(canonicalJson(preview)) !== spec.preview.sha256)
    throw new SiteError('preview_digest_mismatch');
  let bytes = 0;
  for (const [path, value] of Object.entries(preview.files)) {
    if (!safePath(path) || !/\.(html|css|png|jpg|jpeg|webp|woff2)$/.test(path))
      throw new SiteError('invalid_preview_file');
    const b = Buffer.from(value, 'base64');
    if (b.toString('base64') !== value)
      throw new SiteError('invalid_preview_encoding');
    bytes += b.length;
  }
  if (bytes > 8 * 1024 * 1024) throw new SiteError('preview_too_large');
  for (const page of spec.pages)
    if (
      !preview.files[
        page.path === '/' ? 'index.html' : page.path.slice(1) + 'index.html'
      ]
    )
      throw new SiteError('preview_page_missing');
}
export function assertVerified(
  build: VerifiedBuild,
  source: SourceBundle,
  spec: SiteSpec
) {
  const r = build.report;
  const required = [
    'catalog-syntax',
    'astro-build',
    ...spec.pages.flatMap((p) => [
      'a11y:' + p.path,
      'links:' + p.path,
      'lighthouse:' + p.path,
      'visual:' + p.path + ':390',
      'visual:' + p.path + ':1280'
    ])
  ];
  if (
    r.version !== 1 ||
    !r.passed ||
    r.sourceSha256 !== source.sourceSha256 ||
    r.specSha256 !== source.specSha256 ||
    required.some((n) => !r.checks.some((c) => c.name === n && c.passed)) ||
    r.checks.some((c) => !c.passed) ||
    r.outputSha256 !== sha256(canonicalJson(build.files))
  )
    throw new SiteError('verification_failed');
  for (const [path, encoded] of Object.entries(build.files))
    if (
      !safePath(path) ||
      Buffer.from(encoded, 'base64').toString('base64') !== encoded
    )
      throw new SiteError('unsafe_build_artifact');
  for (const p of spec.pages)
    if (
      !build.files[
        p.path === '/' ? 'index.html' : p.path.slice(1) + 'index.html'
      ]
    )
      throw new SiteError('missing_build_page');
  // Assets must be byte-identical after the Astro build.
  for (const a of spec.assets) {
    const file =
      'assets/' + a.sha256 + '.' + (a.format === 'jpeg' ? 'jpg' : a.format);
    if (
      !build.files[file] ||
      sha256(Buffer.from(build.files[file], 'base64')) !== a.sha256
    )
      throw new SiteError('build_asset_mismatch');
  }
}
export class AgentsVerifier implements BuildVerifier {
  readonly client: OpenAI;
  private readonly onCall: (event: {
    test?: boolean;
    event: string;
    specSha256: string;
    sourceSha256: string;
    result?: string;
    code?: string;
  }) => void;
  constructor(
    client: OpenAI,
    onCall: AgentsVerifier['onCall'] = (e) => console.info(JSON.stringify(e))
  ) {
    this.client = client;
    this.onCall = onCall;
  }
  async verify(
    source: SourceBundle,
    spec: SiteSpec,
    preview: PreviewBundle,
    context: { test: boolean } = { test: false }
  ): Promise<VerifiedBuild> {
    const emit = (event: Parameters<AgentsVerifier['onCall']>[0]) =>
      this.onCall({ ...event, test: context.test });
    validatePreview(spec, preview);
    // The approval also binds prepared asset hashes; previews may reference these
    // supplied bytes without duplicating them in the approved HTML/CSS artifact.
    const previewFiles = {
      ...Object.fromEntries(
        Object.entries(source.binaryFiles)
          .filter(([path]) => path.startsWith('public/assets/'))
          .map(([path, data]) => [path.slice(7), data])
      ),
      ...preview.files
    };
    const files = [
      ...Object.entries(source.files).map(([path, value]) => ({
        type: 'inline' as const,
        path: '/workspace/' + path,
        data: Buffer.from(value).toString('base64')
      })),
      ...Object.entries(source.binaryFiles).map(([path, data]) => ({
        type: 'inline' as const,
        path: '/workspace/' + path,
        data
      })),
      ...Object.entries(previewFiles).map(([path, data]) => ({
        type: 'inline' as const,
        path: '/workspace/approved-preview/' + path,
        data
      })),
      {
        type: 'inline' as const,
        path: '/workspace/verification-input.json',
        data: Buffer.from(
          canonicalJson({
            paths: spec.pages.map((p) => p.path),
            specSha256: source.specSha256,
            sourceSha256: source.sourceSha256
          })
        ).toString('base64')
      }
    ];
    emit({
      event: 'agents.verification.started',
      specSha256: source.specSha256,
      sourceSha256: source.sourceSha256
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20 * 60 * 1000);
    timer.unref();
    let sessionId: string | undefined;
    let stream:
      | Awaited<
          ReturnType<OpenAI['beta']['agents']['sessions']['events']['stream']>
        >
      | undefined;
    let failureCode = 'sandbox_session_create_failed';
    try {
      // Setup must finish before the tool-free turn publishes its outputs.
      const session = await this.client.beta.agents.sessions.create(
        {
          agent: {
            model: 'gpt-6-luna',
            reasoning: { effort: 'low' },
            multi_agent: { enabled: false },
            tools: [],
            instructions:
              'The fixed setup checker performs verification. Do not edit inputs or outputs. No research, image editing, OCR, deployment, network tools or credentials. Acknowledge completion only.'
          },
          environment: {
            type: 'openai_hosted',
            container_size: 'medium',
            network: {
              access: 'restricted',
              allowed_domains: [
                'registry.npmjs.org',
                'storage.googleapis.com',
                'cdn.playwright.dev',
                'playwright.download.prss.microsoft.com',
                'cdn.playwright.download.prss.microsoft.com',
                'deb.debian.org',
                'security.debian.org',
                'archive.ubuntu.com',
                'security.ubuntu.com'
              ]
            },
            env: { ASTRO_TELEMETRY_DISABLED: '1' },
            files,
            setup_commands: [
              {
                command: 'npm ci --ignore-scripts --no-audit --no-fund',
                cwd: '/workspace'
              },
              {
                command:
                  'npx --no-install playwright install --with-deps chromium',
                cwd: '/workspace'
              },
              {
                command: 'node verify.mjs; test -f outputs/report.json',
                cwd: '/workspace'
              }
            ]
          },
          stream: false
        },
        {
          timeout: 20 * 60 * 1000,
          idempotencyKey: 'site-verify-' + randomUUID(),
          signal: controller.signal,
          maxRetries: 0
        }
      );
      sessionId = session.id;
      failureCode = 'sandbox_setup_failed';
      if (
        session.environment.type !== 'openai_hosted' ||
        !session.environment.id
      )
        throw new SiteError(failureCode);
      const requestOptions = {
        signal: controller.signal,
        timeout: 30000,
        maxRetries: 0
      };
      for (;;) {
        if (controller.signal.aborted)
          throw new SiteError('sandbox_setup_timeout');
        const environment = await this.client.beta.agents.environments.retrieve(
          session.environment.id,
          requestOptions
        );
        if (environment.status === 'connected') break;
        if (environment.status === 'failed' || environment.status === 'expired')
          throw new SiteError('sandbox_setup_failed');
        await delay(1000, undefined, { signal: controller.signal });
      }
      const livePaths = new Set<string>();
      for await (const file of this.client.beta.agents.environments.files.list(
        session.environment.id,
        { path: '/workspace/outputs', limit: 100 },
        requestOptions
      ))
        livePaths.add(file.path);
      if (!livePaths.has('/workspace/outputs/report.json'))
        throw new SiteError('sandbox_report_missing');
      if (!livePaths.has('/workspace/outputs/site.json'))
        throw new SiteError('sandbox_site_missing');

      failureCode = 'sandbox_turn_failed';
      // Subscribe first so early turn events cannot be missed.
      stream = await this.client.beta.agents.sessions.events.stream(sessionId, {
        ...requestOptions,
        timeout: 20 * 60 * 1000
      });
      await this.client.beta.agents.sessions.events.create(
        sessionId,
        {
          events: [
            {
              type: 'agent.session.input.message',
              input: [
                {
                  role: 'user',
                  content: [
                    {
                      type: 'input_text',
                      text: 'Publish the fixed checker outputs as artifacts. Acknowledge completion.'
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          ...requestOptions,
          idempotencyKey: 'site-verify-turn-' + randomUUID()
        }
      );
      failureCode = 'sandbox_turn_incomplete';
      let turnId: string | undefined;
      let completed = false;
      for await (const event of stream) {
        if (
          event.type === 'agent.session.turn.created' &&
          event.turn.subagent_id === null
        )
          turnId ??= event.turn.id;
        if (
          event.type === 'agent.session.turn.completed' &&
          event.turn.subagent_id === null &&
          event.turn.id === turnId
        ) {
          completed = true;
          break;
        }
        if (
          event.type === 'error' ||
          event.type === 'agent.session.failed' ||
          event.type === 'agent.session.environment.failed' ||
          ((event.type === 'agent.session.turn.failed' ||
            event.type === 'agent.session.turn.cancelled') &&
            event.turn.subagent_id === null &&
            event.turn.id === turnId)
        )
          throw new SiteError('sandbox_turn_failed');
      }
      if (!completed || !turnId) throw new SiteError('sandbox_turn_incomplete');
      stream.controller.abort();

      failureCode = 'sandbox_artifact_download_failed';
      const artifacts: Record<string, string> = {};
      let totalBytes = 0;
      for await (const a of this.client.beta.agents.sessions.artifacts.list(
        sessionId,
        requestOptions
      )) {
        if (a.turn_id !== turnId || !a.path.startsWith('/workspace/outputs/'))
          continue;
        if (a.size_bytes > 64 * 1024 * 1024)
          throw new SiteError('verification_artifact_too_large');
        const path = a.path.slice('/workspace/outputs/'.length);
        if (!safePath(path)) throw new SiteError('sandbox_report_invalid');
        const response =
          await this.client.beta.agents.sessions.artifacts.content(
            a.id,
            { session_id: sessionId },
            requestOptions
          );
        const bytes = Buffer.from(await response.arrayBuffer());
        totalBytes += bytes.length;
        if (bytes.length > 64 * 1024 * 1024 || totalBytes > 128 * 1024 * 1024)
          throw new SiteError('verification_artifact_too_large');
        artifacts[path] = bytes.toString('base64');
      }
      if (!Object.keys(artifacts).length)
        throw new SiteError('sandbox_outputs_unpublished');
      if (!artifacts['report.json'])
        throw new SiteError('sandbox_report_missing');
      if (!artifacts['site.json']) throw new SiteError('sandbox_site_missing');
      failureCode = 'sandbox_report_invalid';
      const report: unknown = JSON.parse(
        Buffer.from(artifacts['report.json'], 'base64').toString()
      );
      const output: unknown = JSON.parse(
        Buffer.from(artifacts['site.json'], 'base64').toString()
      );
      const record = (value: unknown): value is Record<string, unknown> =>
        value !== null && typeof value === 'object' && !Array.isArray(value);
      const digest = (value: unknown) =>
        typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
      if (
        !record(report) ||
        report.version !== 1 ||
        typeof report.passed !== 'boolean' ||
        !digest(report.sourceSha256) ||
        !digest(report.specSha256) ||
        !(report.outputSha256 === null || digest(report.outputSha256)) ||
        !Array.isArray(report.checks) ||
        !report.checks.every(
          (c) =>
            record(c) &&
            typeof c.name === 'string' &&
            typeof c.passed === 'boolean'
        ) ||
        !record(output) ||
        !record(output.files) ||
        !Object.values(output.files).every((value) => typeof value === 'string')
      )
        throw new SiteError('sandbox_report_invalid');
      const build: VerifiedBuild = {
        report: report as unknown as VerificationReport,
        files: output.files as Record<string, string>,
        artifacts,
        sessionId
      };
      try {
        assertVerified(build, source, spec);
      } catch {
        throw new VerificationFailure(build);
      }
      emit({
        event: 'agents.verification.completed',
        specSha256: source.specSha256,
        sourceSha256: source.sourceSha256,
        result: 'pass'
      });
      return build;
    } catch (error) {
      const code =
        error instanceof SiteError
          ? error.code
          : failureCode === 'sandbox_setup_failed' && controller.signal.aborted
            ? 'sandbox_setup_timeout'
            : failureCode;
      emit({
        event: 'agents.verification.completed',
        specSha256: source.specSha256,
        sourceSha256: source.sourceSha256,
        result: 'fail',
        code
      });
      // Never expose provider responses or output bytes through errors/logs.
      throw error instanceof SiteError ? error : new SiteError(code);
    } finally {
      clearTimeout(timer);
      stream?.controller.abort();
      if (sessionId)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const deleted = await this.client.beta.agents.sessions.delete(
              sessionId,
              {
                timeout: 30000,
                maxRetries: 0
              }
            );
            if (!deleted.deleted) throw new Error('cleanup incomplete');
            break;
          } catch (error) {
            // A provisioning conflict may settle; other cleanup failures are separate.
            if (
              error instanceof OpenAI.APIError &&
              error.status === 409 &&
              attempt < 2
            ) {
              await delay(10000);
              continue;
            }
            emit({
              event: 'agents.cleanup.pending',
              code: 'sandbox_cleanup_pending',
              specSha256: source.specSha256,
              sourceSha256: source.sourceSha256
            });
            break;
          }
        }
    }
  }
}
