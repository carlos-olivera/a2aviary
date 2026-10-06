import { awsOptions } from './environment.js';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { get, update, flags, secret, now, audit } from './store.js';
import { sign, mimeMessage, hash } from './protocol.js';
export async function processOutbound(pk:string) {
  const item=await get(pk);if(!item || item.status!=='pending')return;
  if(!(await flags()).sending){await update(pk,'SET due = :due',{':due':now()+60});return;}
  const grant=await get('PARTNER#'+item.kid);
  if(await get('SUPPRESS#'+hash(item.to))) {await update(pk,'SET #s = :s REMOVE #w',{':s':'suppressed'},undefined,{'#s':'status','#w':'work'});return;}
  if(item.ttl<=now() || !grant || grant.revoked || grant.expiresAt<=now() || grant.replyTo!==item.to || !grant.projects.includes(item.projectId)) {await update(pk,'SET #s = :s REMOVE #w',{':s':'suppressed'},undefined,{'#s':'status','#w':'work'});return;}
  // Preparation has no delivery side effect and can safely retry before claiming a send.
  const credentials=await secret(process.env.SIGNING_SECRET!);
  const payload={version:'1.0',messageId:item.messageId,correlationId:item.correlationId,causationId:item.causationId,sender:'a2aviary',projectId:item.projectId,taskId:item.taskId,action:item.action,issuedAt:now(),expiresAt:now()+900,payload:item.payload};
  const jws=await sign(payload,credentials.privateKey,credentials.kid);
  try {await update(pk,'SET #s = :s, startedAt = :at, #w = :w, due = :due',{':s':'sending',':at':now(),':pending':'pending',':w':'sending',':due':now()+120},'#s = :pending',{'#s':'status','#w':'work'});}catch(e:any){if(e.name==='ConditionalCheckFailedException')return;throw e;}
  let outcome='accepted_by_ses', sesMessageId:string|undefined;
  try {
    const result=await new SESv2Client({...awsOptions(true),maxAttempts:1}).send(new SendEmailCommand({FromEmailAddress:'agent@a2aviary.io',Destination:{ToAddresses:[item.to]},Content:{Raw:{Data:mimeMessage('agent@a2aviary.io',item.to,jws,item.messageId,item.correlationId)}},ConfigurationSetName:process.env.SES_CONFIG_SET,EmailTags:[{Name:'outbox',Value:item.messageId}]}));
    await update(pk,'SET #s = :s, sesMessageId = :id, acceptedAt = :at REMOVE #w',{':s':'accepted_by_ses',':id':result.MessageId??'unknown',':at':now()},undefined,{'#s':'status','#w':'work'});
    sesMessageId=result.MessageId;
  } catch(e:any) {
    const definite=['MessageRejected','MailFromDomainNotVerifiedException','BadRequestException','NotFoundException','AccountSuspendedException','SendingPausedException','TooManyRequestsException'].includes(e.name);
    await update(pk,'SET #s = :s, reason = :reason REMOVE #w',{':s':definite?'failed':'delivery_unknown',':reason':definite?e.name:'send_outcome_uncertain'},undefined,{'#s':'status','#w':'work'});
    outcome=definite?'failed':'delivery_unknown';
  }
  // A later audit failure must not downgrade durable SES acceptance or cause a resend.
  await audit('email.send',{taskId:item.taskId,correlationId:item.correlationId,messageId:item.messageId,sesMessageId},outcome);
}
export async function handler(event:any){const batchItemFailures=[];for(const r of event.Records){try{await processOutbound(JSON.parse(r.body).pk);}catch(e:any){console.error({operation:'sender',error:e.name});batchItemFailures.push({itemIdentifier:r.messageId});}}return {batchItemFailures};}
