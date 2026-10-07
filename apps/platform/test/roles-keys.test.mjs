import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, exportJWK} from 'jose';
import {Store, TOOL_ROLES, ALL_ROLES, requireRole, validatePublicKey} from '../src/store.ts';
import {fixture} from './helpers.mjs';


const discoveryAndOwnKeys = ['capabilities.get','plans.list','plan.get_manifest','plan.get_schemas','policy.version','agent_keys.register','agent_keys.list','agent_keys.revoke'];
// Independent permission expectations: widening the implementation map must fail.
const expectedTools = {client: discoveryAndOwnKeys, tester: discoveryAndOwnKeys,
  admin: discoveryAndOwnKeys,
  superadmin: [...discoveryAndOwnKeys,'admin.audit.list','admin.invite','admin.revoke','testers.add','testers.remove','testers.list','logs.query']};

test('all role/tool permission combinations',()=>{
  for(const role of ALL_ROLES) for(const tool of new Set([...Object.keys(TOOL_ROLES),...expectedTools.superadmin])) {
    if((role==='superadmin'&&['sites.list','site.inspect','tester.reset'].includes(tool))||expectedTools[role].includes(tool)||(['site.build','site.status','site.deploy','change.request'].includes(tool))||(['site.release.verify','site.release.deploy','site.release.rollback','site.report','site.costs.refresh'].includes(tool)&&role!=='tester')||(role==='superadmin'&&['site.import','site.admin.assign','site.admin.remove','site.admin.list','site.release.reconcile'].includes(tool))) assert.doesNotThrow(()=>requireRole({id:'fictional',role,testMode:role==='tester'},tool));
    else assert.throws(()=>requireRole({id:'fictional',role,testMode:false},tool),/forbidden/);
  }
  for(const role of ALL_ROLES) assert.throws(()=>requireRole({id:'fictional',role,testMode:false},'policy.write'),/forbidden/);
});

