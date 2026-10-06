import { McpServer, type StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { AccessError, TOOL_ROLES, requireRole, validatePublicKey, type Principal, type Store } from './store.ts';
import type { Plans } from './plans.ts';

export function createServer(principal: Principal, store: Store, plans: Plans) {
  const server = new McpServer({name: 'a2aviary-discovery', version: '0.1.0'}, {capabilities: {tools: {listChanged: false}}, maxToolInputElements: 128});
  const empty = z.object({}).strict();
  const plan = z.object({planId: z.literal(plans.id), policyVersion: z.literal(plans.version)}).strict();
  const add = <T extends z.ZodObject & StandardSchemaWithJSON>(name: string, description: string, schema: T, action: (args: z.infer<T>) => Promise<unknown> | unknown, readOnly = true) => {
    if (!TOOL_ROLES[name]?.includes(principal.role)) return;
    server.registerTool(name, {description, inputSchema: schema as StandardSchemaWithJSON, annotations: {readOnlyHint: readOnly, destructiveHint: !readOnly, openWorldHint: false}}, async args => {
      try {
        const current = await store.principal(principal.id);
        requireRole(current, name);
        await store.recordToolCall(principal.id, name);
        const result = await action(args as z.infer<T>);
        return {content: [{type: 'text', text: JSON.stringify(result)}]};
      } catch (error) {
        const code = error instanceof AccessError ? error.code : 'operation_failed';
        return {isError: true, content: [{type: 'text', text: JSON.stringify({error: code})}]};
      }
    });
  };
  add('capabilities.get', 'Discovery-only mandate. No purchase, site submission, generation or deployment.', empty, () => ({
    mandate: 'discovery-only', role: principal.role, testMode: principal.testMode,
    tools: Object.keys(TOOL_ROLES).filter(name => TOOL_ROLES[name].includes(principal.role)),
    websiteProduction: false, payments: false, emailTransport: 'existing JWS v1; keys require separate owner enrollment'
  }));
  add('plans.list', 'Read proposed plan contracts; listing does not activate or sell a plan.', empty, () => ({plans: [{planId: plans.id, policyVersion: plans.version, status: 'contract-only'}]}));
  add('plan.get_manifest', 'Read the exact pinned policy manifest in JSON and Markdown.', plan, () => ({manifest: plans.manifest, markdown: plans.markdown}));
  add('plan.get_schemas', 'Read site-spec and change-request schemas for the exact pinned policy.', plan, () => ({siteSpec: plans.siteSpec, changeRequest: plans.changeRequest}));
  add('policy.version', 'Read packaged policy version and SHA-256. No policy mutation.', empty, () => ({planId: plans.id, policyVersion: plans.version, policySha256: plans.manifest.policySha256}));
  add('agent_keys.register', 'Bind a public ES256 key to yourself. Requires REGISTER_MY_AGENT_KEY. Does not enroll signed email.',
    z.object({publicJwk: z.object({kty: z.literal('EC'), crv: z.literal('P-256'), x: z.string().length(43), y: z.string().length(43), alg: z.literal('ES256').optional(), use: z.literal('sig').optional(), key_ops: z.array(z.literal('verify')).length(1).optional()}).strict(), confirmation: z.literal('REGISTER_MY_AGENT_KEY')}).strict(),
    async args => store.registerKey(principal.id, await validatePublicKey(args.publicJwk), args.confirmation), false);
  add('agent_keys.list', 'List only your public keys and revocation state; no private key material.', empty, () => store.listKeys(principal.id));
  add('agent_keys.revoke', 'Revoke your platform key. Separate owner revocation in the email registry is still required.',
    z.object({keyId: z.string().regex(/^platform-[0-9a-f-]{36}$/), confirmation: z.string().max(100)}).strict(), args => store.revokeKey(principal.id, args.keyId, args.confirmation), false);
  add('admin.invite', 'Superadmin only: invite an admin by verified email for seven days. No invitation message is sent. Confirmation INVITE_ADMIN:<email>.',
    z.object({email: z.email().max(254).transform(v => v.toLowerCase()), confirmation: z.string().max(280)}).strict(), args => store.inviteAdmin(principal.id, args.email, args.confirmation), false);
  add('admin.revoke', 'Superadmin only: revoke an invited admin. Requires REVOKE_ADMIN:<userId>; the configured owner cannot be revoked.',
    z.object({userId: z.string().min(1).max(128), confirmation: z.string().max(150)}).strict(), args => store.revokeAdmin(principal.id, args.userId, args.confirmation), false);
  add('admin.audit.list', 'Read private audit records with backward pagination. Requires READ_PRIVATE_AUDIT_LOG; the read is audited.',
    z.object({confirmation: z.literal('READ_PRIVATE_AUDIT_LOG'), before: z.string().regex(/^[1-9][0-9]{0,17}$/).optional(), limit: z.number().int().min(1).max(100).default(25)}).strict(), args => store.auditList(principal.id, args.before, args.limit, args.confirmation));
  return server;
}
