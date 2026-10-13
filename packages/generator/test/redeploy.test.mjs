import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RailwayDeployer} from '../dist/index.js';
import {fixtureSubmission} from '@a2aviary/site-core/fixtures/catalog';

test('redeploy guards the existing project, uploads only stored web bytes and never configures/restarts CMS',async()=>{
 const input=await fixtureSubmission(),provider=new RailwayDeployer({apiToken:'fictional',workspaceId:'fictional',test:true,protectedProjectIds:new Set(),backupVariables:{}});
 const resources={projectId:'fictional',environmentId:'fixture',webServiceId:'web',cmsServiceId:'cms',volumeId:'volume',cmsConfigured:true,domain:'fictional.up.railway.app',test:true,cmsCollections:['catalog','blog','announcements']};
 const build={files:{'index.html':Buffer.from('Original approved bytes').toString('base64')}};const calls=[];
 provider.guard=async r=>{assert.deepEqual(r,resources);calls.push('guard')};
 provider.query=async()=>{throw Error('Unexpected provider mutation')};
 provider.ensureCollections=async()=>{throw Error('Existing collections must not need SSH')};
 provider.upload=async(directory,r,service)=>{calls.push('upload:'+service);assert.deepEqual(r,resources);assert.equal(await readFile(directory+'/site/index.html','utf8'),'Original approved bytes');assert.match(await readFile(directory+'/Caddyfile','utf8'),/root \* \/cms-editor/);return 'new-web-deployment'};
 provider.waitHealthy=async(_r,service,id)=>{assert.equal(service,'web');assert.equal(id,'new-web-deployment')};provider.waitPublic=async()=>{};
 assert.deepEqual(await provider.deploy({name:'cli-001-fictional',spec:input.spec,build,resources,clientEmail:'fictional@example.invalid',redeploy:true,test:true,saveResources:async()=>{throw Error('No resource changes')}}),resources);
 assert.deepEqual(calls,['guard','upload:web']);
 await assert.rejects(provider.deploy({name:'cli-001-fictional',spec:input.spec,build,resources:{...resources,volumeId:undefined},clientEmail:'fictional@example.invalid',redeploy:true,test:true,saveResources:async()=>{}}),/redeploy_resources_required/);
});

test('collection addition refuses absent pre-registered SSH access before web upload',async()=>{
 const {spec}=await fixtureSubmission(),provider=new RailwayDeployer({apiToken:'fictional',workspaceId:'fictional',test:true,protectedProjectIds:new Set(),backupVariables:{}});
 const resources={projectId:'fictional',environmentId:'fixture',webServiceId:'web',cmsServiceId:'cms',volumeId:'volume',cmsConfigured:true,domain:'fictional.up.railway.app',test:true,cmsCollections:[]};
 provider.guard=async()=>true;provider.upload=async()=>{throw Error('Must not upload')};
 await assert.rejects(provider.deploy({name:'cli-001-fictional',spec,build:{files:{}},resources,clientEmail:'fictional@example.invalid',redeploy:true,test:true,saveResources:async()=>{throw Error('Must not mutate resources')}}),/cms_collection_access_required/);
});
