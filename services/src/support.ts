import { awsOptions } from './environment.js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { simpleParser } from 'mailparser';
import { randomUUID } from 'node:crypto';

export const MAX_SUPPORT_RAW_BYTES = 28_000_000;
export const MAX_SUPPORT_SEND_BYTES = 40_000_000;
const address = 'hello@a2aviary.io';
const terminal = new Set(['accepted_by_ses', 'quarantined']);
const definite = new Set(['AccessDeniedException', 'MessageRejected', 'MailFromDomainNotVerifiedException', 'BadRequestException', 'NotFoundException', 'AccountSuspendedException', 'SendingPausedException', 'TooManyRequestsException']);
export type SupportConfig = { bucket: string; topic: string; owner: string };
export type SupportPorts = {
  get(id: string): Promise<any>;
  create(id: string, ttl: number): Promise<void>;
  transition(id: string, from: string, to: string, fields?: Record<string, string>): Promise<void>;
  read(key: string): Promise<Buffer>;
  send(data: Buffer): Promise<string>;
  now(): number;
};
class Quarantine extends Error { constructor(public code: string) { super(code); } }
const validAddress = (value: string) => {
  if (typeof value !== 'string' || value.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(value)) return false;
  const [local, domain] = value.split('@');
  const labels = domain.split('.');
  return local.length <= 64 && local.split('.').every(Boolean) && labels.length >= 2 && labels.every(label => label.length <= 63 && /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)) && /^[A-Za-z]{2,}$/.test(labels.at(-1)!);
};
const encodedSubject = (value: string) => {
  const chunks: string[] = []; let chunk = '';
  for (const character of value) { if (Buffer.byteLength(chunk + character) > 42) { chunks.push(chunk); chunk = ''; } chunk += character; }
  if (chunk) chunks.push(chunk);
  return chunks.map(part => '=?UTF-8?B?' + Buffer.from(part).toString('base64') + '?=').join('\r\n ');
};
const b64 = (value: Buffer) => value.toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';

