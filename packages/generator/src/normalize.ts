import { spawn } from 'node:child_process';
import { normalizedDimensions } from './webp.ts';
import { sha256 } from '../../../services/src/site/policy.ts';
import { SiteError } from './render.ts';
export const NORMALIZER_VERSION = '1.0.0';
export async function normalizeImage(
  bytes: Uint8Array,
  options: { timeoutMs?: number; worker?: URL } = {},
) {
  if (bytes.byteLength > 20 * 1024 * 1024)
    throw new SiteError('raw_image_bytes');
  return await new Promise<{
    bytes: Buffer;
    metadata: {
      format: 'webp';
      bytes: number;
      width: number;
      height: number;
      sha256: string;
      normalizerVersion: string;
    };
  }>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        '--max-old-space-size=128',
        options.worker?.pathname ??
          new URL('./normalize-worker.mjs', import.meta.url).pathname,
      ],
      { env: { PATH: process.env.PATH }, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output: Buffer[] = [],
      size = 0,
      error = '',
      timed = false,
      oversized = false;
    const timer = setTimeout(() => {
      timed = true;
      child.kill('SIGKILL');
    }, options.timeoutMs ?? 10000);
    child.stdout.on('data', (data: Buffer) => {
      size += data.length;
      if (size > 2 * 1024 * 1024 + 2048) {
        oversized = true;
        child.kill('SIGKILL');
      } else output.push(data);
    });
    child.stderr.on('data', (data: Buffer) => {
      if (error.length < 256)
        error += data.toString().slice(0, 256 - error.length);
    });
    child.on('error', () => {
      clearTimeout(timer);
      reject(new SiteError('image_decoder_failed'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (timed || oversized || code !== 0) {
        const allowed = [
          'raw_image_bytes',
          'image_format',
          'image_animated',
          'image_pixels',
          'normalized_image_bytes',
          'image_decode',
        ];
        reject(
          new SiteError(
            timed
              ? 'image_timeout'
              : allowed.includes(error)
                ? error
                : 'image_decoder_failed',
          ),
        );
        return;
      }
      try {
        const b = Buffer.concat(output),
          n = b.indexOf(10);
        if (n < 0) throw Error();
        const metadata = JSON.parse(b.subarray(0, n).toString()),
          bytes = b.subarray(n + 1),
          dimensions = normalizedDimensions(bytes);
        if (
          metadata.sha256 !== sha256(bytes) ||
          metadata.bytes !== bytes.length ||
          metadata.format !== 'webp' ||
          metadata.width !== dimensions.width ||
          metadata.height !== dimensions.height ||
          metadata.normalizerVersion !== NORMALIZER_VERSION
        )
          throw Error();
        resolve({ metadata, bytes });
      } catch {
        reject(new SiteError('image_decoder_failed'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(bytes);
  });
}
