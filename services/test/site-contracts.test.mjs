import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { validateSiteSpec, validateAssets, validateChangeRequest, specDigest, defaultPolicy } from '../dist/site/validator.js';
import { artifactDirectory, assertPolicySnapshot, generateContracts, flattenRules } from '../dist/site/generator.js';
import { makeExamples } from '../dist/site/examples.js';
import { policyDecision } from '../dist/policy.js';

const fixture = JSON.parse(await readFile('../contracts/site/v1/examples/site-spec.json', 'utf8'));
const changeFixture = JSON.parse(await readFile('../contracts/site/v1/examples/change-request.json', 'utf8'));
const pixels = await readFile('../contracts/site/v1/examples/fictional-pixel.png');
const invalid = JSON.parse(await readFile('test/site-fixtures/invalid-specs.json', 'utf8'));
const context = () => ({ month: '2026-10', appliedRequests: 0, now: new Date('2026-10-06T12:00:00.000Z') });
const spec = () => structuredClone(fixture);
const approve = s => { s.approval.specSha256 = specDigest(s); return s; };
const expectError = (result, rule, path) => {
  assert.equal(result.ok, false, JSON.stringify(result));
  assert(result.errors.some(e => e.rule === rule && (path === undefined || e.path === path)), JSON.stringify(result.errors));
  for (const e of result.errors) { assert.equal(typeof e.path, 'string'); assert.equal(typeof e.rule, 'string'); assert('limit' in e); assert.equal(typeof e.suggestion, 'string'); }
};
const set = (s, path, value) => { const keys = path.slice(1).split('/'); const key = keys.pop(); const target = keys.reduce((o,k) => o[k], s); target[key] = value; };
const hero = s => s.pages[0].sections[0].blocks[0];
const reviseBlock = b => { const result=structuredClone(b); if('heading' in result.props)result.props.heading='Revised';else result.props.content[0].text='Revised'; return result; };

test('seven-page fictional fixtures validate; copies are returned without mutation', async () => {
  assert.equal(fixture.pages.length, 7);
  const before = JSON.stringify(fixture);
  const valid = validateSiteSpec(fixture); assert.equal(valid.ok, true); assert.notEqual(valid.value, fixture);
  const assets = await validateAssets(fixture.assets, new Map([['fictional-pixel', pixels]])); assert.equal(assets.ok, true, JSON.stringify(assets));
  const changed = validateChangeRequest(changeFixture, fixture, context()); assert.equal(changed.ok, true, JSON.stringify(changed));
  assert.deepEqual(changed.value.accounting, { pagesTouched: 1, blocksModified: 1, globalOperations: 0, monthlyRequestsRemaining: 3 });
  assert.equal(JSON.stringify(fixture), before);
});
for (const scenario of invalid) test(scenario.name, () => {
  const s = spec(); set(s, scenario.path, scenario.value); if (!scenario.preserveApproval) approve(s);
  expectError(validateSiteSpec(s), scenario.rule);
});

test('copy limits count Unicode code points and accept literal text without interpreting instructions', () => {
  const s = spec(); hero(s).props.heading = '😀'.repeat(defaultPolicy.firstVersion.copy.heading.value); approve(s);
  assert.equal(validateSiteSpec(s).ok, true);
  hero(s).props.heading += '😀'; approve(s); expectError(validateSiteSpec(s), 'schema.maxLength', '/pages/0/sections/0/blocks/0/props/heading');
  hero(s).props.heading = '<script>literal text</script>'; approve(s); assert.equal(validateSiteSpec(s).ok, true);
});

