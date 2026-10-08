import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {readConfig} from '../src/config.ts';
import {loadPlans} from '../src/plans.ts';
import {validateCimdMetadata,validateClientIdUrl} from '@better-auth/cimd';
import {env} from './helpers.mjs';

test('configuration rejects insecure origins, unpinned production resources and invalid bootstrap settings',()=>{
  assert.equal(readConfig(env).dcr,false);assert.equal(readConfig({...env,OAUTH_ENABLE_DCR:'true'}).dcr,true);
  assert.equal(readConfig({...env,PLATFORM_ORIGIN:'https://mcp.a2aviary.io'}).resource,'https://mcp.a2aviary.io/mcp');
  for(const PLATFORM_ORIGIN of ['http://external.example.invalid','https://other.example.invalid','https://mcp.a2aviary.io/','https://mcp.a2aviary.io/path','https://user:pass@mcp.a2aviary.io','https://mcp.a2aviary.io?value=1']) assert.throws(()=>readConfig({...env,PLATFORM_ORIGIN}));
  for(const patch of [{BETTER_AUTH_SECRET:'short'},{PLATFORM_SUPERADMIN_EMAIL:'bad'},{PLATFORM_TESTER_EMAILS:'bad'},{PLATFORM_TESTER_EMAILS:env.PLATFORM_SUPERADMIN_EMAIL},{OAUTH_ENABLE_DCR:'yes'},{PORT:'0'},{PORT:'65536'},{PORT:'1.5'}]) assert.throws(()=>readConfig({...env,...patch}));
  for(const name of ['PLATFORM_ORIGIN','DATABASE_URL','BETTER_AUTH_SECRET','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','PLATFORM_SUPERADMIN_EMAIL']) assert.throws(()=>{const incomplete={...env};delete incomplete[name];readConfig(incomplete)},new RegExp(name));
  assert.equal(readConfig({...env,PLATFORM_SUPERADMIN_EMAIL:'OWNER@EXAMPLE.INVALID'}).superadminEmail,'owner@example.invalid');
});

test('alternate deployment origins require exact HTTPS opt-in and retain canonical defaults',()=>{
  const staging='https://platform-production-d84c.up.railway.app';
  const base={...env,NODE_ENV:'production',PLATFORM_ORIGIN:staging};
  for(const PLATFORM_ALLOWED_ORIGINS of [undefined,'','  ','https://other.example.invalid']) assert.throws(()=>readConfig({...base,PLATFORM_ALLOWED_ORIGINS}),/explicitly listed/);
  for(const PLATFORM_ALLOWED_ORIGINS of [staging,` https://other.example.invalid, ${staging} `]) {
    const config=readConfig({...base,PLATFORM_ALLOWED_ORIGINS});
    assert.equal(config.origin,staging);
    assert.equal(config.resource,staging+'/mcp');
    assert.equal(config.issuer,staging+'/api/auth');
    assert.equal(config.dcr,false);
    // An allowlist selects one deployment origin; other listed hosts are not interchangeable.
    assert.throws(()=>readConfig({...base,PLATFORM_ALLOWED_ORIGINS,PLATFORM_ORIGIN:staging+'.evil.example.invalid'}));
    assert.equal(readConfig({...base,PLATFORM_ALLOWED_ORIGINS,PLATFORM_ORIGIN:'https://mcp.a2aviary.io'}).resource,'https://mcp.a2aviary.io/mcp');
  }
  assert.equal(readConfig({...env,PLATFORM_ALLOWED_ORIGINS:''}).origin,env.PLATFORM_ORIGIN);
  assert.equal(readConfig({...env,NODE_ENV:'production',PLATFORM_ORIGIN:'https://mcp.a2aviary.io'}).origin,'https://mcp.a2aviary.io');
});

test('origin allowlist fails closed on malformed, insecure, wildcard or non-origin entries',()=>{
  for(const entry of ['http://other.example.invalid','http://localhost:3000','https://*.up.railway.app','*','null','https://user:pass@other.example.invalid','https://other.example.invalid/','https://other.example.invalid/path','https://other.example.invalid?x=1','https://other.example.invalid#fragment','https://OTHER.example.invalid','https://other.example.invalid:443','','not-a-url']) {
    // Reject bad entries even when PLATFORM_ORIGIN is the canonical host.
    const PLATFORM_ALLOWED_ORIGINS=`https://staging.example.invalid,${entry}`;
    assert.throws(()=>readConfig({...env,PLATFORM_ORIGIN:'https://mcp.a2aviary.io',PLATFORM_ALLOWED_ORIGINS}),/PLATFORM_ALLOWED_ORIGINS/);
  }
  for(const PLATFORM_ORIGIN of ['http://external.example.invalid','https://other.example.invalid/','https://other.example.invalid/path','https://user:pass@other.example.invalid']) assert.throws(()=>readConfig({...env,PLATFORM_ORIGIN,PLATFORM_ALLOWED_ORIGINS:PLATFORM_ORIGIN}));
});

test('MCP CIMD profile rejects missing identity fields and unsafe metadata destinations',()=>{
  const url='https://connector.example.invalid/oauth/client.json';
  const metadata={client_id:url,client_name:'Fictional connector',redirect_uris:['https://connector.example.invalid/callback'],token_endpoint_auth_method:'none'};
  assert.equal(validateCimdMetadata(url,metadata,{metadataProfile:'mcp-2026-07-28'}).valid,true);
  for(const key of ['client_name','redirect_uris']) {const incomplete={...metadata};delete incomplete[key];assert.equal(validateCimdMetadata(url,incomplete,{metadataProfile:'mcp-2026-07-28'}).valid,false);}
  for(const clientId of ['http://connector.example.invalid/id','https://127.0.0.1/id','https://169.254.169.254/id','https://localhost/id','https://[::1]/id']) assert.notEqual(validateClientIdUrl(clientId),null);
});

test('runtime plans fail closed on mismatched policy or schema provenance',async t=>{
  const root=await mkdtemp(tmpdir()+'/a2aviary-platform-contracts-');t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(root+'/contracts/site',{recursive:true});await cp(new URL('../../../contracts/site/1.0.1/',import.meta.url),root+'/contracts/site/1.0.1',{recursive:true});await cp(new URL('../../../plans/',import.meta.url),root+'/plans',{recursive:true});
  const base=pathToFileURL(root+'/');assert.equal((await loadPlans(base)).version,'1.0.1');
  const path=root+'/contracts/site/1.0.1/manifest.json';const original=await readFile(path,'utf8');const data=JSON.parse(original);data.policySha256='0'.repeat(64);await writeFile(path,JSON.stringify(data));await assert.rejects(loadPlans(base),/Stale/);
  await writeFile(path,original);
  const schema=root+'/contracts/site/1.0.1/site-spec.schema.json';const value=JSON.parse(await readFile(schema,'utf8'));value['x-provenance'].policySha256='0'.repeat(64);await writeFile(schema,JSON.stringify(value));await assert.rejects(loadPlans(base),/Stale/);
});
