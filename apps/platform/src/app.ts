import { createMcpHandler } from '@modelcontextprotocol/server';
import { requireMcpAuth } from '@better-auth/mcp';
import { createPool } from './database.ts';
import { createAuth } from './auth.ts';
import { AccessError, Store, TOOL_ROLES, isAdminTool } from './store.ts';
import { createServer } from './tools.ts';
import { loadPlans } from './plans.ts';
import { page } from './pages.ts';
import type { Config } from './config.ts';
import {
  siteRuntime,
  SiteError,
  type ObjectStore,
  type BuildVerifier,
  type SiteDeployer
} from '@a2aviary/generator';
import { staticRuntime, type ManagedDependencies } from '@a2aviary/generator';
import { ManagedSites } from './managed-sites.ts';
import { Sites } from './sites.ts';
import { z } from 'zod';

export interface SiteDependencies {
  objects: ObjectStore;
  verifier: BuildVerifier;
  deployer: SiteDeployer;
  key: string;
}
export async function createApp(
  config: Config,
  pool = createPool(config.databaseUrl),
  siteDependencies: SiteDependencies | undefined = siteRuntime(),
  managedDependencies: ManagedDependencies | undefined = staticRuntime()
) {
  const auth = createAuth(config, pool);
  const store = new Store(pool, config);
  await store.seedTesters();
  const plans = await loadPlans();
  const managed = managedDependencies ? new ManagedSites(store, managedDependencies) : undefined;
  const sites = siteDependencies
    ? new Sites(
        store,
        siteDependencies.objects,
        siteDependencies.verifier,
        siteDependencies.deployer,
        siteDependencies.key
      )
    : undefined;
  const protectedMcp = requireMcpAuth(
    auth,
    async (request, claims) => {
      if (typeof claims.sub !== 'string')
        return Response.json(
          { error: 'human_subject_required' },
          { status: 403 }
        );
      const principal = await store.admitRequest(claims.sub);
      const body = await request
        .clone()
        .json()
        .catch(() => null);
      const name =
        body?.method === 'tools/call' ? body.params?.name : undefined;
      const validProtocol =
        body?.jsonrpc === '2.0' &&
        (typeof body?.id === 'string' || typeof body?.id === 'number') &&
        request.headers.get('mcp-protocol-version') === '2026-07-28' &&
        request.headers.get('mcp-method') === 'tools/call' &&
        request.headers.get('mcp-name') === name &&
        body?.params?._meta?.['io.modelcontextprotocol/protocolVersion'] ===
          '2026-07-28';
      const siteId =
        typeof body?.params?.arguments?.siteId === 'string' &&
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          body.params.arguments.siteId
        )
          ? body.params.arguments.siteId
          : undefined;
      if (
        validProtocol &&
        typeof name === 'string' &&
        Object.hasOwn(TOOL_ROLES, name) &&
        !TOOL_ROLES[name].includes(principal.role)
      ) {
        await store.adminResult(principal.id, name, 'forbidden');
        return Response.json({
          jsonrpc: '2.0',
          id: body.id ?? null,
          result: {
            isError: true,
            content: [
              { type: 'text', text: JSON.stringify({ error: 'forbidden' }) }
            ]
          }
        });
      }
      let test = principal.testMode;
      if (validProtocol && siteId)
        test = test || Boolean(
          (
            await pool.query(
              'SELECT test_mode FROM platform_site WHERE id=$1 AND (owner_id=$2 OR $3)',
              [siteId, principal.id, principal.role === 'superadmin']
            )
          ).rows[0]?.test_mode
        );
      if (principal.role === 'superadmin' && validProtocol) {
        if (
          typeof name === 'string' &&
          (name.startsWith('testers.') ||
            body?.params?.arguments?.test === true)
        )
          test = true;
        if (typeof name === 'string' && isAdminTool(name))
          await store.recordToolCall(principal.id, name, siteId, test);
      }
      console.info(
        JSON.stringify({
          event: 'mcp.request',
          role: principal.role,
          testMode: test,
          test
        })
      );
      const handler = createMcpHandler(
        () => createServer(principal, store, plans, sites, validProtocol, managed),
        { legacy: 'reject', maxSubscriptions: 0 }
      );
      return handler.fetch(request, {
        authInfo: {
          token: request.headers
            .get('authorization')!
            .replace(/^(?:Bearer|DPoP)\s+/i, ''),
          clientId: String(claims.client_id ?? claims.azp ?? ''),
          scopes: String(claims.scope ?? '').split(' '),
          expiresAt: claims.exp,
          resource: new URL(config.resource)
        }
      });
    },
    {
      resource: config.resource,
      issuer: config.issuer,
      requiredScopes: ['mcp:tools']
    }
  );
  const protectedSubmission = requireMcpAuth(
    auth,
    async (request, claims) => {
      if (!sites)
        return Response.json(
          { error: 'site_workflow_disabled' },
          { status: 503 }
        );
      if (typeof claims.sub !== 'string')
        return Response.json(
          { error: 'human_subject_required' },
          { status: 403 }
        );
      await store.admitRequest(claims.sub);
      const schema = z
        .object({
          siteId: z.uuid().optional(),
          slug: z
            .string()
            .regex(/^[a-z][a-z0-9-]{0,63}$/)
            .optional(),
          spec: z.unknown(),
          assets: z.record(
            z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
            z.string()
          ),
          preview: z
            .object({ files: z.record(z.string(), z.string()) })
            .strict()
        })
        .strict();
      let data: unknown;
      try {
        data = await request.json();
      } catch {
        await sites.failure(
          claims.sub,
          'site.submit',
          undefined,
          'invalid_submission'
        );
        return Response.json({ error: 'invalid_submission' }, { status: 400 });
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) {
        await sites.failure(
          claims.sub,
          'site.submit',
          undefined,
          'invalid_submission'
        );
        return Response.json({ error: 'invalid_submission' }, { status: 400 });
      }
      try {
        return Response.json(await sites.submit(claims.sub, parsed.data), {
          status: 201
        });
      } catch (error) {
        if (error instanceof SiteError)
          return Response.json(
            { error: error.code, errors: error.errors },
            { status: 422 }
          );
        throw error;
      }
    },
    {
      resource: config.resource,
      issuer: config.issuer,
      requiredScopes: ['mcp:tools']
    }
  );
  const protectedArtifact = requireMcpAuth(
    auth,
    async (request, claims) => {
      if (!sites || typeof claims.sub !== 'string')
        return Response.json(
          { error: 'site_workflow_disabled' },
          { status: 403 }
        );
      await store.admitRequest(claims.sub);
      const match = new URL(request.url).pathname.match(
        /^\/api\/site-artifacts\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/([^/]+)$/
      );
      if (!match) return new Response('Not found', { status: 404 });
      try {
        const bytes = await sites.artifact(claims.sub, match[1], match[2]);
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': match[2].endsWith('.png')
              ? 'image/png'
              : 'application/json'
          }
        });
      } catch (error) {
        if (error instanceof SiteError)
          return Response.json({ error: error.code }, { status: 404 });
        throw error;
      }
    },
    {
      resource: config.resource,
      issuer: config.issuer,
      requiredScopes: ['mcp:tools']
    }
  );
  const protectedStatic = requireMcpAuth(auth,async(request,claims)=>{
    if(!managed)return Response.json({error:'managed_static_disabled'},{status:503});
    if(typeof claims.sub!=='string')return Response.json({error:'human_subject_required'},{status:403});
    await store.admitRequest(claims.sub);
    const path=new URL(request.url).pathname;
    try {
      if(path==='/api/site-releases'){
        let input:unknown;try{input=await request.json();}catch{return Response.json({error:'invalid_static_submission'},{status:400});}
        const schema=z.union([z.object({siteId:z.uuid(),sourceCommit:z.string().regex(/^[a-f0-9]{40}$/),files:z.record(z.string(),z.string())}).strict(),z.object({kind:z.literal('import-baseline'),files:z.record(z.string(),z.string())}).strict()]);
        const parsed=schema.safeParse(input);
        if(!parsed.success){await store.recordSiteResult(claims.sub,'site.release.verify',null,'invalid_static_submission');return Response.json({error:'invalid_static_submission'},{status:400});}
        const result='kind' in parsed.data?await managed.uploadBaseline(claims.sub,parsed.data.files):await managed.submit(claims.sub,parsed.data);
        return Response.json(result,{status:201});
      }
      const report=path.match(/^\/api\/site-reports\/([a-f0-9-]{36})\/([0-9]{4}-[0-9]{2})\.csv$/);
      if(report)return new Response(await managed.csv(claims.sub,report[1],report[2]),{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="site-report.csv"'}});
      const artifact=path.match(/^\/api\/site-release-artifacts\/([a-f0-9-]{36})\/([a-f0-9-]{36})\/([^/]+)$/);
      if(artifact)return new Response(new Uint8Array(await managed.artifact(claims.sub,artifact[1],artifact[2],artifact[3])),{headers:{'content-type':artifact[3].endsWith('.png')?'image/png':'application/json'}});
      return new Response('Not found',{status:404});
    }catch(error){if(error instanceof SiteError){await store.recordSiteResult(claims.sub,'site.release.verify',null,error.code);return Response.json({error:error.code},{status:['owned_site_required','owned_release_required'].includes(error.code)?403:422});}throw error;}
  },{resource:config.resource,issuer:config.issuer,requiredScopes:['mcp:tools']});
  async function fetch(request: Request): Promise<Response> {
    let response: Response;
    try {
      const url = new URL(request.url);
      if (url.origin !== config.origin)
        response = new Response('Invalid origin', { status: 400 });
      else if (url.pathname === '/healthz' && request.method === 'GET') {
        const readiness = await pool.query(
          "SELECT count(*)::int AS count FROM platform_migration WHERE name IN ('001-better-auth.sql','002-platform.sql','003-mcp-rate.sql','004-sites.sql','005-testers-admin.sql','006-managed-static.sql')"
        );
        if (readiness.rows[0].count !== 6)
          throw new Error('Migrations required');
        response = Response.json({
          status: 'ok',
          mandate: sites ? 'approved-catalog-sites' : managed ? 'managed-static-sites' : 'discovery-only'
        });
      } else if (url.pathname === '/api/site-releases' || url.pathname.startsWith('/api/site-reports/') || url.pathname.startsWith('/api/site-release-artifacts/')) {
        const method=url.pathname==='/api/site-releases'?'POST':'GET';
        if(request.method!==method)response=new Response('Method not allowed',{status:405,headers:{Allow:method}});
        else if(request.headers.has('origin')&&request.headers.get('origin')!==config.origin)response=new Response('Invalid origin',{status:403});
        else response=await protectedStatic(request);
      } else if (url.pathname === '/api/site-specs') {
        if (!sites)
          response = Response.json(
            { error: 'site_workflow_disabled' },
            { status: 503 }
          );
        else if (request.method !== 'POST')
          response = new Response('Method not allowed', {
            status: 405,
            headers: { Allow: 'POST' }
          });
        else if (
          request.headers.has('origin') &&
          request.headers.get('origin') !== config.origin
        )
          response = new Response('Invalid origin', { status: 403 });
        else response = await protectedSubmission(request);
      } else if (url.pathname.startsWith('/api/site-artifacts/')) {
        response =
          request.method === 'GET'
            ? await protectedArtifact(request)
            : new Response('Method not allowed', {
                status: 405,
                headers: { Allow: 'GET' }
              });
      } else if (url.pathname === '/mcp') {
        if (request.method !== 'POST')
          response = new Response('Method not allowed', {
            status: 405,
            headers: { Allow: 'POST' }
          });
        else if (
          request.headers.has('origin') &&
          request.headers.get('origin') !== config.origin
        )
          response = new Response('Invalid origin', { status: 403 });
        else response = await protectedMcp(request);
      } else if (
        url.pathname.startsWith('/api/auth/') ||
        url.pathname.startsWith('/.well-known/')
      )
        response = await auth.handler(request);
      else if (['/sign-in', '/consent'].includes(url.pathname))
        response = await page(
          request,
          config,
          auth,
          plans,
          store,
          Boolean(sites),
          Boolean(managed)
        );
      else if (url.pathname === '/' && request.method === 'GET')
        response = new Response(null, {
          status: 303,
          headers: { location: '/sign-in' }
        });
      else response = new Response('Not found', { status: 404 });
    } catch (error) {
      if (error instanceof AccessError)
        response = Response.json(
          { error: error.code },
          {
            status: error.code === 'request_rate_limited' ? 429 : 403,
            headers:
              error.code === 'request_rate_limited'
                ? { 'retry-after': '60' }
                : {}
          }
        );
      else {
        console.error(JSON.stringify({ event: 'request.failed', test: false }));
        response = Response.json(
          { error: 'service_unavailable' },
          { status: 503 }
        );
      }
    }
    if (response.status === 429 && response.headers.has('x-retry-after'))
      response.headers.set(
        'retry-after',
        response.headers.get('x-retry-after')!
      );
    response.headers.set('cache-control', 'no-store');
    response.headers.set('x-content-type-options', 'nosniff');
    // no-referrer makes native HTML POST forms send Origin: null. Keep exact
    // Origin checks and disclose only the origin (never OAuth path/query) here.
    const formPage = ['/sign-in', '/consent'].includes(
      new URL(request.url).pathname
    );
    response.headers.set(
      'referrer-policy',
      formPage ? 'strict-origin' : 'no-referrer'
    );
    response.headers.set(
      'content-security-policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    return response;
  }
  return { fetch, auth, store, plans, pool, sites, managed };
}