export async function supportMime(raw: Buffer, owner: string): Promise<Buffer> {
  if (raw.length > MAX_SUPPORT_RAW_BYTES) throw new Quarantine('message_too_large');
  const mail = await simpleParser(raw, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
  const from = mail.from?.value;
  const replies = mail.replyTo?.value ?? from;
  if (!from || from.length !== 1 || !from[0].address || !validAddress(from[0].address) || !replies || replies.length !== 1 || !replies[0].address || !validAddress(replies[0].address)) throw new Quarantine('invalid_sender');
  const reply = replies[0].address;
  if (mail.headers.has('x-a2aviary-support-forwarded') || from[0].address.toLowerCase() === address || [address, owner.toLowerCase()].includes(reply.toLowerCase())) throw new Quarantine('forwarding_loop');
  const boundary = 'a2aviary-support-' + randomUUID();
  const subject = encodedSubject('Support: ' + (mail.subject ?? '(no subject)').replace(/[\r\n\x00-\x1f]/g, ' ').slice(0, 160));
  const summary = Buffer.from(`Support message received at ${address}.\nFrom: ${from[0].address}\nReply to: ${reply}\n\n${(mail.text ?? 'Open the attached original message to view its content.').slice(0, 16000)}\n\nThe attached original.eml preserves the original message and attachments.`);
  const data = Buffer.from([
    `From: a2aviary Support <${address}>`, `To: ${owner}`, `Reply-To: ${reply}`,
    `Subject: ${subject}`, 'MIME-Version: 1.0', 'X-A2aviary-Support-Forwarded: 1',
    `Content-Type: multipart/mixed; boundary="${boundary}"`, '', `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(summary),
    `--${boundary}`, 'Content-Type: application/octet-stream; name="original.eml"',
    'Content-Disposition: attachment; filename="original.eml"', 'Content-Transfer-Encoding: base64', '', b64(raw), `--${boundary}--`, '',
  ].join('\r\n'));
  if (data.length > MAX_SUPPORT_SEND_BYTES) throw new Quarantine('message_too_large');
  return data;
}

export async function processSupport(envelope: any, config: SupportConfig, ports: SupportPorts): Promise<string> {
  if (!validAddress(config.owner) || config.owner.toLowerCase() === address) throw new Error('support_configuration_invalid');
  if (envelope.Type !== 'Notification' || envelope.TopicArn !== config.topic) throw new Error('support_notification_invalid');
  const n = JSON.parse(envelope.Message);
  const id = n.mail?.messageId;
  const receipt = n.receipt;
  if (n.notificationType !== 'Received' || typeof id !== 'string' || !/^[A-Za-z0-9-]{1,200}$/.test(id) || !receipt || receipt.action?.type !== 'S3' || receipt.action.bucketName !== config.bucket || receipt.action.objectKey !== 'support/' + id || receipt.action.topicArn !== config.topic || !Array.isArray(receipt.recipients) || !receipt.recipients.some((r: string) => r.toLowerCase() === address)) throw new Error('support_receipt_invalid');
  const receivedAt = Date.parse(n.mail.timestamp) / 1000;
  if (!Number.isFinite(receivedAt) || receivedAt > ports.now() + 300) throw new Error('support_timestamp_invalid');
  // Expired queue redrives must not resend after the seven-day ledger expires.
  if (receivedAt <= ports.now() - 7 * 86400) { console.error({ operation: 'support.forward', receiptId: id, error: 'receipt_expired' }); return 'expired'; }
  let existing = await ports.get(id);
  if (!existing) {
    try { await ports.create(id, Math.floor(receivedAt) + 7 * 86400); }
    catch (e: any) { if (e.name !== 'ConditionalCheckFailedException') throw e; }
    existing = await ports.get(id);
  }
  if (!existing) throw new Error('support_ledger_missing');
  if (terminal.has(existing.status)) return existing.status;
  if (existing.status !== 'ready') throw new Error('support_delivery_held');
  let data: Buffer;
  try {
    if (receipt.spamVerdict?.status !== 'PASS' || receipt.virusVerdict?.status !== 'PASS') throw new Quarantine('scan_not_passed');
    data = await supportMime(await ports.read(receipt.action.objectKey), config.owner);
  } catch (e: any) {
    if (!(e instanceof Quarantine)) throw e;
    await ports.transition(id, 'ready', 'quarantined', { reason: e.code });
    console.error({ operation: 'support.forward', receiptId: id, error: e.code });
    return 'quarantined';
  }
  // Claim before calling SES. A crash or ambiguous send remains held for human reconciliation.
  await ports.transition(id, 'ready', 'sending');
  let sesMessageId: string;
  try { sesMessageId = await ports.send(data); }
  catch (e: any) {
    console.error({ operation: 'support.send', receiptId: id, error: definite.has(e.name) ? e.name : 'send_outcome_uncertain' });
    await ports.transition(id, 'sending', definite.has(e.name) ? 'ready' : 'delivery_unknown', { reason: definite.has(e.name) ? e.name : 'send_outcome_uncertain' });
    throw new Error(definite.has(e.name) ? 'support_send_failed' : 'support_delivery_held');
  }
  await ports.transition(id, 'sending', 'accepted_by_ses', { sesMessageId });
  return 'accepted_by_ses';
}

const s3 = new S3Client(awsOptions());
const ses = new SESv2Client({ ...awsOptions(true), maxAttempts: 1 });
const db = DynamoDBDocumentClient.from(new DynamoDBClient(awsOptions()));
const table = () => process.env.SUPPORT_TABLE!;
const config = (): SupportConfig => ({ bucket: process.env.SUPPORT_BUCKET!, topic: process.env.SUPPORT_TOPIC!, owner: process.env.SUPPORT_OWNER! });
const ports: SupportPorts = {
  now: () => Math.floor(Date.now() / 1000),
  get: async id => (await db.send(new GetCommand({ TableName: table(), Key: { pk: id }, ConsistentRead: true }))).Item,
  create: async (id, ttl) => { await db.send(new PutCommand({ TableName: table(), Item: { pk: id, status: 'ready', ttl }, ConditionExpression: 'attribute_not_exists(pk)' })); },
  transition: async (id, from, to, fields = {}) => {
    const entries = Object.entries(fields);
    await db.send(new UpdateCommand({ TableName: table(), Key: { pk: id }, UpdateExpression: 'SET #status = :to' + entries.map((_, i) => `, #f${i} = :f${i}`).join(''), ConditionExpression: '#status = :from', ExpressionAttributeNames: { '#status': 'status', ...Object.fromEntries(entries.map(([key], i) => ['#f' + i, key])) }, ExpressionAttributeValues: { ':from': from, ':to': to, ...Object.fromEntries(entries.map(([, value], i) => [':f' + i, value])) } }));
  },
  read: async key => {
    const object = await s3.send(new GetObjectCommand({ Bucket: config().bucket, Key: key }));
    if (!object.Body) throw new Error('support_object_missing');
    if ((object.ContentLength ?? Infinity) > MAX_SUPPORT_RAW_BYTES) { if ('destroy' in object.Body) object.Body.destroy(); throw new Quarantine('message_too_large'); }
    return Buffer.from(await object.Body.transformToByteArray());
  },
  send: async data => {
    const result = await ses.send(new SendEmailCommand({ FromEmailAddress: address, Destination: { ToAddresses: [config().owner] }, Content: { Raw: { Data: data } } }));
    if (!result.MessageId) throw new Error('support_send_id_missing');
    return result.MessageId;
  },
};
export async function handler(event: any) {
  const batchItemFailures = [];
  for (const record of event.Records) {
    try { await processSupport(JSON.parse(record.body), config(), ports); }
    catch { console.error({ operation: 'support.forward', error: 'processing_failed', receiptId: record.messageId }); batchItemFailures.push({ itemIdentifier: record.messageId }); }
  }
  return { batchItemFailures };
}
