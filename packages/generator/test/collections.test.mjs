import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectionArtifacts } from '../scripts/collections.mjs';
import { libraryArtifacts } from '../scripts/library.mjs';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { renderCmsEditorScript, cmsEditorHtml } from '../dist/index.js';
import { collectionDefinitions } from '@a2aviary/site-core';

const source = new URL('../../../', import.meta.url);
test('collection compiler validates bounds, identities, rules, ownership and editor shape', async t => {
  const root = await mkdtemp(join(tmpdir(),'a2aviary-collections-'));
  t.after(() => rm(root,{recursive:true,force:true}));
  await cp(new URL('collections',source),join(root,'collections'),{recursive:true});
  const valid = await collectionArtifacts(root);
  assert.deepEqual(Object.keys(valid.collections),['catalog','blog','announcements']);
  const file=join(root,'collections/catalog/collection.json'), initial=await readFile(file,'utf8');
  for (const mutate of [
    d => d.fields[0].max=0,
    d => d.fields[0].max=262145,
    d => d.fields[0].name='constructor',
    d => d.fields[0].name='invalid-name',
    d => d.fields.push(d.fields[0]),
    d => d.id='unexpected',
    d => d.order=1,
    d => d.publicReadRules.list='title = true',
    d => d.editorRules.create='',
    d => d.publicDisplay.headingField='published',
  ]) {
    const d=JSON.parse(initial); mutate(d); await writeFile(file,JSON.stringify(d));
    await assert.rejects(collectionArtifacts(root), /Invalid collections/);
  }
  const changed=JSON.parse(initial); changed.fields[0].max=121; await writeFile(file,JSON.stringify(changed));
  assert.equal((await collectionArtifacts(root)).collections.catalog.fields[0].max,121);
  await writeFile(file,initial);
  const extra=join(root,'collections/catalog/code.js'); await writeFile(extra,'throw new Error()');
  await assert.rejects(collectionArtifacts(root), /unexpected file/); await rm(extra);
  await rm(file); await symlink(new URL('collections/catalog/collection.json',source),file);
  await assert.rejects(collectionArtifacts(root), /symlink/);
});
test('library compilation rejects a collection set different from the frozen policy', async t => {
  const root=await mkdtemp(join(tmpdir(),'a2aviary-collection-policy-')); t.after(()=>rm(root,{recursive:true,force:true}));
  for (const dir of ['collections','library','plans']) await cp(new URL(dir,source),join(root,dir),{recursive:true});
  await rm(join(root,'collections/catalog'),{recursive:true});
  await assert.rejects(libraryArtifacts(root), /collection set\/policy mismatch/);
});
test('editor renders and saves differing reviewed field schemas without exposing unbound collections', async t => {
  const definitions=structuredClone(collectionDefinitions);
  definitions[0].fields[0].max=121;
  definitions[0].fields.push({name:'summary',type:'text',required:true,max:80,editor:{label:'Summary',control:'textarea'}});
  const script=renderCmsEditorScript(['catalog','blog'],definitions), writes=[];
  const server=createServer(async(req,res)=>{
    if(req.url==='/editor.js'){res.setHeader('content-type','text/javascript');res.end(script);return}
    if(req.url.startsWith('/api/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const data=chunks.length?JSON.parse(Buffer.concat(chunks)):undefined;
      if(req.url.includes('auth-with-password'))res.end(JSON.stringify({token:'fictional-token'}));
      else if(req.method==='POST'){writes.push({path:req.url,data});res.end(JSON.stringify({id:'fictional-record',...data}));}
      else res.end(JSON.stringify({items:[]}));
      return;
    }
    res.setHeader('content-type','text/html');res.end(cmsEditorHtml());
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/');
  await page.locator('[name=email]').fill('editor@example.invalid');await page.locator('[name=password]').fill('fictional-password');
  await page.locator('#login button').click();await page.locator('[name=summary]').waitFor();
  assert.equal(await page.locator('[name=title]').getAttribute('maxlength'),'121');
  assert.deepEqual(await page.locator('#collection option').allTextContents(),['catalog','blog']);
  await page.locator('[name=title]').fill('Fictional title');await page.locator('[name=body]').fill('Fictional body');await page.locator('[name=summary]').fill('Fictional summary');await page.locator('[name=published]').check();
  await page.locator('#record button').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('Saved.'));
  assert.deepEqual(writes,[{path:'/api/collections/catalog/records',data:{title:'Fictional title',body:'Fictional body',published:true,summary:'Fictional summary'}}]);
  await page.locator('#collection').selectOption('blog');await page.waitForFunction(()=>!document.querySelector('[name=summary]'));
  assert.equal(await page.locator('[name=title]').getAttribute('maxlength'),'120');
});
