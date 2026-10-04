import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { db, table, update, put, now, audit } from './store.js';
import { hash } from './protocol.js';
export async function handler(event:any){for(const record of event.Records){const data=JSON.parse(record.Sns.Message);const messageId=data.mail?.tags?.outbox?.[0];if(!messageId || !['Delivery','Bounce','Complaint'].includes(data.eventType))continue;
  const items=(await db.send(new QueryCommand({TableName:table(),IndexName:'message-id',KeyConditionExpression:'messageId = :id',ExpressionAttributeValues:{':id':messageId}}))).Items??[];
  if(!items.length)throw new Error('outbox_index_not_visible');
  for(const item of items){const type=data.eventType;if(!['Delivery','Bounce','Complaint'].includes(type))continue;await update(item.pk,'SET deliveryState = :state, deliveryAt = :at',{':state':type.toLowerCase(),':at':now()});if(type!=='Delivery')await put({pk:'SUPPRESS#'+hash(item.to),reason:type.toLowerCase(),ttl:now()+90*86400});await audit('email.delivery',{messageId,sesMessageId:data.mail.messageId},type.toLowerCase());}
}}
