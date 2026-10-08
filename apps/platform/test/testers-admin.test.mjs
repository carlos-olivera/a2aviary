import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './helpers.mjs';
import {testDependencies} from './site-dependencies.mjs';
import {prepare,approve,call} from './draft-fixture.mjs';
test('tester eligibility, isolated fixture deployment, audited reset and retained account/approval history',async t=>{
 const d=testDependencies(),f=await fixture(d);t.after(f.close);const owner=await f.user('owner@example.invalid'),u=await f.user('new-tester@example.invalid');
 assert.equal((await call(f,u,'testers.add',{email:u.email})).error,'forbidden');await f.app.store.tester(owner.id,'testers.add',u.email);assert.equal((await f.app.store.principal(u.id)).role,'tester');
 const saved=await prepare(f,u);assert.equal((await f.app.sites.status(u.id,saved.siteId)).test,true);await f.app.sites.processOne();await approve(f,u,saved.specId);
 await assert.rejects(f.app.sites.deploy(u.id,saved.siteId,saved.specId,'fictional-password-12345','DEPLOY_SITE:'+saved.siteId+':example.invalid','example.invalid'),/test_custom_domain/);
 await f.app.sites.deploy(u.id,saved.siteId,saved.specId,'fictional-password-12345','DEPLOY_SITE:'+saved.siteId);await f.app.sites.processOne();assert.equal(d.inputs[0].test,true);assert.equal(d.contexts[0].test,true);
 await assert.rejects(f.app.sites.reset(owner.id,saved.siteId,'yes'),/confirmation/);assert.equal((await f.app.sites.reset(owner.id,saved.siteId,'RESET '+saved.siteId)).reset,true);assert.equal(d.data.size,0);assert.equal((await f.app.store.principal(u.id)).role,'tester');assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM platform_site_approval WHERE spec_id=$1',[saved.specId])).rows[0].n,1);assert.equal((await f.pool.query('SELECT lifecycle FROM platform_site WHERE id=$1',[saved.siteId])).rows[0].lifecycle,'archived');assert.equal((await f.app.sites.reset(owner.id,saved.siteId,'RESET '+saved.siteId)).reset,true);
 await f.app.store.tester(owner.id,'testers.remove',u.email);assert.equal((await f.app.store.principal(u.id)).role,'client');
});
