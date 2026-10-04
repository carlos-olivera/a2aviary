import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { renderCosts } from '../src/costs-page.js';

export function costsPage() {
  let config;
  const render = async () => renderCosts(JSON.parse(await readFile(resolve(config.publicDir, 'costs.json'), 'utf8')));
  const middleware = read => async (request, response, next) => {
    if (request.url?.split('?')[0] !== '/costs' || !['GET', 'HEAD'].includes(request.method)) return next();
    try {
      const html = await read();
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(request.method === 'HEAD' ? undefined : html);
    } catch (error) {
      next(error);
    }
  };
  return {
    name: 'a2aviary-costs-page',
    configResolved(resolved) { config = resolved; },
    configureServer(server) { server.middlewares.use(middleware(render)); },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(() => readFile(resolve(config.root, config.build.outDir, 'costs'), 'utf8')));
    },
    async generateBundle() { this.emitFile({ type: 'asset', fileName: 'costs', source: await render() }); },
  };
}