const scalarLimits = [
  ['/firstVersion/copy/heading', '/pages/0/sections/0/blocks/0/props/heading'],
  ['/firstVersion/copy/shortCopy', '/pages/0/sections/0/blocks/0/props/text'],
  ['/firstVersion/copy/paragraph', '/pages/0/sections/1/blocks/0/props/content/0/text'],
  ['/firstVersion/copy/label', '/navigation/primary/0/label'],
  ['/firstVersion/copy/alt', '/assets/0/alt'],
  ['/firstVersion/copy/seoTitle', '/pages/0/seo/title'],
  ['/firstVersion/copy/seoDescription', '/pages/0/seo/description']
];
for (const [policyPath, path] of scalarLimits) test('boundary and overflow ' + policyPath, () => {
  const max = policyPath.slice(1).split('/').reduce((v,k)=>v[k], defaultPolicy).value;
  const s = spec(); set(s,path,'x'.repeat(max)); approve(s); assert.equal(validateSiteSpec(s).ok,true);
  set(s,path,'x'.repeat(max+1)); approve(s); const result=validateSiteSpec(s);expectError(result,'schema.maxLength',path);assert(result.errors.some(e=>e.policyPath===policyPath));
});

test('aggregate rich text accepts exact cap and rejects overflow across paragraphs', () => {
  const s=spec(), content=[];for(let i=0;i<4;i++)content.push({type:'paragraph',text:'x'.repeat(2000)});
  s.pages[0].sections[1].blocks[0].props.content=content;approve(s);assert.equal(validateSiteSpec(s).ok,true);
  content.push({type:'paragraph',text:'x'});approve(s);expectError(validateSiteSpec(s),'copy.richText');
});

test('duplicate page, route, section, block and asset identifiers reject', () => {
  for(const mutate of [s=>s.pages[1].id=s.pages[0].id,s=>s.pages[1].path=s.pages[0].path,s=>s.pages[0].sections[1].id=s.pages[0].sections[0].id,s=>s.pages[0].sections[1].blocks[0].id=hero(s).id,s=>s.assets.push(structuredClone(s.assets[0]))]) {const s=spec();mutate(s);approve(s);expectError(validateSiteSpec(s),'reference.duplicate');}
});

