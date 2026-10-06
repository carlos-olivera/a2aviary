import { createMcpHandler } from '@modelcontextprotocol/server';
import { requireMcpAuth } from '@better-auth/mcp';
import { createPool } from './database.ts';
import { createAuth } from './auth.ts';
import { AccessError, Store } from './store.ts';
import { createServer } from './tools.ts';
import { loadPlans } from './plans.ts';
import { page } from './pages.ts';
import type { Config } from './config.ts';

export async function createApp(config: Config, pool = createPool(config.databaseUrl)) {
  const auth = createAuth(config, pool);
  const store = new Store(pool, config);
  const plans = await loadPlans();
  const protectedMcp = requireMcpAuth(auth, async (request, claims) => {
    if (typeof claims.sub !== 'string') return Response.json({error: 'human_subject_required'}, {status: 403});
    const principal = await store.admitRequest(claims.sub);
    console.info(JSON.stringify({event: 'mcp.request', role: principal.role, testMode: principal.testMode}));
    const handler = createMcpHandler(() => createServer(principal, store, plans), {legacy: 'reject', maxSubscriptions: 0});
    return handler.fetch(request, {authInfo: {token: request.headers.get('authorization')!.replace(/^(?:Bearer|DPoP)\s+/i, ''), clientId: String(claims.client_id ?? claims.azp ?? ''),
      scopes: String(claims.scope ?? '').split(' '), expiresAt: claims.exp, resource: new URL(config.resource)}});
  }, {resource: config.resource, issuer: config.issuer, requiredScopes: ['mcp:tools']});
  async function fetch(request: Request): Promise<Response> {
    let response: Response;
    try {
      const url = new URL(request.url);
      if (url.origin !== config.origin) response = new Response('Invalid origin', {status: 400});
      else if (url.pathname === '/healthz' && request.method === 'GET') {
        const readiness = await pool.query("SELECT count(*)::int AS count FROM platform_migration WHERE name IN ('001-better-auth.sql','002-platform.sql','003-mcp-rate.sql')");
        if (readiness.rows[0].count !== 3) throw new Error('Migrations required');
        response = Response.json({status: 'ok', mandate: 'discovery-only'});
      } else if (url.pathname === '/mcp') {
        if (request.method !== 'POST') response = new Response('Method not allowed', {status: 405, headers: {Allow: 'POST'}});
        else if (request.headers.has('origin') && request.headers.get('origin') !== config.origin) response = new Response('Invalid origin', {status: 403});
        else response = await protectedMcp(request);
      } else if (url.pathname.startsWith('/api/auth/') || url.pathname.startsWith('/.well-known/')) response = await auth.handler(request);
      else if (['/sign-in', '/consent'].includes(url.pathname)) response = await page(request, config, auth, plans, store);
      else if (url.pathname === '/' && request.method === 'GET') response = new Response(null, {status: 303, headers: {location: '/sign-in'}});
      else response = new Response('Not found', {status: 404});
    } catch (error) {
      if (error instanceof AccessError) response = Response.json({error: error.code}, {status: error.code === 'request_rate_limited' ? 429 : 403, headers: error.code === 'request_rate_limited' ? {'retry-after': '60'} : {}});
      else {console.error(JSON.stringify({event: 'request.failed'})); response = Response.json({error: 'service_unavailable'}, {status: 503});}
    }
    if (response.status === 429 && response.headers.has('x-retry-after')) response.headers.set('retry-after', response.headers.get('x-retry-after')!);
    response.headers.set('cache-control', 'no-store');
    response.headers.set('x-content-type-options', 'nosniff');
    response.headers.set('referrer-policy', 'no-referrer');
    response.headers.set('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    return response;
  }
  return {fetch, auth, store, plans, pool};
}
