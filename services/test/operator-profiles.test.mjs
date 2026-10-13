import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPair, exportPKCS8, jwtVerify } from 'jose';

test('broker profiles restrict GitHub issuance and preserve default authority', async t => {
  const pair=await generateKeyPair('RS256',{extractable:true});
  const privateKey=await exportPKCS8(pair.privateKey);
  const requests=[],audits=[]; let enabled=true;
  const server=createServer(async(req,res)=>{
    try {
      let text=''; for await(const chunk of req)text+=chunk;
      const body=JSON.parse(text),target=req.headers['x-amz-target']??'';
      let result;
      if(target.endsWith('.GetItem'))result={Item:{pk:{S:'CONTROL#flags'},developmentEnabled:{BOOL:enabled}}};
      else if(target.endsWith('.GetSecretValue'))result={SecretString:JSON.stringify({appId:123,installationId:456,privateKey})};
      else if(target.endsWith('.PutItem')){audits.push(body.Item);result={};}
      else {
        assert.equal(req.url,'/app/installations/456/access_tokens');
        assert.equal(req.method,'POST');
        await jwtVerify(req.headers.authorization.slice(7),pair.publicKey,{issuer:'123',algorithms:['RS256']});
        requests.push(body);
        result={token:'fictional-token',expires_at:'2099-01-01T00:00:00Z',permissions:{...body.permissions,metadata:'read'}};
      }
      res.setHeader('content-type','application/json');res.end(JSON.stringify(result));
    }catch {res.statusCode=500;res.end('{}');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const original={...process.env};
  t.after(async()=>{
    for(const key of Object.keys(process.env))if(!(key in original))delete process.env[key];
    Object.assign(process.env,original);
    await new Promise(resolve=>server.close(resolve));
  });
  const endpoint=`http://127.0.0.1:${server.address().port}`;
  Object.assign(process.env,{A2AVIARY_TARGET:'local',AWS_ENDPOINT_URL:endpoint,GITHUB_BASE_URL:endpoint,STATE_TABLE:'fictional-state',APP_KEY_SECRET:'fictional-app'});
  const {developmentBroker,broker}=await import('../dist/operator.js');
  const base={contents:'write',pull_requests:'write',actions:'read'};
  const changedPaths=['services/src/operator.ts','.github/workflows/release.yml'];
  await t.test('default and explicit development never request workflows, even with changed paths',async()=>{
    for(const event of [{},{profile:'development'},{changedPaths}]) {
      const token=await developmentBroker(event);
      assert.deepEqual(requests.at(-1),{repository_ids:[1403745581],permissions:base});
      assert.deepEqual(token.permissions,{...base,metadata:'read'});
      assert.equal(audits.at(-1).profile.S,'development');
    }
  });
  await t.test('explicit workflow task adds only workflows write and is separately audited',async()=>{
    const token=await developmentBroker({profile:'development-workflows',changedPaths});
    assert.deepEqual(requests.at(-1),{repository_ids:[1403745581],permissions:{...base,workflows:'write'}});
    assert.deepEqual(token.permissions,{...base,workflows:'write',metadata:'read'});
    assert.equal(audits.at(-1).profile.S,'development-workflows');
    assert(!JSON.stringify(audits).includes('fictional-token'));
  });
  await t.test('missing, unrelated, malformed and traversal paths reject before issuance',async()=>{
    const before=requests.length;
    for(const paths of [undefined,[],['services/src/operator.ts'],['.github/workflows-not/release.yml'],['.github/workflows/../release.yml'],['.github/workflows/release.yml',42],['.github/workflows/release.yml','../unsafe'],['/.github/workflows/release.yml'],['.github/workflows/release.yml\n'],['.github/workflows/release.yml','a\\b']]) {
      await assert.rejects(()=>developmentBroker({profile:'development-workflows',changedPaths:paths}),/workflow_changes_required/);
    }
    for(const profile of ['policy','admin','workflows',{},true])await assert.rejects(()=>developmentBroker({profile,changedPaths}),/development_profile_invalid/);
    assert.equal(requests.length,before);
  });
  await t.test('disabled development blocks both profiles',async()=>{
    enabled=false;const before=requests.length;
    for(const event of [{},{profile:'development-workflows',changedPaths}])await assert.rejects(()=>developmentBroker(event),/development_disabled/);
    assert.equal(requests.length,before);enabled=true;
  });
  await t.test('policy broker ignores opt-in and retains its separate permissions',async()=>{
    await broker({profile:'development-workflows',changedPaths});
    assert.deepEqual(requests.at(-1),{repository_ids:[1403745581],permissions:{contents:'read',pull_requests:'read',checks:'write'}});
    assert.equal(audits.at(-1).profile.S,'policy');
  });
});
