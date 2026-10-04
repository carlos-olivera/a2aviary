import { unmarshall } from '@aws-sdk/util-dynamodb';
import { enqueue, now } from './store.js';
export async function handler(event:any) { const batchItemFailures=[];
  for(const r of event.Records) { try { if(!r.dynamodb?.NewImage)continue; const item=unmarshall(r.dynamodb.NewImage); const previous=r.dynamodb.OldImage?unmarshall(r.dynamodb.OldImage):undefined; if(previous?.work===item.work && previous?.due===item.due)continue; if(!item.work || !['runtime','outbox','cleanup'].includes(item.work))continue; await enqueue(item.work==='outbox'?process.env.OUTBOX_QUEUE!:process.env.RUNTIME_QUEUE!,item.pk,Math.ceil((item.due??now())-now())); }
  catch {batchItemFailures.push({itemIdentifier:r.dynamodb.SequenceNumber});} }return {batchItemFailures};
}
