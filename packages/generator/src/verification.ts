import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
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
    const stream = await this.client.beta.agents.sessions
      .create(
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
          input:
            'Publish the fixed checker outputs as artifacts. Acknowledge completion.',
          stream: true
        },
        {
          timeout: 20 * 60 * 1000,
          idempotencyKey: 'site-verify-' + randomUUID(),
          signal: controller.signal,
          maxRetries: 0
        }
      )
      .catch(() => {
        clearTimeout(timer);
        emit({
          event: 'agents.verification.completed',
          specSha256: source.specSha256,
          sourceSha256: source.sourceSha256,
          result: 'fail'
        });
        throw new SiteError('sandbox_verification_failed');
      });
    stream.withResultCollection();
    let sessionId: string | undefined;
    try {
      for await (const event of stream)
        if (event.type === 'agent.session.created')
          sessionId = event.session.id;
      const result = await stream.finalResult();
      sessionId = result.session_id;
      const artifacts: Record<string, string> = {};
      let totalBytes = 0;
      for await (const a of this.client.beta.agents.sessions.artifacts.list(
        sessionId,
        { signal: controller.signal, timeout: 30000, maxRetries: 0 }
      )) {
        if (
          a.turn_id !== result.turn_id ||
          !a.path.startsWith('/workspace/outputs/')
        )
          continue;
        if (a.size_bytes > 64 * 1024 * 1024)
          throw new SiteError('verification_artifact_too_large');
        const r = await this.client.beta.agents.sessions.artifacts.content(
          a.id,
          { session_id: sessionId },
          { signal: controller.signal, timeout: 30000, maxRetries: 0 }
        );
        const bytes = Buffer.from(await r.arrayBuffer());
        totalBytes += bytes.length;
        if (bytes.length > 64 * 1024 * 1024 || totalBytes > 128 * 1024 * 1024)
          throw new SiteError('verification_artifact_too_large');
        artifacts[a.path.slice('/workspace/outputs/'.length)] =
          bytes.toString('base64');
      }
      const report = JSON.parse(
        Buffer.from(artifacts['report.json'] ?? '', 'base64').toString()
      ) as VerificationReport;
      const output = artifacts['site.json']
        ? (JSON.parse(
            Buffer.from(artifacts['site.json'], 'base64').toString()
          ) as { files: Record<string, string> })
        : { files: {} };
      const build = { report, files: output.files, artifacts, sessionId };
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
      emit({
        event: 'agents.verification.completed',
        specSha256: source.specSha256,
        sourceSha256: source.sourceSha256,
        result: 'fail'
      });
      throw error instanceof SiteError
        ? error
        : new SiteError('sandbox_verification_failed');
    } finally {
      clearTimeout(timer);
      stream.controller.abort();
      if (sessionId)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await this.client.beta.agents.sessions.delete(sessionId, {
              timeout: 30000,
              maxRetries: 0
            });
            break;
          } catch {
            if (attempt < 2)
              await new Promise((resolve) =>
                setTimeout(resolve, 250 * (attempt + 1))
              );
            if (attempt === 2)
              emit({
                event: 'agents.cleanup.pending',
                specSha256: source.specSha256,
                sourceSha256: source.sourceSha256
              });
          }
        }
    }
  }
}
