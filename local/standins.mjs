import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../infra/package.json', import.meta.url));
const { SESClient, SendRawEmailCommand, DescribeActiveReceiptRuleSetCommand } = require('@aws-sdk/client-ses');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const serviceRequire = createRequire(new URL('../services/package.json', import.meta.url));
const { S3Client, PutObjectCommand, GetObjectCommand } = serviceRequire('@aws-sdk/client-s3');
const options = { endpoint: process.env.AWS_ENDPOINT_URL, region: 'us-east-1', credentials: { accessKeyId: 'test', secretAccessKey: 'test' }, forcePathStyle: true };
if (options.endpoint !== 'http://localstack:4566') throw new Error('local_endpoint_denied');
const ses = new SESClient(options), sns = new SNSClient(options), s3 = new S3Client(options);
const fixture = JSON.parse(await readFile(new URL('./fixtures/brief-analysis.json', import.meta.url)));
const sessions = new Map(), sent = [], prs = [];
let websiteBucket;
function reply(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); }
async function body(req) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 2 * 1024 * 1024) throw new Error('local_body_limit'); chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
createServer(async (req, res) => {
  try {
    const path = new URL(req.url, 'http://standins').pathname;
    if (path === '/health') return reply(res, 200, { ready: true });
    if (path === '/local/website' && req.method === 'POST') { websiteBucket = (await body(req)).bucket; return reply(res, 200, { configured: true }); }
    if (path === '/local/records') return reply(res, 200, { sent, prs });
    if (path === '/local/receive' && req.method === 'POST') {
      const input = await body(req);
      const rules = await ses.send(new DescribeActiveReceiptRuleSetCommand({}));
      let matched = false;
      for (const rule of rules.Rules ?? []) {
        if (!rule.Enabled || !rule.Recipients?.some(r => input.recipients.includes(r))) continue;
        matched = true;
        for (const action of rule.Actions ?? []) {
          if (action.S3Action) {
            const a = action.S3Action, key = (a.ObjectKeyPrefix ?? '') + randomUUID();
            await s3.send(new PutObjectCommand({ Bucket: a.BucketName, Key: key, Body: Buffer.from(input.mime, 'base64') }));
            if (a.TopicArn) await sns.send(new PublishCommand({ TopicArn: a.TopicArn, Message: JSON.stringify({ receipt: { recipients: input.recipients, action: { bucketName: a.BucketName, objectKey: key } } }) }));
          }
          if (action.StopAction) return reply(res, 200, { accepted: true, adapter: 'receipt-rule-actions' });
        }
      }
      return reply(res, matched ? 200 : 422, { accepted: matched, adapter: 'receipt-rule-actions' });
    }
    if (path === '/v2/email/outbound-emails' && req.method === 'POST') {
      const input = await body(req), raw = Buffer.from(input.Content.Raw.Data, 'base64');
      const result = await ses.send(new SendRawEmailCommand({ Source: input.FromEmailAddress, Destinations: input.Destination.ToAddresses, RawMessage: { Data: raw }, ConfigurationSetName: input.ConfigurationSetName, Tags: input.EmailTags }));
      sent.push({ id: result.MessageId, raw: raw.toString('base64') });
      return reply(res, 200, { MessageId: result.MessageId });
    }
    if (path.startsWith('/github/')) {
      if (req.method === 'POST' && path.endsWith('/access_tokens')) { const input = await body(req); if (input.permissions?.administration || input.permissions?.workflows) return reply(res, 403, { message: 'denied' }); return reply(res, 201, { token: 'local-fake-token', expires_at: new Date(Date.now() + 3600000).toISOString() }); }
      if (req.method === 'POST' && path.endsWith('/pulls')) { if (req.headers.authorization !== 'Bearer local-fake-token') return reply(res, 403, { message: 'denied' }); prs.push(await body(req)); return reply(res, 201, { number: prs.length, user: { login: 'local-operator' }, auto_merge: null }); }
      return reply(res, 404, { message: 'local_route_missing' });
    }
    if (path === '/v1/agents/sessions' && req.method === 'POST') {
      const input = await body(req), id = 'local-session-' + randomUUID();
      sessions.set(id, { id, created_at: Math.floor(Date.now() / 1000), metadata: input.metadata, status: 'waiting', usage: { input_tokens: 100, output_tokens: 50 }, required_actions: [{ type: 'function_call', name: 'get_project_inputs', arguments: {}, turn_id: 'local-turn', call_id: 'local-call' }] });
      return reply(res, 200, sessions.get(id));
    }
    if (path === '/v1/agents/sessions' && req.method === 'GET') return reply(res, 200, { object: 'list', data: [...sessions.values()], has_more: false });
    const match = path.match(/^\/v1\/agents\/sessions\/([^/]+)(?:\/(events|turns|items))?$/);
    if (match) {
      const session = sessions.get(match[1]); if (!session) return reply(res, 404, { error: { message: 'local_session_missing' } });
      if (req.method === 'DELETE') { sessions.delete(match[1]); return reply(res, 200, { deleted: true }); }
      if (match[2] === 'events' && req.method === 'POST') { const input = await body(req); session.status = input.events.some(e => e.type.endsWith('.cancel')) ? 'failed' : 'idle'; session.required_actions = []; return reply(res, 200, { accepted: true }); }
      if (match[2] === 'turns') return reply(res, 200, { object: 'list', data: [{ id: 'local-turn', status: session.status === 'failed' ? 'cancelled' : 'completed' }], has_more: false });
      if (match[2] === 'items') return reply(res, 200, { object: 'list', data: [{ id: 'local-item', type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(fixture) }] }], has_more: false });
      return reply(res, 200, session);
    }
    return reply(res, 404, { message: 'local_route_missing' });
  } catch { reply(res, 500, { message: 'local_adapter_failure' }); }
}).listen(8090, '0.0.0.0');
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
    let key = decodeURIComponent(new URL(req.url, 'http://standins').pathname).slice(1) || 'index.html';
    if (key === 'architecture/' || key === 'architecture/index.html') key = 'architecture';
    if (key.includes('..')) throw new Error('path_denied');
    const object = await s3.send(new GetObjectCommand({ Bucket: websiteBucket, Key: key }));
    res.writeHead(200, { 'Content-Type': object.ContentType, 'Content-Security-Policy': csp, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await object.Body.transformToByteArray()));
  } catch { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); }
}).listen(8080, '0.0.0.0');
