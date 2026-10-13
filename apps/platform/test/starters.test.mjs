import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fixture } from './helpers.mjs';
import { testDependencies } from './site-dependencies.mjs';
import { call, prepare } from './draft-fixture.mjs';
import { profileComposition } from '../../../packages/site-core/fixtures/starters/profile.mjs';
import { composition } from '@a2aviary/site-core/fixtures/presentation';
import { migrate } from '../src/migrate.ts';

for (const name of ['dark-en','light-es','contrast-es']) test('profile starter fills and builds via MCP: ' + name, async t => {
  const deps = testDependencies(), f = await fixture(deps); t.after(f.close);
  const user = await f.user('tester@example.invalid');
  const input = await profileComposition(name);
  const saved = await prepare(f,user,input,true,created => {
    assert(Buffer.byteLength(JSON.stringify(created)) <= 4096);
    assert.equal(created.language,null);
    assert(created.requiredInputs.includes('/tokens/fonts/body'));
    assert(created.requiredInputs.includes('/language'));
    assert(created.requiredInputs.includes('/tokens/motion'));
    assert(created.suggestions.length > 0);
    assert.equal(created.starter.version,'1.0.0');
  }, {id:'profile'});
  assert.deepEqual(saved.blockers,[]); assert.deepEqual(saved.requiredInputs,[]);
  assert(saved.suggestions.length > 0);
  await f.app.sites.processOne();
  assert.equal(deps.counts.verifies,1);
  const row = (await f.pool.query('SELECT spec,state FROM platform_site_spec WHERE id=$1',[saved.specId])).rows[0];
  assert.equal(row.state,'verified');
  assert.equal(row.spec.pages[0].sections.length,7);
  if (name === 'contrast-es') assert(Object.values(row.spec.tokens.fonts).every(f=>f.startsWith('system-')));
  if (process.env.STARTER_VERIFIER_INPUT && name === 'dark-en') {
    const assets = {};
    for (const a of row.spec.assets) {
      const staged = (await f.pool.query('SELECT key FROM platform_asset_staging WHERE draft_id=$1 AND asset_id=$2',[saved.draftId,a.id])).rows[0];
      assets[a.id] = (await deps.objects.get(staged.key)).toString('base64');
    }
    await mkdir(process.env.STARTER_VERIFIER_INPUT,{recursive:true});
    await writeFile(process.env.STARTER_VERIFIER_INPUT + '/input.json',JSON.stringify({spec:row.spec,assets}));
  }
  if (name === 'dark-en') {
    const full = await call(f,user,'site.draft.get',{draftId:saved.draftId,detail:'full'});
    const section = full.content.pages[0].sections.find(s=>s.id==='experience');
    const changed = await call(f,user,'site.draft.apply',{draftId:saved.draftId,expectedRevision:full.revision,requestId:randomUUID(),operations:[{op:'upsert-block',pageId:'profile',sectionId:'experience',block:{...section.blocks[0],variant:'standard'}}]});
    assert.deepEqual(changed.blockers,[]); assert.deepEqual(changed.suggestions,saved.suggestions);
    const preview = await call(f,user,'site.preview',{draftId:saved.draftId,expectedRevision:changed.revision});
    assert.equal(preview.isError,false,JSON.stringify(preview));
    await f.app.sites.processOne(); assert.equal(deps.counts.verifies,2);
  }
  assert.equal(deps.counts.deploys,0);
});

test('starter discovery, atomic creation, retry binding and immutable provenance',async t => {
  const f = await fixture(testDependencies()); t.after(f.close);
  const tester = await f.user('tester@example.invalid'), client = await f.user('client@example.invalid');
  assert.equal((await call(f,tester,'starters.list')).starters[0].id,'profile');
  assert.deepEqual((await call(f,client,'starters.list')).starters,[]);
  for (const name of ['starter.get','site.draft.create']) {
    const args = name === 'starter.get' ? {id:'profile'} : {slug:'denied',requestId:randomUUID(),starter:{id:'profile'}};
    const denied = await call(f,client,name,args);
    assert(denied.isError); assert(JSON.stringify(denied).includes('starter_unavailable'));
  }
  assert.equal((await f.pool.query('SELECT count(*)::int AS count FROM platform_site')).rows[0].count,0);
  const detail = await call(f,tester,'starter.get',{id:'profile'});
  assert.equal(detail.seed.pages[0].sections[0].blocks[0].component,'profile-card');
  const args = {slug:'fictional-provenance',requestId:randomUUID(),starter:{id:'profile'}};
  const created = await call(f,tester,'site.draft.create',args);
  assert.deepEqual(await call(f,tester,'site.draft.create',args),created);
  const conflict = await call(f,tester,'site.draft.create',{...args,starter:{id:'profile',version:'1.0.0'}});
  assert(conflict.isError); assert(JSON.stringify(conflict).includes('idempotency_conflict'));
  const full = await call(f,tester,'site.draft.get',{draftId:created.draftId,detail:'full'});
  assert.equal(full.content.tokens,undefined); assert.equal(full.content.language,undefined); assert.equal(full.content.shell,undefined);
  assert(full.content.pages.every(p=>p.sections.every(s=>s.blocks.every(b=>Object.keys(b.props).length===0))));
  for (const [column,value] of [['kind','other'],['starter_id','other'],['starter_version','2.0.0'],['starter_id',null]])
    await assert.rejects(f.pool.query(`UPDATE platform_site SET ${column}=$2 WHERE id=$1`,[created.siteId,value]),/immutable site provenance/);
  await migrate(f.pool); // checksum-pinned migrator rerun is a no-op
  const blank = await call(f,client,'site.draft.create',{slug:'fictional-blank',requestId:randomUUID()});
  assert.equal(blank.language,'en'); assert.equal(blank.starter,null);
  assert.deepEqual(blank.suggestions,[]);
  await assert.rejects(f.pool.query("UPDATE platform_site SET starter_id='profile',starter_version='1.0.0' WHERE id=$1",[blank.siteId]),/immutable site provenance/);
  const preview = await call(f,tester,'site.preview',{draftId:created.draftId,expectedRevision:0});
  assert(preview.isError);
});

