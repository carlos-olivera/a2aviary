import { createServer, type IncomingMessage } from 'node:http';
import { SiteError } from '@a2aviary/generator';
import type { Config } from './config.ts';
import type { createApp } from './app.ts';

class BodyLimitError extends Error {}

export async function body(request: IncomingMessage, maxBytes = 512 * 1024) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new BodyLimitError('body_limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export function createHttpServer(
  config: Config,
  app: Awaited<ReturnType<typeof createApp>>,
) {
  let uploadInFlight = false;
  const server = createServer(async (incoming, outgoing) => {
    let acquired = false;
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers))
        if (value !== undefined)
          headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      headers.set(
        'x-platform-client-ip',
        incoming.socket.remoteAddress ?? '127.0.0.1',
      );
      const path = (incoming.url ?? '').split('?')[0];
      const upload = path.startsWith('/api/site-uploads/');
      if (upload) {
        if (uploadInFlight) throw new SiteError('upload_busy');
        uploadInFlight = true;
        acquired = true;
      }
      if (upload)
        await app.authorizeUpload(
          new Request(new URL(incoming.url ?? '/', config.origin), {
            method: incoming.method,
            headers,
          }),
        );
      const data = ['GET', 'HEAD'].includes(incoming.method ?? '')
        ? undefined
        : await body(
            incoming,
            upload
              ? path.endsWith('/probe')
                ? 1
                : 20 * 1024 * 1024
              : 512 * 1024,
          );
      // Ignore proxy/Host overrides when constructing issuer and callback URLs.
      const request = new Request(new URL(incoming.url ?? '/', config.origin), {
        method: incoming.method,
        headers,
        body: data,
      });
      const response = await app.fetch(request);
      outgoing.statusCode = response.status;
      response.headers.forEach((value, name) => {
        if (name !== 'set-cookie') outgoing.setHeader(name, value);
      });
      if (response.headers.getSetCookie().length)
        outgoing.setHeader('set-cookie', response.headers.getSetCookie());
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(
        error instanceof BodyLimitError
          ? 413
          : error instanceof SiteError
            ? 403
            : 400,
        {
          'content-type': 'application/json',
        },
      );
      outgoing.end('{"error":"request_rejected"}');
    } finally {
      if (acquired) uploadInFlight = false;
    }
  });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;

  return server;
}
