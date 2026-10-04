import { LIMITS } from './protocol.js';
import { due, enqueue, get, put, now, update, db, table, audit } from './store.js';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
export async function handler(){
  const month='BUDGET#'+new Date().toISOString().slice(0,7);
  if(!await get(month)){try{await put({pk:month,availableMicros:LIMITS.monthMicros,reservedMicros:0,spentMicros:0,activeTasks:0,ttl:now()+90*86400},'attribute_not_exists(pk)');}catch(e:any){if(e.name!=='ConditionalCheckFailedException')throw e;}}
  const budget=await get(month);
  console.log({operation:'budget.observe',committedDollars:((budget?.spentMicros??0)+(budget?.reservedMicros??0))/1000000});
  for(const work of ['runtime','outbox','cleanup'])for(const item of await due(work)){if((item.leaseUntil??0)>now())continue;await enqueue(work==='outbox'?process.env.OUTBOX_QUEUE!:process.env.RUNTIME_QUEUE!,item.pk);}
  // A send claimed before a worker crash is never implicitly retried.
  const stuck=await due('sending');
  for(const item of stuck){try{await update(item.pk,'SET #s = :unknown REMOVE #w',{':unknown':'delivery_unknown',':sending':'sending'},'#s = :sending',{'#s':'status','#w':'work'});await audit('email.reconcile',{messageId:item.messageId},'delivery_unknown','worker_interrupted');}catch(e:any){if(e.name!=='ConditionalCheckFailedException')throw e;}}
}
