import {Pool} from 'pg';
import {randomUUID, createHash} from 'node:crypto';
import {makeSignature} from 'better-auth/crypto';
import {createApp} from '../src/app.ts';
import {createPool} from '../src/database.ts';
import {readConfig} from '../src/config.ts';
import {migrate} from '../src/migrate.ts';
import {createHttpServer} from '../src/http.ts';

export const env = {PLATFORM_ORIGIN: 'http://localhost:3000', DATABASE_URL: 'postgresql://platform:local-development-only@localhost:55432/a2aviary_platform',
  BETTER_AUTH_SECRET: 'fictional-test-secret-never-use-in-production', GOOGLE_CLIENT_ID: 'fictional-client', GOOGLE_CLIENT_SECRET: 'fictional-secret',
  PLATFORM_SUPERADMIN_EMAIL: 'owner@example.invalid', PLATFORM_TESTER_EMAILS: 'tester@example.invalid'};
export async function fixture(siteDependencies) {
  const url = new URL(process.env.TEST_DATABASE_URL ?? env.DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.startsWith('/a2aviary_platform')) throw new Error('Integration tests require a dedicated loopback a2aviary_platform database');
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({connectionString: url.toString()});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = createPool(url.toString(), `-c search_path=${schema}`);
  await migrate(pool);
  // Bind first, then construct the exact issuer/resource using the allocated port.
  let app;
  const {createServer} = await import('node:http');
  const reservation = createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
  const config = readConfig({...env, PLATFORM_ORIGIN: `http://127.0.0.1:${port}`, PORT: String(port), DATABASE_URL: url.toString()});
  app = await createApp(config, pool,siteDependencies);
  const http = createHttpServer(config, app); await new Promise(resolve => http.listen(port, '127.0.0.1', resolve));
  const context = await app.auth.$context;
  const request = (path, init = {}) => app.fetch(new Request(config.origin + path, {...init, headers: new Headers({'x-platform-client-ip': '127.0.0.1', ...Object.fromEntries(new Headers(init.headers ?? {}))})}));
  async function user(email, emailVerified = true) {
    const user = await context.internalAdapter.createUser({name: 'Fictional person', email, emailVerified});
    const session = await context.internalAdapter.createSession(user.id);
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(session.token + '.' + await makeSignature(session.token, config.secret))}`;
    return {...user, cookie};
  }
  async function client() {
    const result = await context.adapter.create({model: 'oauthClient', data: {clientId: `fictional-${randomUUID()}`, name: 'Fictional <connector>', redirectUris: ['https://connector.example.invalid/callback'],
      scopes: ['openid', 'profile', 'email', 'mcp:tools', 'offline_access'], grantTypes: ['authorization_code', 'refresh_token'], responseTypes: ['code'], tokenEndpointAuthMethod: 'none', requirePKCE: true, skipConsent: false}});
    await context.adapter.create({model: 'oauthClientResource', data: {clientId: result.clientId, resourceId: config.resource}});
    return result;
  }
  async function authorize(user, cli, extra = {}) {
    const verifier = 'fictional-pkce-verifier-abcdefghijklmnopqrstuvwxyz0123456789';
    const params = new URLSearchParams({client_id: cli.clientId, response_type: 'code', redirect_uri: cli.redirectUris[0], scope: 'openid email mcp:tools offline_access', state: 'fictional-state',
      code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource: config.resource, ...extra});
    const response = await request('/api/auth/oauth2/authorize?' + params, {headers: {cookie: user.cookie, accept: 'text/html'}});
    return {response, location: response.headers.get('location'), verifier};
  }
  async function exchange(user, cli, authorization, accept = true, verifier = authorization.verifier) {
    const query = new URL(authorization.location, config.origin).search.slice(1);
    const consent = await request('/consent', {method: 'POST', headers: {cookie: user.cookie, origin: config.origin, 'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({oauth_query: query, accept: String(accept)})});
    const location = consent.headers.get('location');
    if (!location || !accept) return {consent, location};
    const callback = new URL(location);
    const response = await request('/api/auth/oauth2/token', {method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({grant_type: 'authorization_code', client_id: cli.clientId, code: callback.searchParams.get('code'), redirect_uri: cli.redirectUris[0], code_verifier: verifier, resource: config.resource})});
    return {consent, location, callback, response, tokens: await response.json()};
  }
  async function token(user, changes = {}) {
    // Server-only test API; no signer is exposed over HTTP.
    return (await app.auth.api.signJWT({body: {payload: {sub: user.id, aud: config.resource, scope: 'mcp:tools', iss: config.issuer, exp: Math.floor(Date.now()/1000) + 300, ...changes}}})).token;
  }
  const rpc = (token, method = 'tools/list', params = {}, headers = {}) => request('/mcp', {method: 'POST', headers: {authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json',
    'mcp-protocol-version': '2026-07-28', 'mcp-method': method, ...(params.name ? {'mcp-name': params.name} : {}), ...headers},
    body: JSON.stringify({jsonrpc: '2.0', id: 1, method, params: {...params, _meta: {'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {}}}})});
  async function close() {await new Promise(resolve => http.close(resolve)); await pool.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();}
  return {app, pool, config, context, request, user, client, authorize, exchange, token, rpc, close};
}
