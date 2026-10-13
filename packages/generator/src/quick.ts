import { spawn } from 'node:child_process';
import { setPriority } from 'node:os';
import type { SiteSpec } from '@a2aviary/site-core';
import { generateSite, renderPage, SiteError } from './render.ts';

export const QUICK_INPUT_BYTES = 36 * 1024 * 1024;
export const QUICK_OUTPUT_BYTES = 40 * 1024 * 1024;
export const QUICK_TIMEOUT_MS = 10_000;

/** Trusted renderer output, deliberately not a VerifiedBuild or SourceBundle. */
export async function renderQuickSite(
  spec: SiteSpec,
  assets: ReadonlyMap<string, Uint8Array>,
  test: boolean,
) {
  // Use exactly the full-preview catalog/asset validation and public resources.
  // No Astro, checker, hosted verifier, OpenAI or CMS request is executed.
  const source = await generateSite(spec, assets, {
    serverNormalized: true,
    test,
  });
  const files: Record<string, string> = {};
  for (const [path, text] of Object.entries(source.files))
    if (path.startsWith('public/') && !path.endsWith('.js'))
      files[path.slice(7)] = Buffer.from(text).toString('base64');
  for (const [path, bytes] of Object.entries(source.binaryFiles))
    files[path.slice(7)] = bytes;
  for (const page of spec.pages) {
    const path = (page.path === '/' ? '' : page.path.slice(1)) + 'index.html';
    // Only fixed script tags emitted by renderPage; owner text is already escaped.
    files[path] = Buffer.from(
      renderPage(spec, page.id).replace(/<script\b[^>]*><\/script>/g, ''),
    ).toString('base64');
  }
  return { verified: false as const, files };
}

/** Separate, lower-priority secret-free process, bounded protocol and kill deadline. */
export async function quickRender(
  spec: SiteSpec,
  assets: ReadonlyMap<string, Uint8Array>,
  test: boolean,
  options: { worker?: URL; timeoutMs?: number } = {},
) {
  const input = JSON.stringify({
    spec,
    assets: Object.fromEntries(
      [...assets].map(([id, b]) => [id, Buffer.from(b).toString('base64')]),
    ),
    test,
  });
  if (Buffer.byteLength(input) > QUICK_INPUT_BYTES)
    throw new SiteError('quick_input_size');
  return new Promise<{ verified: false; files: Record<string, string> }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--max-old-space-size=192',
          (options.worker ?? new URL('./quick-worker.mjs', import.meta.url))
            .pathname,
        ],
        { env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'ignore'] },
      );
      // Fail closed if scheduling isolation cannot be installed.
      try {
        if (child.pid) setPriority(child.pid, 10);
      } catch {
        child.kill('SIGKILL');
        reject(new SiteError('quick_renderer_unavailable'));
      }
      let size = 0,
        failure = '',
        chunks: Buffer[] = [];
      const timer = setTimeout(() => {
        failure = 'quick_timeout';
        child.kill('SIGKILL');
      }, options.timeoutMs ?? QUICK_TIMEOUT_MS);
      child.stdout.on('data', (b: Buffer) => {
        size += b.length;
        if (size > QUICK_OUTPUT_BYTES) {
          failure = 'quick_output_size';
          chunks = [];
          child.kill('SIGKILL');
        } else chunks.push(b);
      });
      child.stdin.on('error', () => {});
      child.on('error', () => {
        clearTimeout(timer);
        reject(new SiteError('quick_renderer_unavailable'));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (failure || code !== 0)
          return reject(new SiteError(failure || 'quick_render_failed'));
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString());
          if (
            result.verified !== false ||
            !result.files ||
            typeof result.files !== 'object'
          )
            throw Error();
          resolve(result);
        } catch {
          reject(new SiteError('quick_render_failed'));
        }
      });
      child.stdin.end(input);
    },
  );
}
