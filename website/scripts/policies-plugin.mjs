import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publicPages } from '../src/site-navigation.js';
import { renderPolicyPage } from '../src/policy-pages.js';

export function policyPages() {
  let config;
  const middleware = read => async (request, response, next) => {
    const path = request.url?.split('?')[0].slice(1);
    if (!publicPages.includes(path) || !['GET', 'HEAD'].includes(request.method)) return next();
    try {
      const html = await read(path);
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : html);
    } catch (error) { next(error); }
  };
  return {
    name: 'a2aviary-public-policies',
    configResolved(resolved) { config = resolved; },
    configureServer(server) { server.middlewares.use(middleware(renderPolicyPage)); },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(path => readFile(resolve(config.root, config.build.outDir, path), 'utf8')));
    },
    generateBundle() {
      for (const path of publicPages) this.emitFile({ type: 'asset', fileName: path, source: renderPolicyPage(path) });
    },
  };
}