test('Postgres roles, key ownership and atomic audit writes',async t=>{
  const f=await fixture();t.after(f.close);
  const owner=await f.user('owner@example.invalid');const client=await f.user('client@example.invalid');const tester=await f.user('tester@example.invalid');const admin=await f.user('admin@example.invalid');
  const key=await validatePublicKey(await exportJWK((await generateKeyPair('ES256')).publicKey));
  const call=async(user,name,args={})=>{const r=await f.rpc(await f.token(user),'tools/call',{name,arguments:args});assert.equal(r.status,200);return r.json()};
  await t.test('verified config bootstrap, allowlisted tester, client default and invited admin',async()=>{
    assert.equal((await f.app.store.principal(owner.id)).role,'superadmin');assert.equal((await f.app.store.principal(client.id)).role,'client');assert.equal((await f.app.store.principal(tester.id)).role,'tester');assert.equal((await f.app.store.principal(admin.id)).role,'client');
    await assert.rejects(f.app.store.inviteAdmin(client.id,admin.email,`INVITE_ADMIN:${admin.email}`),/forbidden/);
    await assert.rejects(f.app.store.inviteAdmin(owner.id,admin.email,'yes'),/confirmation_required/);
    await assert.rejects(f.app.store.inviteAdmin(owner.id,tester.email,`INVITE_ADMIN:${tester.email}`),/reserved_identity/);
    await assert.rejects(f.app.store.inviteAdmin(owner.id,owner.email,`INVITE_ADMIN:${owner.email}`),/reserved_identity/);
    const result=await f.app.store.inviteAdmin(owner.id,admin.email,`INVITE_ADMIN:${admin.email}`);assert.equal(result.delivery,'no_message_sent');
    assert.equal((await f.app.store.principal(admin.id)).role,'admin');
    const log=(await f.pool.query("SELECT action,details FROM platform_audit WHERE actor_user_id=$1 AND action='role.resolve'",[owner.id])).rows;
    assert.equal(log.length,1);assert.equal(log[0].details.role,'superadmin');
    const otherConfig={...f.config,superadminEmail:'other-owner@example.invalid',testerEmails:new Set()};
    const other=new Store(f.pool,otherConfig);assert.equal((await other.principal(owner.id)).role,'client');assert.equal((await other.principal(tester.id)).role,'tester');
    await f.app.store.principal(owner.id);await f.app.store.principal(tester.id);
    const spoofed=await f.rpc(await f.token(client,{role:'superadmin',email:owner.email}));assert.equal((await spoofed.json()).result.tools.some(t=>t.name==='admin.invite'),false);
  });
  await t.test('unverified owner cannot bootstrap; invitations expire and cannot be claimed by an unverified user',async()=>{
    const unverified=await f.user('unverified-admin@example.invalid',false);
    await f.app.store.inviteAdmin(owner.id,unverified.email,`INVITE_ADMIN:${unverified.email}`);await assert.rejects(f.app.store.principal(unverified.id),/verified_user_required/);
    const expired=await f.user('expired@example.invalid');await f.app.store.inviteAdmin(owner.id,expired.email,`INVITE_ADMIN:${expired.email}`);
    await f.pool.query("UPDATE platform_invitation SET expires_at=now()-interval '1 second' WHERE email=$1",[expired.email]);assert.equal((await f.app.store.principal(expired.id)).role,'client');
    await f.pool.query('UPDATE "user" SET "emailVerified"=false WHERE id=$1',[owner.id]);await assert.rejects(f.app.store.principal(owner.id),/verified_user_required/);
    await f.pool.query('UPDATE "user" SET "emailVerified"=true WHERE id=$1',[owner.id]);
  });
  await t.test('tools/list and hidden tools/call are scoped for each live role',async()=>{
    for(const [user,role] of [[owner,'superadmin'],[admin,'admin'],[client,'client'],[tester,'tester']]){
      const r=await f.rpc(await f.token(user));const names=(await r.json()).result.tools.map(t=>t.name).sort();
      assert.deepEqual(names,[...expectedTools[role]].sort());
      if(role!=='superadmin'){const hidden=await call(user,'admin.invite',{email:'new@example.invalid',confirmation:'INVITE_ADMIN:new@example.invalid'});assert.ok(hidden.error||hidden.result?.isError);}
    }
    await assert.rejects(f.app.store.revokeAdmin(client.id,admin.id,`REVOKE_ADMIN:${admin.id}`),/forbidden/);
    await assert.rejects(f.app.store.revokeAdmin(owner.id,owner.id,`REVOKE_ADMIN:${owner.id}`),/invited_admin_required/);
    await assert.rejects(f.app.store.revokeAdmin(owner.id,admin.id,'yes'),/confirmation_required/);
    await f.app.store.revokeAdmin(owner.id,admin.id,`REVOKE_ADMIN:${admin.id}`);
    const hidden=await call(admin,'admin.audit.list',{});assert.ok(hidden.error||hidden.result?.isError);
    await f.app.store.inviteAdmin(owner.id,admin.email,`INVITE_ADMIN:${admin.email}`);await f.app.store.principal(admin.id);
  });
  let keyId;
  await t.test('register binds only actor, requires confirmation and rejects duplicate fingerprints',async()=>{
    await assert.rejects(f.app.store.registerKey(client.id,key,'yes'),/confirmation_required/);
    const result=await f.app.store.registerKey(client.id,key,'REGISTER_MY_AGENT_KEY');keyId=result.keyId;assert.equal(result.transportStatus,'pending_owner_email_enrollment');
    assert.equal((await f.app.store.listKeys(client.id)).keys[0].publicJwk.d,undefined);assert.deepEqual((await f.app.store.listKeys(owner.id)).keys,[]);
    await assert.rejects(f.app.store.registerKey(owner.id,key,'REGISTER_MY_AGENT_KEY'),/key_already_registered/);
    const event=(await f.pool.query("SELECT * FROM platform_audit WHERE target=$1 AND action='agent_key.register'",[keyId])).rows[0];assert.equal(event.actor_user_id,client.id);assert.equal(event.details.thumbprint,key.thumbprint);
  });
  await t.test('another human cannot revoke even as superadmin; confirmation identifies exact key',async()=>{
    await assert.rejects(f.app.store.revokeKey(owner.id,keyId,`REVOKE_MY_AGENT_KEY:${keyId}`),/active_owned_key_required/);
    await assert.rejects(f.app.store.revokeKey(client.id,keyId,'REVOKE_MY_AGENT_KEY:other'),/confirmation_required/);
    const result=await f.app.store.revokeKey(client.id,keyId,`REVOKE_MY_AGENT_KEY:${keyId}`);assert.equal(result.emailRegistryRevocationRequired,true);
    assert.ok((await f.app.store.listKeys(client.id)).keys[0].revokedAt);await assert.rejects(f.app.store.revokeKey(client.id,keyId,`REVOKE_MY_AGENT_KEY:${keyId}`),/active_owned_key_required/);
    await assert.rejects(f.app.store.registerKey(client.id,key,'REGISTER_MY_AGENT_KEY'),/key_already_registered/);
  });
  await t.test('failed audit insert rolls back privileged writes; concurrent key registrations cannot double-bind',async()=>{
    const next=await validatePublicKey(await exportJWK((await generateKeyPair('ES256')).publicKey));
    await f.pool.query("CREATE FUNCTION reject_registration_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='agent_key.register' THEN RAISE EXCEPTION 'fictional audit failure'; END IF; RETURN NEW; END $$");
    await f.pool.query('CREATE TRIGGER reject_registration_audit BEFORE INSERT ON platform_audit FOR EACH ROW EXECUTE FUNCTION reject_registration_audit()');
    await assert.rejects(f.app.store.registerKey(client.id,next,'REGISTER_MY_AGENT_KEY'),/fictional audit failure/);
    assert.equal((await f.pool.query('SELECT count(*)::int FROM platform_agent_key WHERE thumbprint=$1',[next.thumbprint])).rows[0].count,0);
    await f.pool.query('DROP TRIGGER reject_registration_audit ON platform_audit');
    const concurrent=await Promise.allSettled([f.app.store.registerKey(client.id,next,'REGISTER_MY_AGENT_KEY'),f.app.store.registerKey(owner.id,next,'REGISTER_MY_AGENT_KEY')]);assert.equal(concurrent.filter(r=>r.status==='fulfilled').length,1);
  });
  await t.test('tester activity is tagged; audit reads are private, bounded, paginated and audited',async()=>{
    const discovery=await call(tester,'capabilities.get');const data=JSON.parse(discovery.result.content[0].text);assert.equal(data.testMode,true);assert.equal(data.mandate,'discovery-only');
    const testLog=(await f.pool.query("SELECT test_mode FROM platform_audit WHERE actor_user_id=$1 AND action='tool.call'",[tester.id])).rows;assert.ok(testLog.length);assert.ok(testLog.every(r=>r.test_mode));
    await assert.rejects(f.app.store.auditList(client.id,undefined,1,'READ_PRIVATE_AUDIT_LOG'),/forbidden/);
    await assert.rejects(f.app.store.auditList(admin.id,undefined,1,'yes'),/confirmation_required/);
    await assert.rejects(f.app.store.auditList(admin.id,undefined,2,'READ_PRIVATE_AUDIT_LOG'),/forbidden/);
    const first=await f.app.store.auditList(owner.id,undefined,2,'READ_PRIVATE_AUDIT_LOG');assert.equal(first.records.length,2);assert.ok(first.nextBefore);
    const second=await f.app.store.auditList(owner.id,first.nextBefore,2,'READ_PRIVATE_AUDIT_LOG');assert.ok(second.records.every(r=>BigInt(r.id)<BigInt(first.nextBefore)));
    assert.ok((await f.pool.query("SELECT id FROM platform_audit WHERE action='audit.read' AND actor_user_id=$1",[owner.id])).rowCount);
    const invalid=await call(owner,'admin.audit.list',{limit:101,confirmation:'READ_PRIVATE_AUDIT_LOG'});assert.ok(invalid.error||invalid.result?.isError);
  });
  await t.test('read-only plan tools serve exact generated artifacts and reject unsupported versions and capabilities',async()=>{
    const plans=await call(client,'plans.list');assert.deepEqual(JSON.parse(plans.result.content[0].text).plans,[{planId:'web-simple',policyVersion:'1.0.0',status:'contract-only'}]);
    for(const [name,expected] of [['plan.get_manifest',f.app.plans.manifest],['plan.get_schemas',f.app.plans.siteSpec]]) {
      const result=await call(client,name,{planId:'web-simple',policyVersion:'1.0.0'});const value=JSON.parse(result.result.content[0].text);assert.deepEqual(name==='plan.get_manifest'?value.manifest:value.siteSpec,expected);
      const invalid=await call(client,name,{planId:'../private',policyVersion:'latest'});assert.ok(invalid.error||invalid.result?.isError);
    }
    const version=await call(client,'policy.version');assert.equal(JSON.parse(version.result.content[0].text).policySha256,f.app.plans.manifest.policySha256);
    for(const name of ['policy.write','website.generate','plans.enroll']) {const r=await call(client,name);assert.ok(r.error||r.result?.isError);}
    const extra=await call(client,'capabilities.get',{role:'superadmin'});assert.ok(extra.error||extra.result?.isError);
  });
});

test('ES256 validation excludes secrets, wrong curves, noncanonical and invalid coordinates',async()=>{
  const pair=await generateKeyPair('ES256',{extractable:true});const publicJwk=await exportJWK(pair.publicKey);
  assert.ok((await validatePublicKey(publicJwk)).thumbprint);
  for(const key of [null,[],{...publicJwk,d:'private'},{...publicJwk,crv:'P-384'},{...publicJwk,alg:'HS256'},{...publicJwk,use:'enc'},{...publicJwk,key_ops:['sign']},{...publicJwk,key_ops:{length:1,0:'verify'}},{...publicJwk,x:'A'.repeat(43),y:'A'.repeat(43)},{...publicJwk,x:publicJwk.x+'='},{...publicJwk,endpoint:'https://attacker.example.invalid'}]) await assert.rejects(validatePublicKey(key),/invalid_public_key/);
});
