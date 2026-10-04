import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, TransactWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { randomUUID } from 'node:crypto';
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
export const s3 = new S3Client({}); export const sqs = new SQSClient({});
export const table = () => process.env.STATE_TABLE!;
export const now = () => Math.floor(Date.now()/1000);
export const get = async (pk: string) => (await db.send(new GetCommand({ TableName: table(), Key: {pk}, ConsistentRead: true }))).Item;
export const put = async (item: Record<string,unknown>, condition?: string) => db.send(new PutCommand({ TableName: table(), Item: item, ConditionExpression: condition }));
export const update = async (pk: string, expression: string, values: Record<string,unknown>, condition?: string, names?: Record<string,string>) => db.send(new UpdateCommand({ TableName: table(), Key: {pk}, UpdateExpression: expression, ExpressionAttributeValues: values, ConditionExpression: condition, ExpressionAttributeNames: names }));
export const transact = async (items: any[]) => db.send(new TransactWriteCommand({ TransactItems: items, ClientRequestToken: randomUUID() }));
export const txPut = (Item: any) => ({ Put: { TableName: table(), Item, ConditionExpression: 'attribute_not_exists(pk)' } });
export const txUpdate = (pk: string, UpdateExpression: string, ExpressionAttributeValues: Record<string,unknown>, ConditionExpression?: string) => ({ Update: { TableName: table(), Key: {pk}, UpdateExpression, ExpressionAttributeValues, ConditionExpression } });
export async function due(work: string) { return (await db.send(new QueryCommand({ TableName: table(), IndexName: 'work-due', KeyConditionExpression: '#w = :w AND due <= :n', ExpressionAttributeNames: {'#w':'work'}, ExpressionAttributeValues: {':w':work,':n':now()}, Limit: 100 }))).Items ?? []; }
export async function raw(key: string, bucket = process.env.RAW_BUCKET!) { const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key })); if ((r.ContentLength ?? 0) > 1048576) throw Object.assign(new Error('raw_too_large'), {code:'raw_too_large'}); return Buffer.from(await r.Body!.transformToByteArray()); }
export async function saveContent(key: string, body: unknown) { await s3.send(new PutObjectCommand({Bucket:process.env.DATA_BUCKET!,Key:key,Body:JSON.stringify(body),ContentType:'application/json'})); }
const cache = new Map<string,{at:number,value:any}>();
export async function secret(id: string) { const old=cache.get(id); if(old && now()-old.at<60) return old.value; const r = await new SecretsManagerClient({}).send(new GetSecretValueCommand({SecretId:id})); const value = JSON.parse(r.SecretString!); cache.set(id,{at:now(),value}); return value; }
export async function audit(operation: string, ids: Record<string,unknown>, result: string, reason?: string) { const item={pk:'AUDIT#'+randomUUID(),at:now(),actor:process.env.AWS_LAMBDA_FUNCTION_NAME ?? 'bootstrap',operation,...ids,result,reason,ttl:now()+90*86400}; await put(item); console.log(JSON.stringify({operation,...ids,result,reason})); }
export const flags = async () => (await get('CONTROL#flags')) ?? {admission:false,processing:false,sending:false};
export async function enqueue(queue: string, pk: string, delay=0) { await sqs.send(new SendMessageCommand({QueueUrl:queue,MessageBody:JSON.stringify({pk}),DelaySeconds:Math.max(0,Math.min(900,delay))})); }
export function outbound(request: any, payload: unknown, action='response', suffix='response') { return { pk:`OUT#${request.sender}#${request.messageId}#${suffix}`,work:'outbox',due:now(),status:'pending',sender:request.sender,kid:request.kid,to:request.replyTo,projectId:request.projectId,taskId:request.taskId,messageId:randomUUID(),correlationId:request.correlationId,causationId:request.messageId,action,payload,ttl:now()+30*86400 }; }
export async function lease(pk:string) { const id=randomUUID(); try { await update(pk,'SET leaseId = :id, leaseUntil = :end',{':id':id,':end':now()+75,':n':now()},'attribute_exists(pk) AND (attribute_not_exists(leaseUntil) OR leaseUntil < :n)'); return id; } catch(e:any) { if(e.name==='ConditionalCheckFailedException')return undefined; throw e; } }
