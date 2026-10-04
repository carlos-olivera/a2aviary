import { parseMime, authenticate, bindAttachments, Rejection, capabilities, LIMITS, effectiveLimits } from './protocol.js';
import { raw, get, transact, txPut, txUpdate, outbound, now, audit, flags, s3 } from './store.js';
import { PutObjectTaggingCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

async function acceptInput(key:string){await s3.send(new PutObjectTaggingCommand({Bucket:process.env.DATA_BUCKET!,Key:key,Tagging:{TagSet:[{Key:'Disposition',Value:'accepted'}]}}));}

export async function processReceipt(notification: any) {
  const key = notification.receipt?.action?.objectKey;
  if (!key || notification.receipt.action.bucketName !== process.env.RAW_BUCKET || !notification.receipt.recipients?.includes('agent@a2aviary.io')) throw new Rejection('receipt_invalid');
  if (!(await flags()).processing) throw new Error('processing_paused');
  const mime = await raw(key);
  const parsed = await parseMime(mime);
  const auth = await authenticate(parsed.jws, async kid => await get('PARTNER#'+kid) as any);
  const limits=effectiveLimits(auth.grant);
  if(mime.length>limits.rawBytes || parsed.attachments.length>limits.attachments || parsed.attachments.some(a=>a.content.length>limits.attachmentBytes))throw new Rejection('partner_limit');
  const r:any = {...auth.request,kid:auth.grant.kid};
  const refs=r.attachments ?? [];
  bindAttachments(refs,parsed.attachments);
  const requestKey=`IN#${r.sender}#${r.messageId}`;
  const previous=await get(requestKey);
  if(previous) { if(previous.digest!==auth.digest)throw new Rejection('message_conflict'); if(previous.contentKey)await acceptInput(previous.contentKey); return 'duplicate'; }
  const items:any[]=[txPut({pk:requestKey,digest:auth.digest,at:now(),ttl:now()+90*86400}),txPut({pk:`NONCE#${r.sender}#${r.nonce}`,ttl:now()+90*86400})];
  let response:unknown;
  if(r.action==='capabilities.get')response=capabilities(auth.grant);
  else if(r.action==='task.status') {
    const task=await get('TASK#'+r.taskId);
    if(!task || task.ttl<=now() || task.sender!==r.sender || task.projectId!==r.projectId)throw new Rejection('task_denied');
    response={taskId:r.taskId,state:task.state,reason:task.reason,result:task.result,usage:task.usage};
  } else {
    if(!(await flags()).admission)throw new Rejection('admission_paused');
    r.taskId=randomUUID();
    const day=new Date().toISOString().slice(0,10);
    items.push(txUpdate('DAY#'+day,'SET #ttl = :ttl ADD taskCount :one',{':ttl':now()+90*86400,':one':1,':max':LIMITS.tasksPerDay},'attribute_not_exists(taskCount) OR taskCount < :max',{'#ttl':'ttl'}));
    items.push(txUpdate('DAY#'+r.sender+'#'+day,'SET #ttl = :ttl ADD taskCount :one',{':ttl':now()+90*86400,':one':1,':max':limits.tasksPerDay},'attribute_not_exists(taskCount) OR taskCount < :max',{'#ttl':'ttl'}));
    const attachmentText=parsed.attachments.map(a=>({filename:a.filename,text:a.content.toString('utf8')}));
    if(Buffer.byteLength(JSON.stringify({brief:r.payload.brief,attachments:attachmentText}))>limits.totalInputBytes)throw new Rejection('model_input_too_large');
    // Authenticated content lives in expiring private S3; DynamoDB keeps only its reference.
    const {saveContent}=await import('./store.js');
    await saveContent('inputs/'+r.taskId+'.json',{brief:r.payload.brief,attachments:attachmentText},true);
    items[0].Put.Item.contentKey='inputs/'+r.taskId+'.json';
    items.push(txPut({pk:'TASK#'+r.taskId,...r,payload:undefined,contentKey:'inputs/'+r.taskId+'.json',research:Boolean(r.payload.research),publicTopics:r.payload.publicTopics ?? [],state:'accepted',work:'runtime',due:now(),createdAt:now(),deadline:now()+limits.taskSeconds,submissionKey:randomUUID(),ttl:now()+30*86400}));
    response={taskId:r.taskId,state:'accepted'};
  }
  items.push(txPut(outbound(r,response)));
  try { await transact(items); }
  catch(e:any) { if(e.name==='TransactionCanceledException') { const existing=await get(requestKey); if(existing?.digest===auth.digest){if(existing.contentKey)await acceptInput(existing.contentKey);return 'duplicate';} if(await get(`NONCE#${r.sender}#${r.nonce}`))throw new Rejection('replay'); throw new Rejection('admission_limit'); } throw e; }
  if(r.action==='task.submit')await acceptInput('inputs/'+r.taskId+'.json');
  await audit(r.action,{correlationId:r.correlationId,taskId:r.taskId,partner:r.sender},'accepted');
  return 'accepted';
}
export async function handler(event:any) { const batchItemFailures=[];
  for(const record of event.Records) { let key:string|undefined;
    try { const sns=JSON.parse(record.body); const n=JSON.parse(sns.Message); key=n.receipt?.action?.objectKey; await processReceipt(n); }
    catch(e:any) { if(e instanceof Rejection || e.code==='raw_too_large') { if(key)await s3.send(new PutObjectTaggingCommand({Bucket:process.env.RAW_BUCKET!,Key:key,Tagging:{TagSet:[{Key:'Disposition',Value:'rejected'}]}})); await audit('email.validate',{receiptId:record.messageId},'rejected',e.code); } else { console.error({operation:'email.validate',error:e.name ?? 'Error'}); batchItemFailures.push({itemIdentifier:record.messageId}); } }
  } return {batchItemFailures};
}
