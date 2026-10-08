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

const fixture = JSON.parse(await readFile('../contracts/site/2.0.0/examples/site-spec.json', 'utf8'));
const changeFixture = JSON.parse(await readFile('../contracts/site/2.0.0/examples/change-request.json', 'utf8'));
const pixels = await readFile('../contracts/site/2.0.0/examples/fictional-pixel.webp');
const invalid = JSON.parse(await readFile('test/site-fixtures/invalid-specs.json', 'utf8'));
const context = () => ({ month: '2026-10', appliedRequests: 0, now: new Date('2026-10-06T12:00:00.000Z') });
const spec = () => structuredClone(fixture);
const approve = s => s;
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
  assert.equal(JSON.stringify(fixture), before);
});
for (const scenario of invalid.filter(s=>!s.path.startsWith('/approval')&&!s.path.startsWith('/preview'))) test(scenario.name, () => {
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
  for(const [key,max] of [['bytes',2097152],['width',2560],['height',2560]]) {const s=spec();s.assets[0][key]=max;approve(s);assert.equal(validateSiteSpec(s).ok,true);s.assets[0][key]=max+1;approve(s);expectError(validateSiteSpec(s),'schema.maximum');}
  let s=spec();s.assets=Array.from({length:50},(_,i)=>({...fixture.assets[0],id:i===0?'fictional-pixel':'pixel-'+i}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.assets.push({...fixture.assets[0],id:'overflow'});approve(s);expectError(validateSiteSpec(s),'schema.maxItems');
  s=spec();s.assets=Array.from({length:13},(_,i)=>({...fixture.assets[0],id:i===0?'fictional-pixel':'pixel-'+i,bytes:i===12?1048576:2097152}));approve(s);assert.equal(validateSiteSpec(s).ok,true);s.assets[12].bytes++;approve(s);expectError(validateSiteSpec(s),'assets.totalBytes');
});

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const describe = async (bytes, format) => {const m=await sharp(bytes).metadata();return {...fixture.assets[0],format,bytes:bytes.length,width:m.width,height:m.height,sha256:hash(bytes)};};
test('only normalized WebP assets enter generation; mismatch/corruption/missing/extra bytes reject',async()=>{
 for(const format of ['png','jpeg']){const wrong=spec();wrong.assets[0].format=format;expectError(await validateAssets(wrong.assets,new Map([['fictional-pixel',pixels]])),'schema.enum');}
 for(const buffers of [new Map(),new Map([['fictional-pixel',Buffer.from('corrupt')]]),new Map([['fictional-pixel',pixels],['extra',pixels]])])assert.equal((await validateAssets(fixture.assets,buffers)).ok,false);
});
test('actual dimensional and bundle-byte limits cannot be bypassed with metadata', async () => {
  const wide=await sharp({create:{width:4097,height:1,channels:3,background:'#446688'}}).webp().toBuffer();const a=await describe(wide,'webp');a.width=2560;expectError(await validateAssets([a],new Map([[a.id,wide]])),'asset.dimensions');
  const p=structuredClone(defaultPolicy);p.firstVersion.images.maxTotalBytes.value=pixels.length;
  const assets=[fixture.assets[0],{...fixture.assets[0],id:'other'}];expectError(await validateAssets(assets,new Map(assets.map(a=>[a.id,pixels])),p),'assets.totalBytes');
});

test('animated WebP rejects without editing it', async () => {
  const bytes=await sharp(Buffer.from([0,0,0,255,255,255]),{raw:{width:1,height:2,channels:3,pageHeight:1}}).webp({loop:0,delay:[100,100]}).toBuffer();
  const m=await sharp(bytes).metadata();assert.equal(m.pages,2);
  const a={...fixture.assets[0],format:'webp',bytes:bytes.length,width:1,height:1,sha256:hash(bytes)};
  expectError(await validateAssets([a],new Map([[a.id,bytes]])),'asset.animated');
});

test('canonical digest binds the whole spec and rejects client approval/preview declarations',()=>{
 const changed=spec();const digest=specDigest(changed);changed.pages.reverse();assert.notEqual(specDigest(changed),digest);
 for(const field of ['approval','preview']){const invalid=spec();invalid[field]={};expectError(validateSiteSpec(invalid),'schema.additionalProperties');}
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

test('change requests are explicitly unavailable',()=>{expectError(validateChangeRequest({},fixture,context()),'change_requests_unavailable');});

test('JSON byte limit accepts its exact boundary; later policy versions use separate artifact directories', () => {
  const p=structuredClone(defaultPolicy);p.firstVersion.structure.maxJsonBytes.value=Buffer.byteLength(JSON.stringify(fixture));
  assert.equal(validateSiteSpec(fixture,p).ok,true);p.firstVersion.structure.maxJsonBytes.value--;expectError(validateSiteSpec(fixture,p),'submission.bytes');
  assert.equal(artifactDirectory(defaultPolicy),'2.0.0');p.version.value='1.1.0';assert.equal(artifactDirectory(p),'1.1.0');
});


test('same-version policy changes cannot overwrite the immutable snapshot', () => {
  assertPolicySnapshot(defaultPolicy,structuredClone(defaultPolicy));
  const changed=structuredClone(defaultPolicy);changed.changes.perMonth.value=8;
  assert.throws(()=>assertPolicySnapshot(changed,defaultPolicy),/bump semver/);
});