test('starter provenance survives complete free composition; explicit inputs never fall back',async t => {
  const deps=testDependencies(), f=await fixture(deps);t.after(f.close);
  const user=await f.user('tester@example.invalid');
  const created=await call(f,user,'site.draft.create',{slug:'fictional-free',requestId:randomUUID(),starter:{id:'profile'}});
  const input=await composition('contrast-es',{image:false,contact:false});
  const section={id:'questions',blocks:[{id:'answers',component:'faq',variant:'standard',props:{heading:'Preguntas',items:[{question:'¿Es ficticio?',answer:'Sí, es una demostración.'}]}}]};
  const pages=[{id:'home',path:'/',seo:{title:'Demostración',description:'Composición ficticia.'},sections:[section]},{id:'more',path:'/more/',seo:{title:'Más',description:'Otra página ficticia.'},sections:[structuredClone(section)]}];
  const args={draftId:created.draftId,expectedRevision:0,requestId:randomUUID(),operations:[{op:'remove-page',pageId:'profile'},{op:'settings',settings:{tokens:input.spec.tokens,language:'es',shell:input.spec.shell,navigation:{primary:[{label:'Inicio',pageId:'home'}],footer:[]},cms:{collections:[]}}},...pages.map((page,index)=>({op:'upsert-page',page,index}))]};
  let saved=await call(f,user,'site.draft.apply',args);
  assert.equal(saved.isError,false,JSON.stringify(saved));assert.deepEqual(saved.blockers,[]);assert(saved.suggestions.length);
  const tokens={...input.spec.tokens,motion:'none',layout:'boxed',radius:0};
  saved=await call(f,user,'site.draft.apply',{draftId:created.draftId,expectedRevision:saved.revision,requestId:randomUUID(),operations:[{op:'settings',settings:{tokens}}]});
  assert.deepEqual(saved.blockers,[]);
  const preview=await call(f,user,'site.preview',{draftId:created.draftId,expectedRevision:saved.revision});assert.equal(preview.isError,false,JSON.stringify(preview));
  await f.app.sites.processOne();assert.equal(deps.counts.verifies,1);
  // These would be eligible for the legacy English shell/font path without the immutable marker.
  saved=await call(f,user,'site.draft.apply',{draftId:created.draftId,expectedRevision:saved.revision,requestId:randomUUID(),operations:[{op:'settings',settings:{language:'en',shell:{},tokens:{colors:tokens.colors,spacing:24,radius:0}}}]});
  assert(saved.requiredInputs.includes('/tokens/fonts/body'));assert(saved.requiredInputs.includes('/shell/skipLink'));
  const denied=await call(f,user,'site.preview',{draftId:created.draftId,expectedRevision:saved.revision});assert(denied.isError);
  assert.equal((await f.pool.query('SELECT starter_id FROM platform_site WHERE id=$1',[created.siteId])).rows[0].starter_id,'profile');
});

test('migration 008 preserves pre-existing sites and rejects partial or unsupported provenance',async t => {
  const f=await fixture(testDependencies());t.after(f.close);
  const user=await f.user('tester@example.invalid');
  // Reconstruct the pre-008 schema inside this disposable loopback-only schema.
  await f.pool.query('DROP TRIGGER platform_site_provenance_immutable ON platform_site; DROP FUNCTION platform_site_provenance_immutable(); ALTER TABLE platform_site DROP COLUMN kind, DROP COLUMN starter_id, DROP COLUMN starter_version');
  await f.pool.query("DELETE FROM platform_migration WHERE name='008-site-starters.sql'");
  const id=randomUUID();
  await f.pool.query("INSERT INTO platform_site(id,owner_id,slug,plan_id,policy_version,test_mode) VALUES($1,$2,'fictional-before','web-simple','2.2.0',true)",[id,user.id]);
  await migrate(f.pool); await migrate(f.pool);
  const row=(await f.pool.query('SELECT kind,starter_id,starter_version FROM platform_site WHERE id=$1',[id])).rows[0];
  assert.deepEqual(row,{kind:'website',starter_id:null,starter_version:null});
  await f.pool.query("UPDATE platform_site SET kind='website',starter_id=NULL,starter_version=NULL WHERE id=$1",[id]);
  for (const [kind,starter,version] of [['app',null,null],['website','profile',null],['website',null,'1.0.0']])
    await assert.rejects(f.pool.query("INSERT INTO platform_site(id,owner_id,slug,plan_id,policy_version,kind,starter_id,starter_version) VALUES($1,$2,$3,'web-simple','2.2.0',$4,$5,$6)",[randomUUID(),user.id,'fictional-'+randomUUID(),kind,starter,version]),/check constraint/);
});
