import { createHmac, timingSafeEqual, createPrivateKey } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { SecretsManagerClient, PutSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { secret, get, update, audit, now, put } from './store.js';
import { policyDecision } from './policy.js';

const REPO='carlos-olivera/a2aviary';
async function github(path:string,token:string,method='GET',body?:any) {
  const r=await fetch('https://api.github.com'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Object.assign(new Error('github_request_failed'),{status:r.status});return r.status===204?{}:r.json();
}
export async function broker(event:any) {return mint('policy');}
export async function developmentBroker(event:any) {const control=await get('CONTROL#flags');if(!control?.developmentEnabled)throw new Error('development_disabled');return mint('development');}
async function mint(profile:'policy'|'development') {
  const app=await secret(process.env.APP_KEY_SECRET!);
  if(!app.appId || !app.installationId)throw new Error('github_app_not_installed');
  const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256'}).setIssuedAt(now()-30).setExpirationTime(now()+300).setIssuer(String(app.appId)).sign(await importPKCS8(app.privateKey,'RS256'));
  const permissions=profile==='policy'?{contents:'read',pull_requests:'read',checks:'write'}:{contents:'write',pull_requests:'write',actions:'read'};
  const token=await github(`/app/installations/${app.installationId}/access_tokens`,jwt,'POST',{repository_ids:[1403745581],permissions});
  return {token:token.token,expiresAt:token.expires_at};
}
async function policyToken(){const r=await new LambdaClient({}).send(new InvokeCommand({FunctionName:process.env.BROKER_FUNCTION!,Payload:Buffer.from(JSON.stringify({profile:'policy'}))}));const p=JSON.parse(Buffer.from(r.Payload!).toString());if(r.FunctionError || !p.token)throw new Error('broker_unavailable');return p.token;}
async function paginate(path:string,token:string){const all=[];for(let page=1;page<=30;page++){const result=await github(path+`?per_page=100&page=${page}`,token);all.push(...result);if(result.length<100)return all;}throw new Error('github_pagination_limit');}
async function evaluate(number:number,token:string){
  const pr=await github(`/repos/${REPO}/pulls/${number}`,token);
  if(pr.state!=='open')return;
  const files=await paginate(`/repos/${REPO}/pulls/${number}/files`,token);
  if(files.length!==pr.changed_files)throw new Error('incomplete_changed_paths');
  const reviews=await paginate(`/repos/${REPO}/pulls/${number}/reviews`,token);
  const result=policyDecision(files,reviews,pr.head.sha);
  // Re-read the head before emitting a check for this immutable revision.
  const current=await github(`/repos/${REPO}/pulls/${number}`,token);if(current.head.sha!==pr.head.sha)throw new Error('head_changed');
  await github(`/repos/${REPO}/check-runs`,token,'POST',{name:'a2aviary-policy',head_sha:pr.head.sha,status:'completed',conclusion:result.allowed?'success':'failure',output:{title:result.allowed?'Authority verified':'Owner approval required',summary:result.reason}});
  await audit('github.policy',{pullRequest:number,commit:pr.head.sha},result.allowed?'allowed':'denied');
}
export async function webhook(event:any) {
  const body=event.isBase64Encoded?Buffer.from(event.body??'','base64'):Buffer.from(event.body??'');
  if(body.length>1048576)return {statusCode:413,body:'Payload too large'};
  const config=await secret(process.env.APP_WEBHOOK_SECRET!);
  const received=Buffer.from(event.headers?.['x-hub-signature-256']??'');
  const expected=Buffer.from('sha256='+createHmac('sha256',config.webhookSecret).update(body).digest('hex'));
  if(received.length!==expected.length || !timingSafeEqual(received,expected))return {statusCode:401,body:'Invalid signature'};
  const payload=JSON.parse(body.toString());
  if(payload.repository?.id!==1403745581 && payload.installation?.account?.login!=='carlos-olivera')return {statusCode:403,body:'Repository denied'};
  if(payload.pull_request){await evaluate(payload.pull_request.number,await policyToken());}
  // Installation completion is reconciled by the owner setup command, not an untrusted caller.
  return {statusCode:200,body:'Processed'};
}
export async function callback(event:any){
  const state=await get('CONTROL#github-registration');
  const query=event.queryStringParameters??{};
  if(!state || state.expiresAt<now() || state.nonce!==query.state || !/^[A-Za-z0-9_-]{1,200}$/.test(query.code??''))return {statusCode:403,body:'Invalid registration state'};
  await update(state.pk,'SET used = :yes',{':yes':true},'attribute_not_exists(used)');
  const response=await fetch(`https://api.github.com/app-manifests/${query.code}/conversions`,{method:'POST',headers:{Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(20000)});
  if(!response.ok)return {statusCode:502,body:'Manifest conversion failed. Restart registration.'};
  const app:any=await response.json();
  const sm=new SecretsManagerClient({});
  await sm.send(new PutSecretValueCommand({SecretId:process.env.APP_KEY_SECRET!,SecretString:JSON.stringify({appId:app.id,privateKey:createPrivateKey(app.pem).export({type:'pkcs8',format:'pem'}),installationId:0,slug:app.slug})}));
  await sm.send(new PutSecretValueCommand({SecretId:process.env.APP_WEBHOOK_SECRET!,SecretString:JSON.stringify({webhookSecret:app.webhook_secret})}));
  return {statusCode:302,headers:{Location:`https://github.com/apps/${app.slug}/installations/new`},body:''};
}
