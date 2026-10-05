import test from 'node:test';
import assert from 'node:assert/strict';
import { simpleParser } from 'mailparser';
import { processSupport, supportMime, MAX_SUPPORT_RAW_BYTES } from '../dist/support.js';
const config = { bucket: 'fictional-support', topic: 'arn:aws:sns:us-east-1:111111111111:fictional-support', owner: 'owner@example.com' };
const raw = Buffer.from('From: Fictional User <user@example.com>\r\nReply-To: reply@example.com\r\nTo: hello@a2aviary.io\r\nSubject: Fictional support\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="fictional"\r\n\r\n--fictional\r\nContent-Type: text/plain\r\n\r\nA fictional support question.\r\n--fictional\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename="example.txt"\r\n\r\nFictional attachment\r\n--fictional--\r\n');
const notification = () => ({ Type: 'Notification', TopicArn: config.topic, Message: JSON.stringify({ notificationType: 'Received', mail: { messageId: 'fictional-id', timestamp: new Date(1000 * 1000).toISOString() }, receipt: { recipients: ['hello@a2aviary.io'], spamVerdict: { status: 'PASS' }, virusVerdict: { status: 'PASS' }, action: { type: 'S3', bucketName: config.bucket, objectKey: 'support/fictional-id', topicArn: config.topic } } }) });
const failure = name => Object.assign(new Error('fictional'), { name });
function fixture(options = {}) {
  const ledger = new Map(); const sent = []; let reads = 0;
  const ports = {
    now: () => 1000,
    get: async id => ledger.get(id),
    create: async (id, ttl) => { if (ledger.has(id)) throw failure('ConditionalCheckFailedException'); ledger.set(id, { status: 'ready', ttl }); },
    transition: async (id, from, status, fields = {}) => { if (ledger.get(id)?.status !== from) throw failure('ConditionalCheckFailedException'); if (options.failAcceptance && status === 'accepted_by_ses') throw failure('ProvisionedThroughputExceededException'); ledger.set(id, { ...ledger.get(id), status, ...fields }); },
    read: async () => { reads++; if (options.readFailure) throw failure('S3Unavailable'); return options.raw ?? raw; },
    send: async data => { sent.push(data); if (options.sendFailure) throw failure(options.sendFailure); return 'fictional-ses-id'; },
  };
  return { ledger, sent, ports, reads: () => reads };
}
test('support preserves original MIME and attachments, uses fixed From/To and original Reply-To', async () => {
  const f = fixture(); assert.equal(await processSupport(notification(), config, f.ports), 'accepted_by_ses');
  const mail = await simpleParser(f.sent[0]);
  assert.equal(mail.from.value[0].address, 'hello@a2aviary.io'); assert.equal(mail.to.value[0].address, config.owner); assert.equal(mail.replyTo.value[0].address, 'reply@example.com');
  assert.match(mail.text, /fictional support question/); assert.equal(mail.attachments.length, 1); assert.equal(mail.attachments[0].filename, 'original.eml'); assert.deepEqual(mail.attachments[0].content, raw);
  assert.equal(f.ledger.get('fictional-id').ttl, 1000 + 7 * 86400);
  assert.equal(await processSupport(notification(), config, f.ports), 'accepted_by_ses'); assert.equal(f.sent.length, 1);
});
test('support falls back to sender and encodes Unicode subjects without invalid header words', async () => {
  const changed = Buffer.from(raw.toString().replace('Reply-To: reply@example.com\r\n', '').replace('Fictional support', 'Fictional café 🦜 '.repeat(12)));
  const data = await supportMime(changed, config.owner); const mail = await simpleParser(data);
  assert.equal(mail.replyTo.value[0].address, 'user@example.com'); assert.match(mail.subject, /café 🦜/);
  for (const word of data.toString().match(/=\?UTF-8\?B\?[^?]+\?=/g)) assert(word.length <= 75);
});
for (const [label, change] of [
  ['foreign SNS topic', n => { n.TopicArn = 'foreign'; }],
  ['foreign bucket', n => { const m = JSON.parse(n.Message); m.receipt.action.bucketName = 'foreign'; n.Message = JSON.stringify(m); }],
  ['foreign recipient', n => { const m = JSON.parse(n.Message); m.receipt.recipients = ['agent@a2aviary.io']; n.Message = JSON.stringify(m); }],
  ['unexpected object', n => { const m = JSON.parse(n.Message); m.receipt.action.objectKey = 'support/another'; n.Message = JSON.stringify(m); }],
  ['foreign action topic', n => { const m = JSON.parse(n.Message); m.receipt.action.topicArn = 'foreign'; n.Message = JSON.stringify(m); }],
]) test(`support rejects ${label} before storage or sending`, async () => { const f = fixture(); const n = notification(); change(n); await assert.rejects(() => processSupport(n, config, f.ports)); assert.equal(f.reads(), 0); assert.equal(f.sent.length, 0); assert.equal(f.ledger.size, 0); });
for (const field of ['spamVerdict', 'virusVerdict']) test(`support quarantines ${field} failure`, async () => { const f = fixture(); const n = notification(); const m = JSON.parse(n.Message); m.receipt[field].status = 'FAIL'; n.Message = JSON.stringify(m); assert.equal(await processSupport(n, config, f.ports), 'quarantined'); assert.equal(f.reads(), 0); assert.equal(f.sent.length, 0); });
for (const [label, changed] of [
  ['malformed mail', Buffer.from('malformed')],
  ['loop marker', Buffer.from('X-A2aviary-Support-Forwarded: 1\r\n' + raw)],
  ['support sender', Buffer.from(raw.toString().replace('user@example.com', 'hello@a2aviary.io'))],
  ['support reply address', Buffer.from(raw.toString().replace('reply@example.com', 'hello@a2aviary.io'))],
  ['owner reply address', Buffer.from(raw.toString().replace('reply@example.com', config.owner))],
  ['invalid reply address', Buffer.from(raw.toString().replace('reply@example.com', 'reply@example..com'))],
  ['multiple reply addresses', Buffer.from(raw.toString().replace('reply@example.com', 'reply@example.com, other@example.com'))],
  ['oversize mail', Buffer.alloc(MAX_SUPPORT_RAW_BYTES + 1)],
]) test(`support quarantines ${label}`, async () => { const f = fixture({ raw: changed }); assert.equal(await processSupport(notification(), config, f.ports), 'quarantined'); assert.equal(f.sent.length, 0); assert.equal(await processSupport(notification(), config, f.ports), 'quarantined'); });
test('support retries failures before send and definite SES refusals', async () => {
  const options = { readFailure: true }; const f = fixture(options);
  await assert.rejects(() => processSupport(notification(), config, f.ports)); assert.equal(f.ledger.get('fictional-id').status, 'ready'); assert.equal(f.sent.length, 0);
  options.readFailure = false; options.sendFailure = 'TooManyRequestsException';
  await assert.rejects(() => processSupport(notification(), config, f.ports)); assert.equal(f.ledger.get('fictional-id').status, 'ready');
  options.sendFailure = undefined; assert.equal(await processSupport(notification(), config, f.ports), 'accepted_by_ses');
});
test('support holds an uncertain send, and repeated queue deliveries never resend', async () => {
  const f = fixture({ sendFailure: 'TimeoutError' });
  await assert.rejects(() => processSupport(notification(), config, f.ports), /support_delivery_held/);
  assert.equal(f.ledger.get('fictional-id').status, 'delivery_unknown');
  await assert.rejects(() => processSupport(notification(), config, f.ports), /support_delivery_held/); assert.equal(f.sent.length, 1);
});
test('support holds a send when persisting SES acceptance fails', async () => {
  const f = fixture({ failAcceptance: true }); await assert.rejects(() => processSupport(notification(), config, f.ports));
  assert.equal(f.ledger.get('fictional-id').status, 'sending');
  await assert.rejects(() => processSupport(notification(), config, f.ports), /support_delivery_held/); assert.equal(f.sent.length, 1);
});
test('concurrent support receipts claim only one send', async () => {
  const f = fixture(); await Promise.allSettled([processSupport(notification(), config, f.ports), processSupport(notification(), config, f.ports)]); assert.equal(f.sent.length, 1);
});

test('expired support redrives cannot resend after ledger expiry', async () => { const f = fixture(); f.ports.now = () => 1000 + 7 * 86400; assert.equal(await processSupport(notification(), config, f.ports), 'expired'); assert.equal(f.sent.length, 0); assert.equal(f.ledger.size, 0); });
test('future timestamps and invalid owner destinations are refused', async () => { const f = fixture(); f.ports.now = () => 0; await assert.rejects(() => processSupport(notification(), config, f.ports), /support_timestamp_invalid/); await assert.rejects(() => processSupport(notification(), { ...config, owner: 'hello@a2aviary.io' }, f.ports), /support_configuration_invalid/); assert.equal(f.sent.length, 0); });
