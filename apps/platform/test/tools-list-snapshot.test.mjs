import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './helpers.mjs';
import {testDependencies} from './site-dependencies.mjs';
const snapshot=new URL('./fixtures/tools-list.json',import.meta.url);
test('complete MCP tools/list responses preserve every role and workflow mode',async()=>{
 const actual={};
 for(const mode of ['discovery','sites']){
  const f=await fixture(mode==='sites'?testDependencies():undefined);
  try {
   const users={superadmin:await f.user('owner@example.invalid'),tester:await f.user('tester@example.invalid'),client:await f.user('client@example.invalid'),admin:await f.user('admin@example.invalid')};
   await f.app.store.principal(users.superadmin.id);
   await f.app.store.inviteAdmin(users.superadmin.id,users.admin.email,'INVITE_ADMIN:'+users.admin.email);
   actual[mode]={};
   for(const [role,user] of Object.entries(users)){
    const response=await f.rpc(await f.token(user));assert.equal(response.status,200);
    actual[mode][role]=(await response.json()).result;
   }
  }finally{await f.close();}
 }
 assert.deepEqual(actual,JSON.parse(await readFile(snapshot,'utf8')));
});
