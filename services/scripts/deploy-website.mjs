import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand, waitUntilInvalidationCompleted } from '@aws-sdk/client-cloudfront';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { websiteContentType } from './website-content-type.mjs';
const sha=process.env.DEPLOY_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const config=process.env.WEBSITE_BUCKET?{WebsiteBucket:process.env.WEBSITE_BUCKET,ReleaseBucket:process.env.RELEASE_BUCKET,DistributionId:process.env.DISTRIBUTION_ID}:JSON.parse(await readFile('.local/website-outputs.json','utf8'))['a2aviary-prod-website'];
const s3=new S3Client({}),cf=new CloudFrontClient({});
const upload=async(bucket,key,body,contentType,cache)=>s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:contentType,CacheControl:cache}));
const get=async(bucket,key)=>(await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}))).Body.transformToByteArray();
let previous;try{previous=JSON.parse(Buffer.from(await get(config.WebsiteBucket,'.well-known/release.json')).toString());}catch(e){if(!['NoSuchKey','NotFound'].includes(e.name))throw e;}
const files=[];
async function collect(dir,prefix=''){for(const item of await readdir(dir,{withFileTypes:true})){const key=prefix+item.name;if(item.isDirectory())await collect(resolve(dir,item.name),key+'/');else{const body=await readFile(resolve(dir,item.name));files.push({key,body,mime:websiteContentType(key),sha256:createHash('sha256').update(body).digest('hex')});}}}
await collect(resolve('website/dist'));
const release={commit:sha,workflowRun:process.env.GITHUB_RUN_ID??'bootstrap',releaseId:sha+'-'+randomUUID(),deployedAt:new Date().toISOString()};
const releaseBody=Buffer.from(JSON.stringify(release));
files.push({key:'.well-known/release.json',body:releaseBody,mime:'application/json',sha256:createHash('sha256').update(releaseBody).digest('hex')});
const manifest={...release,files:files.map(({key,mime,sha256})=>({key,mime,sha256}))};
for(const f of files)await upload(config.ReleaseBucket,`releases/${release.releaseId}/${f.key}`,f.body,f.mime,'private, no-store');
await upload(config.ReleaseBucket,`releases/${release.releaseId}/manifest.json`,JSON.stringify(manifest),'application/json','private, no-store');
async function publish(list){for(const f of [...list.filter(f=>f.key!=='index.html'),...list.filter(f=>f.key==='index.html')])await upload(config.WebsiteBucket,f.key,f.body,f.mime,f.key.startsWith('assets/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');}
async function invalidate(){const r=await cf.send(new CreateInvalidationCommand({DistributionId:config.DistributionId,InvalidationBatch:{CallerReference:sha+'-'+Date.now(),Paths:{Quantity:1,Items:['/*']}}}));await waitUntilInvalidationCompleted({client:cf,maxWaitTime:240,minDelay:5,maxDelay:15},{DistributionId:config.DistributionId,Id:r.Invalidation.Id});}
await publish(files);await invalidate();
try {
 let verified=false;for(let i=0;i<6;i++){try{const r=await fetch('https://a2aviary.io/.well-known/release.json',{cache:'no-store'});if(r.ok&&(await r.json()).commit===sha){let complete=true;
      for(const file of files){const asset=await fetch('https://a2aviary.io/'+file.key,{cache:'no-store'});if(!asset.ok || createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex')!==file.sha256 || !asset.headers.get('content-type')?.startsWith(file.mime.split(';')[0])){complete=false;break;}const cache=asset.headers.get('cache-control')??'';if(!cache.includes(file.key.startsWith('assets/')?'immutable':'must-revalidate')){complete=false;break;}}
      if(complete){verified=true;break;}}}catch{}await new Promise(r=>setTimeout(r,5000));}
 if(!verified)throw new Error('public_release_verification_failed');
 console.log(JSON.stringify({verified:true,...release}));
}catch(e){if(previous?.commit){const previousId=previous.releaseId??previous.commit;const old=JSON.parse(Buffer.from(await get(config.ReleaseBucket,`releases/${previousId}/manifest.json`)).toString());const restore=[];for(const f of old.files)restore.push({...f,body:await get(config.ReleaseBucket,`releases/${previousId}/${f.key}`)});await publish(restore);await invalidate();console.error(JSON.stringify({rollback:previous.commit,reason:e.message}));}throw e;}
