import { Ajv } from 'ajv';
import { compactVerify, decodeProtectedHeader, importJWK, CompactSign, type JWK } from 'jose';
import { createHash } from 'node:crypto';
import { simpleParser } from 'mailparser';
import requestSchema from '../../contracts/request.schema.json' with { type: 'json' };
import resultSchema from '../../contracts/result.schema.json' with { type: 'json' };
import defaults from '../../contracts/limits.defaults.json' with { type: 'json' };

export const MIME = 'application/vnd.a2aviary.email+json';
function reduced(base:typeof defaults, override:Record<string,unknown>) {
  const result={...base};for(const [key,value]of Object.entries(override)){if(!(key in result) || !Number.isInteger(value) || Number(value)<1 || Number(value)>base[key as keyof typeof base])throw new Error('invalid_limit_configuration');result[key as keyof typeof base]=Number(value);}return Object.freeze(result);
}
export const LIMITS = reduced(defaults, JSON.parse(process.env.OPERATING_LIMITS??'{}'));
export function effectiveLimits(grant?: {limits?:Record<string,unknown>}) {if(grant?.limits && ('monthMicros' in grant.limits || 'concurrentTasks' in grant.limits))throw new Rejection('identity_invalid');return reduced({...LIMITS},grant?.limits??{});}

const ajv = new Ajv({ allErrors: false, strict: false });
const validate = ajv.compile(requestSchema);
export const validateResult = ajv.compile(resultSchema);
export { resultSchema };
export type Request = { version: string; messageId: string; correlationId: string; causationId?: string; sender: string; projectId: string; taskId?: string; action: string; issuedAt: number; expiresAt: number; nonce: string; replyTo: string; payload: Record<string, unknown>; attachments?: { filename: string; sha256: string }[] };
export type Grant = { pk?: string; sender: string; kid: string; publicKey: JWK; projects: string[]; actions: string[]; replyTo: string; expiresAt: number; revoked?: boolean; research?: boolean; limits?: Record<string,number> };
export class Rejection extends Error { constructor(public code: string) { super(code); } }
export const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export function bindAttachments(refs: {filename:string;sha256:string}[], attachments: {filename?:string;content:Buffer}[]) {
  if(refs.length!==attachments.length || new Set(refs.map(r=>r.filename)).size!==refs.length || attachments.some(a=>refs.filter(r=>r.filename===a.filename && r.sha256===hash(a.content)).length!==1))throw new Rejection('attachment_binding');
}
export const capabilities = (grant?: Grant) => ({ version: '1.0', actions: ['capabilities.get', 'task.submit', 'task.status'].filter(action=>!grant || grant.actions.includes(action)), taskTypes: !grant || grant.actions.includes('task.submit')?['website.brief.analyze']:[], limits: effectiveLimits(grant), transport: 'a2aviary Email Transport v1' });

export async function parseMime(raw: Buffer) {
  if (raw.length > LIMITS.rawBytes) throw new Rejection('raw_too_large');
  const mail = await simpleParser(raw, { skipHtmlToText: true, skipTextToHtml: true, skipImageLinks: true });
  const protocol = mail.attachments.filter(a => a.contentType === MIME);
  if (protocol.length !== 1 || protocol[0].content.length > LIMITS.payloadBytes * 2) throw new Rejection('protocol_part_invalid');
  let envelope: { jws: string };
  try { envelope = JSON.parse(protocol[0].content.toString('utf8')); } catch { throw new Rejection('envelope_invalid'); }
  if (!envelope || Object.keys(envelope).join(',') !== 'jws' || typeof envelope.jws !== 'string') throw new Rejection('envelope_invalid');
  const attachments = mail.attachments.filter(a => a.contentType !== MIME);
  if (attachments.length > LIMITS.attachments) throw new Rejection('attachments_too_many');
  for (const a of attachments) {
    if (a.content.length > LIMITS.attachmentBytes || a.contentType !== 'text/plain' || !/^[A-Za-z0-9_.-]+\.txt$/.test(a.filename ?? '')) throw new Rejection('attachment_invalid');
    try { new TextDecoder('utf-8', { fatal: true }).decode(a.content); } catch { throw new Rejection('attachment_encoding'); }
  }
  return { jws: envelope.jws, attachments };
}

