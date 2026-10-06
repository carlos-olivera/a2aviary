import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeJwt, generateKeyPair, SignJWT, exportJWK, calculateJwkThumbprint} from 'jose';
import {createHash,randomUUID} from 'node:crypto';
import {getMigrations} from 'better-auth/db/migration';
import {createAuth} from '../src/auth.ts';
import {createApp} from '../src/app.ts';
import {readConfig} from '../src/config.ts';
import {fixture,env} from './helpers.mjs';

test('Postgres OAuth integration and strict authenticated MCP transport', async t => {
  const f = await fixture(); t.after(f.close);
  const user = await f.user('client@example.invalid');
  const cli = await f.client();
  await t.test('RFC 8414/9728 aliases, CIMD, PKCE, issuer, DCR disabled', async () => {
    for (const path of ['/.well-known/oauth-authorization-server/api/auth', '/api/auth/.well-known/oauth-authorization-server']) {
      const r = await f.request(path); assert.equal(r.status, 200); const m = await r.json();
      assert.equal(m.issuer, f.config.issuer); assert.equal(m.authorization_endpoint, f.config.issuer+'/oauth2/authorize');
      assert.equal(m.token_endpoint, f.config.issuer+'/oauth2/token'); assert.equal(m.jwks_uri, f.config.issuer+'/jwks');
      assert.equal(m.client_id_metadata_document_supported, true); assert.ok(m.code_challenge_methods_supported.includes('S256'));
      assert.deepEqual(m.grant_types_supported, ['authorization_code', 'refresh_token']); assert.equal(m.registration_endpoint, undefined);
    }
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const r = await f.request(path); assert.equal(r.status, 200); const m = await r.json();
      assert.equal(m.resource, f.config.resource); assert.deepEqual(m.authorization_servers, [f.config.issuer]); assert.deepEqual(m.scopes_supported, ['mcp:tools']);
    }
    const r = await f.request('/api/auth/oauth2/register', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({client_name:'Fictional',redirect_uris:['https://connector.example.invalid/cb'],token_endpoint_auth_method:'none'})});
    assert.notEqual(r.status, 200); assert.notEqual(r.status, 201);
  });
  await t.test('explicit DCR opt-in works; session client administration stays disabled', async () => {
    const auth = createAuth({...f.config, dcr:true}, f.pool);
    const metadata = await (await auth.handler(new Request(f.config.origin+'/.well-known/oauth-authorization-server/api/auth',{headers:{'x-platform-client-ip':'127.0.0.1'}}))).json();
    assert.equal(metadata.registration_endpoint,f.config.issuer+'/oauth2/register');
    const r = await auth.handler(new Request(f.config.issuer+'/oauth2/register',{method:'POST',headers:{'content-type':'application/json','x-platform-client-ip':'127.0.0.1'},body:JSON.stringify({client_name:'Fictional DCR',redirect_uris:['https://connector.example.invalid/dcr'],token_endpoint_auth_method:'none',grant_types:['authorization_code'],response_types:['code'],scope:'mcp:tools'})}));
    assert.equal(r.status,201); assert.equal((await r.json()).token_endpoint_auth_method,'none');
    assert.equal((await f.request('/api/auth/oauth2/create-client',{method:'POST',headers:{cookie:user.cookie,'content-type':'application/json'},body:'{}'})).status,404);
    assert.equal((await f.request('/api/auth/token',{headers:{cookie:user.cookie}})).status,404);
  });
  await t.test('staging opt-in binds discovery and login trust to only the selected origin', async () => {
    const origin='https://platform-production-d84c.up.railway.app';
    const config=readConfig({...env,NODE_ENV:'production',PLATFORM_ORIGIN:origin,PLATFORM_ALLOWED_ORIGINS:origin+',https://other.example.invalid'});
    const app=await createApp(config,f.pool);
    assert.deepEqual(app.auth.options.trustedOrigins,[origin]);
    const request=(path,init={})=>app.fetch(new Request(origin+path,init));
    const authorization=await request('/.well-known/oauth-authorization-server/api/auth');
    assert.equal(authorization.status,200);
    const metadata=await authorization.json();
    assert.equal(metadata.issuer,origin+'/api/auth');
    assert.equal(metadata.authorization_endpoint,origin+'/api/auth/oauth2/authorize');
    assert.equal(metadata.jwks_uri,origin+'/api/auth/jwks');
    assert.equal(metadata.registration_endpoint,undefined);
    const resource=await request('/.well-known/oauth-protected-resource/mcp');
    assert.equal(resource.status,200);
    const protectedMetadata=await resource.json();
    assert.equal(protectedMetadata.resource,origin+'/mcp');
    assert.deepEqual(protectedMetadata.authorization_servers,[origin+'/api/auth']);
    for(const untrusted of ['https://mcp.a2aviary.io','https://other.example.invalid']) {
      assert.equal((await request('/sign-in',{method:'POST',headers:{origin:untrusted,'content-type':'application/x-www-form-urlencoded'},body:''})).status,403);
    }
    // The existing deployment also rejects a correctly signed token for the staging resource.
    assert.equal((await f.rpc(await f.token(user,{aud:origin+'/mcp'}))).status,401);
  });
  await t.test('committed migrations match pinned auth schema and are idempotent', async () => {
    const plan = await getMigrations(f.app.auth.options);
    assert.deepEqual(plan.toBeCreated,[]); assert.deepEqual(plan.toBeAdded,[]); assert.deepEqual(plan.toBeAddedIndexes,[]); assert.deepEqual(plan.schemaProblems,[]);
    const {migrate}=await import('../src/migrate.ts');await migrate(f.pool);
    assert.equal((await f.pool.query('SELECT count(*)::int FROM platform_migration')).rows[0].count,3);
    const original=(await f.pool.query("SELECT sha256 FROM platform_migration WHERE name='002-platform.sql'")).rows[0].sha256;
    await f.pool.query("UPDATE platform_migration SET sha256='fictional-mismatch' WHERE name='002-platform.sql'");
    await assert.rejects(migrate(f.pool),/Immutable migration changed/);
    await f.pool.query("UPDATE platform_migration SET sha256=$1 WHERE name='002-platform.sql'",[original]);
  });
  await t.test('server-rendered login and consent escape metadata and require signed context and Origin', async () => {
    const auth = await f.authorize(user,cli); assert.equal(auth.response.status,302); assert.ok(auth.location.startsWith('/consent?'));
    const consent = await f.request(auth.location,{headers:{cookie:user.cookie}}); assert.equal(consent.status,200);
    const content=await consent.text(); assert.match(content,/Fictional &lt;connector&gt;/); assert.match(content,/Discovery-only mandate/); assert.match(content,/4 successful changes/);assert.match(content,/7 authored pages/);
    assert.ok(!content.includes('<script'));
    const query = new URL(auth.location,f.config.origin).search.slice(1);
    for (const origin of [undefined, 'https://attacker.example.invalid']) {
      const headers={cookie:user.cookie,'content-type':'application/x-www-form-urlencoded',...(origin?{origin}:{})};
      assert.equal((await f.request('/consent',{method:'POST',headers,body:new URLSearchParams({accept:'true',oauth_query:query})})).status,403);
    }
    assert.equal((await f.request('/consent?'+query.replace('fictional-state','tampered'),{headers:{cookie:user.cookie}})).status,400);
    assert.equal((await f.request('/consent'+new URL(auth.location,f.config.origin).search)).status,401);
    const login=await f.authorize(user,cli,{prompt:'login'});assert.ok(login.location.startsWith('/sign-in?'));
    const google=await f.request('/sign-in',{method:'POST',headers:{origin:f.config.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({oauth_query:new URL(login.location,f.config.origin).search.slice(1)})});
    assert.equal(google.status,303);assert.equal(new URL(google.headers.get('location')).hostname,'accounts.google.com');assert.ok(google.headers.getSetCookie().length);
  });
  let tokens;
  await t.test('authorization code + S256 + consent yields audience-bound token, issuer echo and verified UserInfo', async () => {
    const result=await f.exchange(user,cli,await f.authorize(user,cli));assert.equal(result.response.status,200);
    tokens=result.tokens;assert.equal(result.callback.searchParams.get('iss'),f.config.issuer);assert.equal(result.callback.searchParams.get('state'),'fictional-state');
    const claims=decodeJwt(tokens.access_token);assert.ok([claims.aud].flat().includes(f.config.resource));assert.equal(claims.sub,user.id);assert.equal(claims.iss,f.config.issuer);assert.ok(tokens.expires_in<=300);
    const info=await f.request('/api/auth/oauth2/userinfo',{headers:{authorization:'Bearer '+tokens.access_token}});assert.equal(info.status,200);assert.equal((await info.json()).email_verified,true);
    assert.equal((await f.rpc(tokens.access_token)).status,200);
    const discover=await f.rpc(tokens.access_token,'server/discover');assert.equal(discover.status,200);const discovered=(await discover.json()).result;assert.equal(discovered._meta['io.modelcontextprotocol/serverInfo'].name,'a2aviary-discovery');assert.equal(discovered.capabilities.tools.listChanged,false);
    const listen=await f.rpc(tokens.access_token,'subscriptions/listen',{notifications:{toolsListChanged:true}});assert.equal(listen.status,200);assert.match((await listen.json()).error.message,/Subscription limit/);
  });
  await t.test('denial redirects without a code; bad PKCE, callback and resource cannot mint tokens', async () => {
    const other = await f.client();
    const denied=await f.exchange(user,other,await f.authorize(user,other),false);assert.equal(new URL(denied.location).searchParams.get('error'),'access_denied');assert.equal(new URL(denied.location).searchParams.has('code'),false);
    const bad=await f.exchange(user,other,await f.authorize(user,other),true,'incorrect-verifier-abcdefghijklmnopqrstuvwxyz0123456789');assert.equal(bad.response.status,401);assert.match(bad.tokens.error,/^invalid_(grant|request)$/);assert.equal(bad.tokens.access_token,undefined);
    const missing=await f.authorize(user,other,{code_challenge_method:'plain'});assert.equal(new URL(missing.location,f.config.origin).searchParams.has('error'),true);
    const resource=await f.authorize(user,other,{resource:'https://attacker.example.invalid/mcp'});assert.equal(new URL(resource.location,f.config.origin).searchParams.get('error'),'invalid_target');
    const callback=await f.authorize(user,other,{redirect_uri:'https://attacker.example.invalid/callback'});assert.notEqual(callback.location?.startsWith('https://attacker.example.invalid'),true);
  });
  await t.test('signature, expiry, issuer, audience, scope and live verified subject are enforced', async () => {
    const unauthorized=await f.request('/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(unauthorized.status,401);assert.match(unauthorized.headers.get('www-authenticate'),/resource_metadata=/);
    for (const changes of [{aud:'https://other.example.invalid/mcp'},{iss:'https://other.example.invalid/api/auth'},{exp:Math.floor(Date.now()/1000)-60}]) assert.equal((await f.rpc(await f.token(user,changes))).status,401);
    const key=await generateKeyPair('ES256');const forged=await new SignJWT({sub:user.id,scope:'mcp:tools'}).setProtectedHeader({alg:'ES256',kid:'not-issuer-key'}).setIssuer(f.config.issuer).setAudience(f.config.resource).setExpirationTime('5m').sign(key.privateKey);
    assert.equal((await f.rpc(forged)).status,401);
    const scope=await f.rpc(await f.token(user,{scope:'openid email'}));assert.equal(scope.status,403);assert.match(scope.headers.get('www-authenticate'),/insufficient_scope/);
    const unverified=await f.user('unverified@example.invalid',false);assert.equal((await f.rpc(await f.token(unverified))).status,403);
    assert.equal((await f.rpc(await f.token(user,{sub:'missing-fictional-user'}))).status,403);
  });
  await t.test('DPoP-bound access verifies possession and rejects replay',async()=>{
    const pair=await generateKeyPair('ES256');const jwk=await exportJWK(pair.publicKey);
    const bound=await f.token(user,{cnf:{jkt:await calculateJwkThumbprint(jwk)}});
    const proof=await new SignJWT({htm:'POST',htu:f.config.resource,iat:Math.floor(Date.now()/1000),jti:randomUUID(),ath:createHash('sha256').update(bound).digest('base64url')}).setProtectedHeader({alg:'ES256',typ:'dpop+jwt',jwk}).sign(pair.privateKey);
    assert.equal((await f.rpc(bound)).status,401);
    assert.equal((await f.rpc(bound,'tools/list',{}, {authorization:'DPoP '+bound,dpop:proof})).status,200);
    assert.equal((await f.rpc(bound,'tools/list',{}, {authorization:'DPoP '+bound,dpop:proof})).status,401);
  });
  await t.test('modern POST succeeds; GET, DELETE, OPTIONS, cross-origin and legacy handshake fail', async () => {
    for(const method of ['GET','DELETE','OPTIONS']) {const r=await f.request('/mcp',{method,headers:{authorization:'Bearer '+tokens.access_token}});assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'POST');}
    assert.equal((await f.rpc(tokens.access_token,'tools/list',{}, {origin:'https://attacker.example.invalid'})).status,403);
    const legacy=await f.request('/mcp',{method:'POST',headers:{authorization:'Bearer '+tokens.access_token,'content-type':'application/json',accept:'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'fictional',version:'1'}}})});assert.equal(legacy.status,400);assert.match(await legacy.text(),/2026-07-28/);
    const invalid=await f.rpc(tokens.access_token,'tools/list',{}, {'mcp-method':'tools/call'});assert.equal(invalid.status,400);
    const health=await fetch(f.config.origin+'/healthz');assert.equal(health.status,200);assert.equal((await health.json()).mandate,'discovery-only');
    const large=await fetch(f.config.origin+'/mcp',{method:'POST',body:'x'.repeat(512*1024+1)});assert.equal(large.status,413);
  });
  await t.test('refresh preserves resource scope and rejects a different resource',async()=>{
    const refresh = params => f.request('/api/auth/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:cli.clientId,refresh_token:tokens.refresh_token,...params})});
    const wrong=await refresh({resource:'https://other.example.invalid/mcp'});assert.equal(wrong.status,400);assert.equal((await wrong.json()).access_token,undefined);
    const valid=await refresh({resource:f.config.resource});assert.equal(valid.status,200);const refreshed=await valid.json();assert.ok([decodeJwt(refreshed.access_token).aud].flat().includes(f.config.resource));assert.equal((await f.rpc(refreshed.access_token)).status,200);
  });
  await t.test('database rate limits use numeric timestamps and per-human MCP admission',async()=>{
    const {createRateLimitKey}=await import('@better-auth/core/utils/ip');
    const path=createRateLimitKey('127.0.0.1','/get-session');
    await f.pool.query('INSERT INTO "rateLimit"(id,key,count,"lastRequest") VALUES($1,$2,100,$3)', ['fictional-rate-test',path,Date.now()]);
    const limited=await f.request('/api/auth/get-session');assert.equal(limited.status,429);assert.ok(Number(limited.headers.get('retry-after'))<=60);assert.ok(Number(limited.headers.get('retry-after'))>0);
    const claims=await f.token(user);
    await f.pool.query("INSERT INTO platform_mcp_rate(user_id,window_start,request_count) VALUES($1,date_trunc('minute',now()),60) ON CONFLICT(user_id) DO UPDATE SET window_start=excluded.window_start,request_count=60",[user.id]);
    const limit=await f.rpc(claims);assert.equal(limit.status,429);assert.equal((await limit.json()).error,'request_rate_limited');
    assert.equal((await f.pool.query('SELECT request_count FROM platform_mcp_rate WHERE user_id=$1',[user.id])).rows[0].request_count,60);
    await f.pool.query("UPDATE platform_mcp_rate SET window_start=now()-interval '2 minutes' WHERE user_id=$1",[user.id]);assert.equal((await f.rpc(claims)).status,200);
  });

});
