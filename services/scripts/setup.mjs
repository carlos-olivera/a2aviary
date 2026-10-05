import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, createPrivateKey } from 'node:crypto';
import { generateKeyPair, exportJWK, SignJWT, importPKCS8 } from 'jose';
import { SecretsManagerClient, PutSecretValueCommand, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
const root=resolve(import.meta.dirname,'../..');
const outputs=JSON.parse(await readFile(root+'/.local/services-outputs.json','utf8'));
const email=outputs['a2aviary-prod-email'], runtime=outputs['a2aviary-prod-runtime'];
const sm=new SecretsManagerClient({region:'us-east-1'}),db=DynamoDBDocumentClient.from(new DynamoDBClient({region:'us-east-1'}));
const put=Item=>db.send(new PutCommand({TableName:email.StateTable,Item}));
const setSecret=(SecretId,value)=>sm.send(new PutSecretValueCommand({SecretId,SecretString:JSON.stringify(value)}));
const at=()=>Math.floor(Date.now()/1000);
const action=process.argv[2];
if(action==='seed'){
 const keyFile=process.argv[3];if(!keyFile)throw new Error('Supply the private OpenAI key file path');
 const apiKey=(await readFile(keyFile,'utf8')).trim();if(!apiKey.startsWith('sk-'))throw new Error('Unexpected key format');
 await setSecret(email.OpenAISecret,{apiKey});
 let signing;
 try {signing=JSON.parse(await readFile(root+'/.local/service-signing.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;const pair=await generateKeyPair('ES256',{extractable:true});signing={privateKey:await exportJWK(pair.privateKey),publicKey:await exportJWK(pair.publicKey)};await writeFile(root+'/.local/service-signing.json',JSON.stringify(signing),{mode:0o600});}
 const privateJwk=signing.privateKey,publicJwk=signing.publicKey;
 await setSecret(email.SigningSecret,{kid:'a2aviary-signing-2026-10',privateKey:privateJwk});
 await writeFile(root+'/contracts/service-public-key.json',JSON.stringify({kid:'a2aviary-signing-2026-10',jwk:publicJwk},null,2)+'\n');
 await put({pk:'CONTROL#flags',admission:false,processing:false,sending:false,developmentEnabled:false});
 console.log('Credential transferred; service signing key created; all switches disabled.');
}else if(action==='test-partner'){
 const pair=await generateKeyPair('ES256',{extractable:true});const privateJwk=await exportJWK(pair.privateKey),publicJwk=await exportJWK(pair.publicKey);
 await mkdir(root+'/.local',{recursive:true});await writeFile(root+'/.local/test-partner.json',JSON.stringify({kid:'fictional-release-test',privateKey:privateJwk,from:'test@a2aviary.io'}),{mode:0o600});
 await put({pk:'PARTNER#fictional-release-test',kid:'fictional-release-test',sender:'fictional-release-test',publicKey:publicJwk,projects:['fictional-garden'],actions:['capabilities.get','task.submit','task.status'],replyTo:'test@a2aviary.io',research:true,revoked:false,expiresAt:at()+7*86400});
 console.log('Fictional partner registered for seven days; private key stays in .local.');
}else if(action==='switches'){
 const enabled=process.argv[3]==='on';await put({pk:'CONTROL#flags',admission:enabled,processing:enabled,sending:enabled,developmentEnabled:false});console.log('Task switches '+(enabled?'enabled':'disabled')+'.');
}else if(action==='app-registration'){
 const nonce=randomBytes(32).toString('hex');await put({pk:'CONTROL#github-registration',nonce,expiresAt:at()+3600,ttl:at()+86400});
 // GitHub sends installation lifecycle events automatically; they cannot be selected in a manifest.
 const manifest={name:process.argv[3]??'a2aviary Operator',url:'https://a2aviary.io',hook_attributes:{url:runtime.OperatorUrl+'/github/webhook',active:true},redirect_url:runtime.OperatorUrl+'/github/setup/callback',public:false,default_permissions:{contents:'write',pull_requests:'write',checks:'write',actions:'read'},default_events:['pull_request','pull_request_review']};
 const safe=JSON.stringify(manifest).replaceAll('&','&amp;').replaceAll("'",'&#39;').replaceAll('<','&lt;');
 await writeFile(root+'/.local/app-registration.html',`<!doctype html><html lang="en"><meta charset="utf-8"><title>a2aviary Operator registration</title><h1>Register the private a2aviary Operator App</h1><p>Owner: Carlos Olivera Terrazas. Install only on carlos-olivera/a2aviary. Permissions: contents and pull requests write, checks write, Actions read. No administration or workflow write.</p><form method="post" action="https://github.com/settings/apps/new?state=${nonce}"><input type="hidden" name="manifest" value='${safe}'><button>Register App on GitHub</button></form></html>`,{mode:0o600});
 console.log('Private registration form prepared in .local/app-registration.html (valid one hour).');
}else if(action==='app-installation'){
 const a=JSON.parse((await sm.send(new GetSecretValueCommand({SecretId:email.AppKeySecret}))).SecretString);
 if(!a.appId)throw new Error('Complete owner registration first');
 a.privateKey=createPrivateKey(a.privateKey).export({type:'pkcs8',format:'pem'});
 const jwt=await new SignJWT({}).setProtectedHeader({alg:'RS256'}).setIssuedAt(at()-30).setExpirationTime(at()+300).setIssuer(String(a.appId)).sign(await importPKCS8(a.privateKey,'RS256'));
 const r=await fetch('https://api.github.com/app/installations',{headers:{Authorization:'Bearer '+jwt,Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error('Installation listing failed: '+r.status);
 const install=(await r.json()).filter(i=>i.account.login==='carlos-olivera');if(install.length!==1)throw new Error('Install on the owner repository first');
 a.installationId=install[0].id;
 // Enumerate the whole installation grant before broker tokens restrict it to the fixed repository.
 const tr=await fetch(`https://api.github.com/app/installations/${a.installationId}/access_tokens`,{method:'POST',headers:{Authorization:'Bearer '+jwt,Accept:'application/vnd.github+json'},body:JSON.stringify({permissions:{contents:'read'}})});if(!tr.ok)throw new Error('Repository scope verification failed: '+tr.status);
 const token=(await tr.json()).token;
 let repos;
 try{const rr=await fetch('https://api.github.com/installation/repositories',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});if(!rr.ok)throw new Error('Installation repository listing failed: '+rr.status);repos=await rr.json();}
 finally{const revoked=await fetch('https://api.github.com/installation/token',{method:'DELETE',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'}});if(revoked.status!==204)throw new Error('Verification token revocation failed: '+revoked.status);}
 if(repos.total_count!==1 || repos.repositories[0].id!==1403745581)throw new Error('Installation must cover only a2aviary');
 await setSecret(email.AppKeySecret,a);await writeFile(root+'/.local/app-status.json',JSON.stringify({appId:a.appId,installationId:a.installationId,slug:a.slug},null,2));console.log('Repository-only installation verified; fixed brokers configured.');
}else throw new Error('Commands: seed KEY_FILE, test-partner, switches on|off, app-registration [NAME], app-installation');