export async function authenticate(jws: string, findGrant: (kid: string) => Promise<Grant | undefined>, now = Math.floor(Date.now()/1000)) {
  if (Buffer.byteLength(jws) > LIMITS.payloadBytes * 2) throw new Rejection('payload_too_large');
  let header; try { header = decodeProtectedHeader(jws); } catch { throw new Rejection('signature_invalid'); }
  if (header.alg !== 'ES256' || typeof header.kid !== 'string' || header.kid.length > 100 || !/^[A-Za-z0-9_-]+$/.test(header.kid)) throw new Rejection('key_invalid');
  const grant = await findGrant(header.kid);
  if (!grant || grant.revoked || grant.expiresAt <= now) throw new Rejection('identity_invalid');
  let bytes: Uint8Array;
  try { bytes = (await compactVerify(jws, await importJWK(grant.publicKey, 'ES256'), { algorithms: ['ES256'] })).payload; } catch { throw new Rejection('signature_invalid'); }
  if (bytes.length > effectiveLimits(grant).payloadBytes) throw new Rejection('payload_too_large');
  let request: Request;
  try { request = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new Rejection('schema_invalid'); }
  if (!validate(request)) throw new Rejection('schema_invalid');
  if (request.sender !== grant.sender || !grant.projects.includes(request.projectId) || !grant.actions.includes(request.action)) throw new Rejection('scope_denied');
  if (request.replyTo !== grant.replyTo) throw new Rejection('reply_denied');
  if (request.issuedAt > now + 60 || request.expiresAt <= now || request.expiresAt <= request.issuedAt || request.expiresAt - request.issuedAt > 900) throw new Rejection('expired');
  if (request.action === 'task.submit') {
    const p = request.payload;
    if (Object.keys(p).some(k => !['brief','publicTopics','research'].includes(k)) || typeof p.brief !== 'string' || p.brief.length < 1 || Buffer.byteLength(p.brief) > 32768 || (p.research !== undefined && typeof p.research !== 'boolean') || (p.publicTopics !== undefined && (!Array.isArray(p.publicTopics) || p.publicTopics.length > 5 || p.publicTopics.some(x => typeof x !== 'string' || x.length > 200)))) throw new Rejection('payload_invalid');
    if (p.research && !grant.research) throw new Rejection('research_denied');
  } else if (Object.keys(request.payload).length || (request.action === 'task.status' && !request.taskId)) throw new Rejection('payload_invalid');
  return { request, grant, digest: hash(Buffer.from(bytes)) };
}

export async function sign(payload: unknown, key: JWK, kid: string) { return new CompactSign(Buffer.from(JSON.stringify(payload))).setProtectedHeader({ alg: 'ES256', kid }).sign(await importJWK(key, 'ES256')); }

export function mimeMessage(from: string, to: string, jws: string, messageId: string, correlationId: string) {
  for (const h of [from,to,messageId,correlationId]) if (/[\r\n]/.test(h)) throw new Rejection('header_invalid');
  const boundary = 'a2aviary-' + hash(jws).slice(0,24);
  return Buffer.from(`From: ${from}\r\nTo: ${to}\r\nSubject: a2aviary ${correlationId}\r\nMessage-ID: <${messageId}@a2aviary.io>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nMachine-readable a2aviary Email Transport v1 message.\r\n--${boundary}\r\nContent-Type: ${MIME}\r\nContent-Disposition: attachment; filename="a2aviary.json"\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(JSON.stringify({jws})).toString('base64').match(/.{1,76}/g)?.join('\r\n')}\r\n--${boundary}--\r\n`);
}
