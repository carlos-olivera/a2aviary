import { verifyOAuthQueryParams } from '@better-auth/oauth-provider';
import type { Auth } from './auth.ts';
import type { Config } from './config.ts';
import type { Plans } from './plans.ts';
import {TOOL_ROLES, type Store} from './store.ts';

export const escapeHtml = (value: unknown) => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const html = (title: string, body: string) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)} · a2aviary</title></head><body><main><h1>${escapeHtml(title)}</h1>${body}</main></body></html>`, {headers: {'content-type': 'text/html; charset=utf-8'}});
const hiddenQuery = (query: string) => `<input type="hidden" name="oauth_query" value="${escapeHtml(query)}">`;
export async function page(request: Request, config: Config, auth: Auth, plans: Plans, store: Store, sites=false): Promise<Response> {
  const url = new URL(request.url);
  if (!['GET', 'POST'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, POST'}});
  if (request.method === 'POST' && request.headers.get('origin') !== config.origin) return new Response('Origin required', {status: 403});
  const form = request.method === 'POST' ? new URLSearchParams(await request.text()) : null;
  const query = form?.get('oauth_query') ?? url.search.slice(1);
  if (query && !await verifyOAuthQueryParams(query, config.secret)) return new Response('Invalid or expired OAuth context', {status: 400});
  const session = await auth.api.getSession({headers: request.headers});
  if (url.pathname === '/sign-in') {
    if (request.method === 'POST') {
      // Route through the HTTP handler so OAuth-provider hooks preserve the signed
      // authorization query across Google state/callback and emit session cookies.
      const response = await auth.handler(new Request(`${config.issuer}/sign-in/social`, {
        method: 'POST', headers: new Headers({...Object.fromEntries(request.headers), 'content-type': 'application/json'}),
        body: JSON.stringify({provider: 'google', callbackURL: `${config.origin}/sign-in`, ...(query ? {oauth_query: query} : {})})
      }));
      if (!response.ok) return response;
      const result = await response.json() as {url?: string};
      if (!result.url) return new Response('Sign-in unavailable', {status: 503});
      const headers = new Headers({location: result.url});
      for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
      return new Response(null, {status: 303, headers});
    }
    return html('Sign in', `<p>${sites?'Approved catalog website builds and deployment are enabled. Exact spec approval and explicit deployment confirmation are required. No payments.':'Discovery and key management only. No website purchase or production is enabled.'}</p>${session && !query ? '<p>You are signed in. Return to your connector to authorize access.</p>' : `<form method="post" action="/sign-in">${hiddenQuery(query)}<button type="submit">Continue with Google</button></form>`}`);
  }
  if (!query) return new Response('OAuth context required', {status: 400});
  if (!session?.user.emailVerified) return new Response('Verified sign-in required', {status: 401});
  if (request.method === 'POST') {
    if (!['true', 'false'].includes(form?.get('accept') ?? '')) return new Response('Explicit consent required', {status: 400});
    const response = await auth.handler(new Request(`${config.issuer}/oauth2/consent`, {
      method: 'POST', headers: new Headers({...Object.fromEntries(request.headers), 'content-type': 'application/json'}),
      body: JSON.stringify({accept: form!.get('accept') === 'true', oauth_query: query})
    }));
    if (!response.ok) return response;
    const result = await response.json() as {redirect_uri?: string; url?: string};
    const location = result.redirect_uri ?? result.url;
    if (!location) return new Response('Consent unavailable', {status: 503});
    const headers = new Headers({location});
    for (const cookie of response.headers.getSetCookie()) headers.append('set-cookie', cookie);
    return new Response(null, {status: 303, headers});
  }
  const params = new URLSearchParams(query);
  const client = await auth.api.getOAuthClientPublic({headers: request.headers, query: {client_id: params.get('client_id') ?? ''}});
  const includes = plans.manifest.includes;
  const principal = await store.principal(session.user.id);
  const allowedTools = Object.keys(TOOL_ROLES).filter(name => TOOL_ROLES[name].includes(principal.role) && (sites || !['site.build','site.status','site.deploy','change.request','sites.list','site.inspect','tester.reset','site.costs.refresh'].includes(name)));
  return html('Authorize connector', `<p>Client: ${escapeHtml(client.client_name ?? params.get('client_id'))}</p><p>Signed in as ${escapeHtml(session.user.email)}.</p><p>Requested scopes: ${escapeHtml(params.get('scope') ?? '')}</p><p>Requested identity claims: ${escapeHtml(params.get('claims') ?? 'standard claims for the scopes shown')}</p><h2>Plan contract: ${escapeHtml(plans.id)} ${escapeHtml(plans.version)}</h2><p>Up to ${escapeHtml(includes.maxPages.value)} authored pages; capabilities ${escapeHtml(includes.capabilities.value.join(', '))}; CMS collections ${escapeHtml(includes.cmsCollections.value.join(', '))}; SSL ${includes.ssl.value ? 'included' : 'excluded'}; domain ${escapeHtml(includes.domain.value)}. ${escapeHtml(plans.manifest.changes.perMonth.value)} successful changes per UTC month are proposed by the current policy.</p><p>Excludes: ${escapeHtml(includes.excludes.value.join(', '))}.</p><h2>${sites?'Approved catalog-site mandate':'Discovery-only mandate'}</h2><p>${principal.testMode?'Free test-only web-simple plan. Sites use a separate Railway staging host; customer custom domains are prohibited. Successful changes exercise the same monthly allowance. ':''}Role: ${escapeHtml(principal.role)}. Available tools: ${escapeHtml(allowedTools.join(', '))}.</p><p>${sites?'This connector can upload your prepared spec and image bytes, build catalog sites, verify approved previews, and deploy your verified result to a separate client project. Changes require an approved structured diff and consume the policy allowance only after successful application. No research, OCR, image editing, payments or runtime policy changes.':'This connector can read plan contracts and manage your agent public keys. Admin tools are available only to authorized roles. No plan enrollment, payments, site submissions, generation or deployment.'} Access does not approve a website or expand the signed-email mandate.</p><form method="post" action="/consent">${hiddenQuery(query)}<button name="accept" value="true">Allow access</button><button name="accept" value="false">Deny access</button></form>`);
}
