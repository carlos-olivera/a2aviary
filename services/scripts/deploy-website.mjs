import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand, waitUntilInvalidationCompleted } from '@aws-sdk/client-cloudfront';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const sha=process.env.DEPLOY_COMMIT??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const config=process.env.WEBSITE_BUCKET?{WebsiteBucket:process.env.WEBSITE_BUCKET,ReleaseBucket:process.env.RELEASE_BUCKET,DistributionId:process.env.DISTRIBUTION_ID}:JSON.parse(await readFile('.local/website-outputs.json','utf8'))['a2aviary-prod-website'];
const s3=new S3Client({}),cf=new CloudFrontClient({});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2','.json':'application/json','.txt':'text/plain; charset=utf-8'};
const upload=async(bucket,key,body,contentType,cache)=>s3.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:contentType,CacheControl:cache}));
const get=async(bucket,key)=>(await s3.send(new GetObjectCommand({Bucket:bucket,Key:key}))).Body.transformToByteArray();
let previous;try{previous=JSON.parse(Buffer.from(await get(config.WebsiteBucket,'.well-known/release.json')).toString());}catch(e){if(!['NoSuchKey','NotFound'].includes(e.name))throw e;}
const files=[];
async function collect(dir,prefix=''){for(const item of await readdir(dir,{withFileTypes:true})){const key=prefix+item.name;if(item.isDirectory())await collect(resolve(dir,item.name),key+'/');else{const body=await readFile(resolve(dir,item.name));files.push({key,body,mime:mime[key.slice(key.lastIndexOf('.'))]??'application/octet-stream',sha256:createHash('sha256').update(body).digest('hex')});}}}
await collect(resolve('website/dist'));
const release={commit:sha,workflowRun:process.env.GITHUB_RUN_ID??'bootstrap',deployedAt:new Date().toISOString()};
files.push({key:'.well-known/release.json',body:Buffer.from(JSON.stringify(release)),mime:'application/json'});
const manifest={...release,files:files.map(({key,mime,sha256})=>({key,mime,sha256}))};
for(const f of files)await upload(config.ReleaseBucket,`releases/${sha}/${f.key}`,f.body,f.mime,'private, no-store');
await upload(config.ReleaseBucket,`releases/${sha}/manifest.json`,JSON.stringify(manifest),'application/json','private, no-store');
async function publish(list){for(const f of [...list.filter(f=>f.key!=='index.html'),...list.filter(f=>f.key==='index.html')])await upload(config.WebsiteBucket,f.key,f.body,f.mime,f.key.startsWith('assets/')?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate');}
async function invalidate(){const r=await cf.send(new CreateInvalidationCommand({DistributionId:config.DistributionId,InvalidationBatch:{CallerReference:sha+'-'+Date.now(),Paths:{Quantity:1,Items:['/*']}}}));await waitUntilInvalidationCompleted({client:cf,maxWaitTime:240,minDelay:5,maxDelay:15},{DistributionId:config.DistributionId,Id:r.Invalidation.Id});}
await publish(files);await invalidate();
try {
 let verified=false;for(let i=0;i<6;i++){try{const r=await fetch('https://a2aviary.io/.well-known/release.json',{cache:'no-store'});if(r.ok&&(await r.json()).commit===sha){const html=await fetch('https://a2aviary.io');if(html.ok&&(await html.text()).includes('Follow the build')){verified=true;break;}}}catch{}await new Promise(r=>setTimeout(r,5000));}
 if(!verified)throw new Error('public_release_verification_failed');
 console.log(JSON.stringify({verified:true,...release}));
}catch(e){if(previous?.commit){const old=JSON.parse(Buffer.from(await get(config.ReleaseBucket,`releases/${previous.commit}/manifest.json`)).toString());const restore=[];for(const f of old.files)restore.push({...f,body:await get(config.ReleaseBucket,`releases/${previous.commit}/${f.key}`)});await publish(restore);await invalidate();console.error(JSON.stringify({rollback:previous.commit,reason:e.message}));}throw e;}
