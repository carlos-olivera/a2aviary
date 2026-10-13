import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { starterArtifacts } from '../scripts/starters.mjs';
import { catalog, defaultPolicy, getStarter, listStarters } from '@a2aviary/site-core';

test('starter compiler rejects copy, values, inheritance, invalid packages, status, plans, versions and symlinks', async t => {
  const root=await mkdtemp(join(tmpdir(),'a2aviary-starters-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await cp(new URL('../../../starters',import.meta.url),join(root,'starters'),{recursive:true});
  const file=join(root,'starters/profile/1.0.0/starter.json'),snapshot=join(root,'starters/snapshots/profile/1.0.0.json');
  const initial=await readFile(file,'utf8');
  await starterArtifacts(root,defaultPolicy,catalog);
  const mutateCases=[
    d=>d.seed.pages[0].sections[0].blocks[0].props.name='Forbidden copy',
    d=>d.seed.pages[0].path='/',
    d=>d.seed.tokens={motion:'none'},
    d=>d.extends='other',
    d=>d.version='1.0',
    d=>d.id='other',
    d=>d.status='stable',
    d=>d.seed.pages[0].sections[0].blocks[0].component='unknown',
    d=>d.seed.pages[0].sections[0].effects=['shimmer'],
    d=>d.seed.pages[0].sections[1].blocks[0].effects=['shimmer'],
    d=>d.suggestions[0].variant='unknown',
    d=>d.inputs[0].pointers=['not-a-pointer'],
    d=>d.seed.pages=Array.from({length:8},(_,i)=>({...d.seed.pages[0],id:'page-'+i})),
    d=>d.seed.pages[0].sections[1].id='identity',
    d=>d.seed.pages[0].sections[0].blocks=Array.from({length:41},(_,i)=>({...d.seed.pages[0].sections[0].blocks[0],id:'block-'+i})),
  ];
  for (const mutate of mutateCases) {
    const d=JSON.parse(initial);mutate(d);const value=JSON.stringify(d);
    await writeFile(file,value);await writeFile(snapshot,value);
    await assert.rejects(starterArtifacts(root,defaultPolicy,catalog),/Invalid starters/);
  }
  await writeFile(snapshot,initial);
  const changed=JSON.parse(initial);changed.designIntent=['Changed frozen guidance'];
  await writeFile(file,JSON.stringify(changed));
  await assert.rejects(starterArtifacts(root,defaultPolicy,catalog),/frozen version/);
  await writeFile(file,initial);
  const extra=join(root,'starters/profile/1.0.0/code.js');await writeFile(extra,'throw Error()');
  await assert.rejects(starterArtifacts(root,defaultPolicy,catalog),/unexpected file/);await rm(extra);
  await rm(file);await symlink(new URL('../../../starters/profile/1.0.0/starter.json',import.meta.url),file);
  await assert.rejects(starterArtifacts(root,defaultPolicy,catalog),/symlink/);
});
test('runtime registry returns independent copies and gates experimental discovery',()=>{
  assert.deepEqual(listStarters(),[]);assert.equal(getStarter('profile'),undefined);
  const a=getStarter('profile',undefined,true),b=getStarter('profile','1.0.0',true);
  assert.equal(a.version,'1.0.0');a.seed.pages.length=0;assert.equal(b.seed.pages.length,1);
  assert.equal(getStarter('profile','9.0.0',true),undefined);
});