test('page, section, block and navigation cardinality boundaries', () => {
  const p=defaultPolicy;
  let s=spec();s.pages.push({...structuredClone(s.pages[1]),id:'extra',path:'/extra/'});approve(s);expectError(validateSiteSpec(s),'schema.maxItems');
  s=spec();s.pages[1].sections=Array.from({length:p.firstVersion.structure.maxSectionsPerPage.value},(_,i)=>({id:'s-'+i,blocks:[{...structuredClone(hero(s)),id:'b-'+i}]}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.pages[1].sections.push({id:'overflow',blocks:[{...structuredClone(hero(s)),id:'overflow'}]});approve(s);expectError(validateSiteSpec(s),'schema.maxItems');
  s=spec();s.pages[1].sections[0].blocks=Array.from({length:6},(_,i)=>({...structuredClone(hero(s)),id:'b-'+i}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.pages[1].sections[0].blocks.push({...structuredClone(hero(s)),id:'overflow'});approve(s);expectError(validateSiteSpec(s),'schema.maxItems');
  s=spec();s.pages[1].sections=Array.from({length:6},(_,i)=>({id:'s-'+i,blocks:Array.from({length:i===5?0:6},(_,j)=>({...structuredClone(hero(s)),id:'b-'+i+'-'+j}))})).filter(v=>v.blocks.length);approve(s);assert.equal(validateSiteSpec(s).ok,true);s.pages[1].sections.push({id:'overflow',blocks:[{...structuredClone(hero(s)),id:'overflow'}]});approve(s);expectError(validateSiteSpec(s),'page.blocks');
  for(const [group,max] of [['primary',8],['footer',12]]) {s=spec();s.navigation[group]=Array.from({length:max},()=>({label:'Home',pageId:'home'}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.navigation[group].push({label:'Home',pageId:'home'});approve(s);expectError(validateSiteSpec(s),'schema.maxItems');}
});

test('each component field and variant rejects unknown, missing and overlarge inputs', () => {
  for(const section of fixture.pages[0].sections) {
    const original=section.blocks[0], definition=defaultPolicy.firstVersion.components[original.component];
    for(const [key,field] of Object.entries(definition.fields)) {
      if(field.required) {const s=spec();hero(s).component=original.component;hero(s).props=structuredClone(original.props);delete hero(s).props[key];approve(s);expectError(validateSiteSpec(s),'schema.required');}
      if(Array.isArray(original.props[key])) {const max=field.kind==='faqItems'?20:12;const s=spec();hero(s).component=original.component;hero(s).props=structuredClone(original.props);hero(s).props[key]=Array.from({length:max},()=>structuredClone(original.props[key][0]));approve(s);const r=validateSiteSpec(s);if(field.kind!=='richText')assert.equal(r.ok,true,JSON.stringify(r));hero(s).props[key].push(structuredClone(original.props[key][0]));approve(s);expectError(validateSiteSpec(s),'schema.maxItems');}
    }
  }
});

test('token allowlists, semantic slots and external-link protocols', () => {
  for(const [path,value] of [['/tokens/fonts/body','Unknown font'],['/tokens/spacing',17],['/tokens/radius',3],['/tokens/colors/text','var(--secret)'],['/tokens/colors/custom','#FFFFFF']]) {const s=spec();set(s,path,value);approve(s);expectError(validateSiteSpec(s),path.includes('colors')?(path.endsWith('custom')?'schema.additionalProperties':'schema.pattern'):'schema.enum');}
  for(const url of ['javascript:alert(1)','data:text/html,example','http://example.invalid','https://user:password@example.invalid','https://example.invalid/\nheader','mailto:hello@example.invalid?bcc=other@example.invalid','tel:javascript']) {const s=spec();s.navigation.primary=[{label:'External',url}];approve(s);expectError(validateSiteSpec(s),'schema.format');}
  for(const url of ['https://example.invalid/','mailto:hello@example.invalid','tel:+12025550123','https://wa.me/12025550123']) {const s=spec();s.navigation.primary=[{label:'External',url}];approve(s);assert.equal(validateSiteSpec(s).ok,true);}
});

test('asset declaration caps and total bytes', () => {
  for(const [key,max] of [['bytes',2097152],['width',4096],['height',4096]]) {const s=spec();s.assets[0][key]=max;approve(s);assert.equal(validateSiteSpec(s).ok,true);s.assets[0][key]=max+1;approve(s);expectError(validateSiteSpec(s),'schema.maximum');}
  let s=spec();s.assets=Array.from({length:50},(_,i)=>({...fixture.assets[0],id:i===0?'fictional-pixel':'pixel-'+i}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.assets.push({...fixture.assets[0],id:'overflow'});approve(s);expectError(validateSiteSpec(s),'schema.maxItems');
  s=spec();s.assets=Array.from({length:13},(_,i)=>({...fixture.assets[0],id:i===0?'fictional-pixel':'pixel-'+i,bytes:i===12?1048576:2097152}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.assets[12].bytes++;approve(s);expectError(validateSiteSpec(s),'assets.totalBytes');
});

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const describe = async (bytes, format) => {const m=await sharp(bytes).metadata();return {...fixture.assets[0],format,bytes:bytes.length,width:m.width,height:m.height,sha256:hash(bytes)};};
test('actual PNG, JPEG and WebP decode; mismatches, corruption, missing and extra bytes reject', async () => {
  for(const format of ['png','jpeg','webp']) {const bytes=await sharp({create:{width:2,height:3,channels:3,background:'#446688'}})[format]().toBuffer();const a=await describe(bytes,format);assert.equal((await validateAssets([a],new Map([[a.id,bytes]]))).ok,true);}
  const a=fixture.assets[0];
  expectError(await validateAssets([a],new Map([[a.id,Buffer.from('not an image')]])),'asset.format');
  expectError(await validateAssets([a],new Map()),'asset.missing');
  expectError(await validateAssets([a],new Map([[a.id,pixels],['extra',pixels]])),'asset.extra');
  for(const [key,value,rule] of [['sha256','0'.repeat(64),'asset.hash'],['bytes',a.bytes+1,'asset.bytesMismatch'],['width',2,'asset.widthMismatch'],['height',2,'asset.heightMismatch'],['format','jpeg','asset.formatMismatch']])expectError(await validateAssets([{...a,[key]:value}],new Map([[a.id,pixels]])),rule);
  for(const bytes of [pixels.subarray(0,pixels.length-15)])expectError(await validateAssets([{...a,bytes:bytes.length,sha256:hash(bytes)}],new Map([[a.id,bytes]])),'asset.decode');
  expectError(await validateAssets([a],new Map([[a.id,Buffer.alloc(2097153)]])),'asset.bytes');
  const gif=Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7','base64');expectError(await validateAssets([{...a,bytes:gif.length,sha256:hash(gif)}],new Map([[a.id,gif]])),'asset.format');
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script/></svg>');expectError(await validateAssets([{...a,bytes:svg.length,sha256:hash(svg)}],new Map([[a.id,svg]])),'asset.format');
});

test('actual dimensional and bundle-byte limits cannot be bypassed with metadata', async () => {
  const wide=await sharp({create:{width:4097,height:1,channels:3,background:'#446688'}}).png().toBuffer();const a=await describe(wide,'png');a.width=4096;expectError(await validateAssets([a],new Map([[a.id,wide]])),'asset.dimensions');
  const p=structuredClone(defaultPolicy);p.firstVersion.images.maxTotalBytes.value=pixels.length;
  const assets=[fixture.assets[0],{...fixture.assets[0],id:'other'}];expectError(await validateAssets(assets,new Map(assets.map(a=>[a.id,pixels])),p),'assets.totalBytes');
});

test('animated WebP rejects without editing it', async () => {
  const bytes=await sharp(Buffer.from([0,0,0,255,255,255]),{raw:{width:1,height:2,channels:3,pageHeight:1}}).webp({loop:0,delay:[100,100]}).toBuffer();
  const m=await sharp(bytes).metadata();assert.equal(m.pages,2);
  const a={...fixture.assets[0],format:'webp',bytes:bytes.length,width:1,height:1,sha256:hash(bytes)};
  expectError(await validateAssets([a],new Map([[a.id,bytes]])),'asset.animated');
});

test('canonical digest binds all body fields, preserves array order and includes preview', () => {
  const s=spec(), reordered=Object.fromEntries(Object.entries(s).reverse());assert.equal(specDigest(s),specDigest(reordered));
  s.approval.approvedAt='2026-10-06T13:00:00.000Z';assert.equal(specDigest(s),specDigest(fixture));
  s.preview={artifactId:'fictional-preview',sha256:'0'.repeat(64)};expectError(validateSiteSpec(s),'approval.digest');approve(s);assert.equal(validateSiteSpec(s).ok,true);
  s.pages.reverse();expectError(validateSiteSpec(s),'approval.digest');
});

test('serialized submission cap, cyclic and non-JSON values', () => {
  const s=spec();s.large='x'.repeat(262144);expectError(validateSiteSpec(s),'submission.bytes');
  const cyclic={};cyclic.self=cyclic;expectError(validateSiteSpec(cyclic),'submission.json');
  const n=spec();n.tokens.spacing=Infinity;expectError(validateSiteSpec(n),'submission.json');
  const missing=spec();missing.pages=[];approve(missing);expectError(validateSiteSpec(missing),'schema.minItems');
});

test('policy generates deterministic schemas and examples; drift check is read-only', () => {
  assert.deepEqual(generateContracts(defaultPolicy),generateContracts(structuredClone(defaultPolicy)));
  execFileSync(process.execPath,['scripts/site/generate.ts','--check'],{stdio:'pipe'});
  assert.deepEqual(makeExamples(defaultPolicy,fixture.assets[0]),{spec:fixture,change:changeFixture});
  const p=structuredClone(defaultPolicy);p.includes.maxPages.value=6;const schema=generateContracts(p).siteSchema;assert.equal(schema.properties.pages.maxItems,6);expectError(validateSiteSpec(fixture,p),'schema.maxItems');
  const example=makeExamples(p,fixture.assets[0]);assert.equal(validateSiteSpec(example.spec,p).ok,true);
  const headingPolicy=structuredClone(defaultPolicy);headingPolicy.firstVersion.copy.heading.value=5;expectError(validateSiteSpec(fixture,headingPolicy),'schema.maxLength');
});

test('unsupported policy settings, missing rationale, invalid dates and limits fail closed', () => {
  for(const mutate of [p=>p.changes.calendar.value='local',p=>p.firstVersion.images.formats.value.push('svg'),p=>p.includes.capabilities.value.push('custom-backend'),p=>p.includes.ssl.value=false,p=>p.includes.maxPages.value=0,p=>p.firstVersion.copy.heading.value=1.5,p=>p.version.value='latest',p=>p.effectiveDate.value='2026-02-30',p=>delete p.changes.perMonth.rationale,p=>p.firstVersion.components.hero.fields.heading.kind='execute',p=>p.extra=true]) {const p=structuredClone(defaultPolicy);mutate(p);assert.throws(()=>generateContracts(p));}
  assert(flattenRules(defaultPolicy).every(r=>r.rationale.trim()));
});

test('plan paths and rename origins require current-head owner approval', () => {
  for(const files of [[{filename:'plans/web-simple.policy.json'}],[{filename:'docs/safe.md',previous_filename:'plans/web-simple.policy.json'}]]){
    assert.equal(policyDecision(files,[],'head').allowed,false);
    assert.equal(policyDecision(files,[{user:{login:'carlos-olivera'},state:'APPROVED',commit_id:'old'}],'head').allowed,false);
    assert.equal(policyDecision(files,[{user:{login:'carlos-olivera'},state:'APPROVED',commit_id:'head'}],'head').allowed,true);
  }
});

// Structured changes use a separately prepared result approval, never trust client counters.
const requestFor = (operations, result, assets=[]) => ({...structuredClone(changeFixture),operations,assets,approval:{...fixture.approval,specSha256:specDigest(result)}});
test('all supported change operations apply atomically and account for their effects', () => {
  const base=spec();
  for(const kind of defaultPolicy.changes.operations.value) {
    const result=structuredClone(base);let op;
    if(kind==='update-block'){op=structuredClone(changeFixture.operations[0]);result.pages[0].sections[0].blocks[0]=op.block;}
    if(kind==='add-block'){const b={...structuredClone(hero(base)),id:'added'};op={op:kind,pageId:'home',sectionId:'section-0',index:1,block:b};result.pages[0].sections[0].blocks.push(b);}
    if(kind==='remove-block'){base.pages[0].sections[0].blocks.push({...structuredClone(hero(base)),id:'remove-me'});approve(base);result.pages[0].sections[0].blocks=structuredClone(base.pages[0].sections[0].blocks.slice(0,1));op={op:kind,pageId:'home',sectionId:'section-0',blockId:'remove-me'};}
    if(kind==='add-page'){base.pages.pop();approve(base);result.pages=structuredClone(base.pages);const page={...structuredClone(base.pages[1]),id:'new-page',path:'/new-page/'};op={op:kind,page};result.pages.push(page);}
    if(kind==='update-page-seo'){op={op:kind,pageId:'home',seo:{title:'Revised title',description:'Fictional revised description.'}};result.pages[0].seo=op.seo;}
    if(kind==='update-tokens'){op={op:kind,tokens:{...structuredClone(base.tokens),radius:2}};result.tokens=op.tokens;}
    if(kind==='update-navigation'){op={op:kind,navigation:{primary:[],footer:[]}};result.navigation=op.navigation;}
    const req=requestFor([op],result);req.baseSpecSha256=specDigest(base);const r=validateChangeRequest(req,base,context());assert.equal(r.ok,true,kind+JSON.stringify(r));assert.deepEqual(r.value.spec,approve(result));
  }
});

test('stale base, unsupported op, no-op, missing target, repeated target and changed ID reject', () => {
  let req=structuredClone(changeFixture);req.baseSpecSha256='0'.repeat(64);expectError(validateChangeRequest(req,fixture,context()),'change.stale');
  req=structuredClone(changeFixture);req.operations[0].op='delete-page';expectError(validateChangeRequest(req,fixture,context()),'schema.enum');
  req=structuredClone(changeFixture);req.operations[0].block=structuredClone(hero(fixture));req.approval=structuredClone(fixture.approval);expectError(validateChangeRequest(req,fixture,context()),'change.noop');
  for(const key of ['pageId','sectionId','blockId']) {req=structuredClone(changeFixture);req.operations[0][key]='missing';expectError(validateChangeRequest(req,fixture,context()),'change.target');}
  req=structuredClone(changeFixture);req.operations.push(structuredClone(req.operations[0]));expectError(validateChangeRequest(req,fixture,context()),'change.repeatedTarget');
  req=structuredClone(changeFixture);req.operations[0].block.id='changed-id';expectError(validateChangeRequest(req,fixture,context()),'change.identity');
  req=structuredClone(changeFixture);req.approval.specSha256='0'.repeat(64);expectError(validateChangeRequest(req,fixture,context()),'approval.digest');
  req=structuredClone(changeFixture);req.appliedRequests=0;expectError(validateChangeRequest(req,fixture,context()),'schema.additionalProperties');
});

test('page, block, global and operation caps include additions and cannot be canceled out', () => {
  let req=structuredClone(changeFixture);req.operations=fixture.pages.slice(0,3).map(p=>({op:'update-page-seo',pageId:p.id,seo:{...p.seo,title:'Revised'}}));expectError(validateChangeRequest(req,fixture,context()),'change.pages');
  req=structuredClone(changeFixture);req.operations=fixture.pages[0].sections.slice(0,11).map(s=>({op:'update-block',pageId:'home',sectionId:s.id,blockId:s.blocks[0].id,block:reviseBlock(s.blocks[0])}));expectError(validateChangeRequest(req,fixture,context()),'change.blocks');
  req=structuredClone(changeFixture);req.operations=[{op:'update-tokens',tokens:fixture.tokens},{op:'update-navigation',navigation:fixture.navigation}];expectError(validateChangeRequest(req,fixture,context()),'change.globals');
  req=structuredClone(changeFixture);req.operations=Array.from({length:21},()=>changeFixture.operations[0]);expectError(validateChangeRequest(req,fixture,context()),'schema.maxItems');
  const base=spec();base.pages.pop();approve(base);const page={...structuredClone(fixture.pages[0]),id:'new-page',path:'/new-page/'};req=structuredClone(changeFixture);req.baseSpecSha256=specDigest(base);req.operations=[{op:'add-page',page}];expectError(validateChangeRequest(req,base,context()),'change.blocks');
  req.operations.push({op:'update-page-seo',pageId:page.id,seo:page.seo});expectError(validateChangeRequest(req,base,context()),'change.repeatedTarget');
});

test('global updates on seven pages use no page/block allowance; exact page/block caps succeed', () => {
  let result=spec();result.tokens.radius=2;let req=requestFor([{op:'update-tokens',tokens:result.tokens}],result);let r=validateChangeRequest(req,fixture,context());assert.equal(r.ok,true);assert.deepEqual(r.value.accounting,{pagesTouched:0,blocksModified:0,globalOperations:1,monthlyRequestsRemaining:3});
  result=spec();const operations=[];
  for(let i=0;i<10;i++){const section=result.pages[0].sections[i];section.blocks[0]=reviseBlock(section.blocks[0]);operations.push({op:'update-block',pageId:'home',sectionId:section.id,blockId:section.blocks[0].id,block:section.blocks[0]});}
  result.pages[1].seo.title='Revised';operations.push({op:'update-page-seo',pageId:'about',seo:result.pages[1].seo});req=requestFor(operations,result);r=validateChangeRequest(req,fixture,context());assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.value.accounting.pagesTouched,2);assert.equal(r.value.accounting.blocksModified,10);
});

test('trusted UTC-month context and allowance boundary; validation never increments state', () => {
  const c=context();c.appliedRequests=3;assert.equal(validateChangeRequest(changeFixture,fixture,c).ok,true);assert.equal(c.appliedRequests,3);c.appliedRequests=4;expectError(validateChangeRequest(changeFixture,fixture,c),'change.monthly');
  for(const bad of [{...context(),month:'2026-09'},{...context(),appliedRequests:-1},{...context(),appliedRequests:0.5},{...context(),now:new Date(NaN)}])expectError(validateChangeRequest(changeFixture,fixture,bad),'change.context');
  const rollover={month:'2026-11',appliedRequests:0,now:new Date('2026-11-01T00:00:00.000Z')};assert.equal(validateChangeRequest(changeFixture,fixture,rollover).ok,true);
});

test('invalid projected result, asset overwrite, unused assets and failed operations never mutate input', () => {
  const before=JSON.stringify(fixture);let req=structuredClone(changeFixture);req.operations[0].block.props.image='missing';expectError(validateChangeRequest(req,fixture,context()),'reference.asset');
  req=structuredClone(changeFixture);req.assets=[fixture.assets[0]];expectError(validateChangeRequest(req,fixture,context()),'change.assetIdentity');
  req=structuredClone(changeFixture);req.assets=[{...fixture.assets[0],id:'unused'}];expectError(validateChangeRequest(req,fixture,context()),'change.unusedAsset');
  req=structuredClone(changeFixture);req.operations=[{op:'remove-block',pageId:'home',sectionId:'section-0',blockId:'block-0'}];expectError(validateChangeRequest(req,fixture,context()),'schema.minItems');
  assert.equal(JSON.stringify(fixture),before);
});


test('APNG animation chunks reject even when the native decoder sees a static image', async () => {
  // Insert a correctly framed animation-control chunk into our original PNG.
  const crc32 = bytes => {let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
  const data=Buffer.alloc(8);data.writeUInt32BE(2);const type=Buffer.from('acTL');const chunk=Buffer.alloc(20);chunk.writeUInt32BE(8);type.copy(chunk,4);data.copy(chunk,8);chunk.writeUInt32BE(crc32(Buffer.concat([type,data])),16);
  const bytes=Buffer.concat([pixels.subarray(0,33),chunk,pixels.subarray(33)]);
  const a={...fixture.assets[0],bytes:bytes.length,sha256:hash(bytes)};
  expectError(await validateAssets([a],new Map([[a.id,bytes]])),'asset.animated');
});

test('JSON byte limit accepts its exact boundary; later policy versions use separate artifact directories', () => {
  const p=structuredClone(defaultPolicy);p.firstVersion.structure.maxJsonBytes.value=Buffer.byteLength(JSON.stringify(fixture));
  assert.equal(validateSiteSpec(fixture,p).ok,true);p.firstVersion.structure.maxJsonBytes.value--;expectError(validateSiteSpec(fixture,p),'submission.bytes');
  assert.equal(artifactDirectory(defaultPolicy),'v1');p.version.value='1.1.0';assert.equal(artifactDirectory(p),'1.1.0');
});


test('same-version policy changes cannot overwrite the immutable snapshot', () => {
  assertPolicySnapshot(defaultPolicy,structuredClone(defaultPolicy));
  const changed=structuredClone(defaultPolicy);changed.changes.perMonth.value=8;
  assert.throws(()=>assertPolicySnapshot(changed,defaultPolicy),/bump semver/);
});
