import {
  McpServer,
  type StandardSchemaWithJSON
} from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  AccessError,
  isAdminTool,
  TOOL_ROLES,
  requireRole,
  validatePublicKey,
  type Principal,
  type Store
} from './store.ts';
import type { Plans } from './plans.ts';
import type { Sites } from './sites.ts';
import type {SiteAdministration} from './site-administration.ts';
import { SiteError } from '@a2aviary/generator';

export function createServer(
  principal: Principal,
  store: Store,
  plans: Plans,
  sites?: Sites,
  adminCallsAudited = false,
  administration?: SiteAdministration
) {
  const server = new McpServer(
    {
      name: sites ? 'a2aviary-platform' : 'a2aviary-discovery',
      version: sites ? '0.2.0' : '0.1.0'
    },
    {
      capabilities: { tools: { listChanged: false } },
      maxToolInputElements: 4096
    }
  );
  const empty = z.object({}).strict();
  const plan = z
    .object({
      planId: z.literal(plans.id),
      policyVersion: z.literal(plans.version)
    })
    .strict();
  const add = <T extends z.ZodObject & StandardSchemaWithJSON>(
    name: string,
    description: string,
    schema: T,
    action: (args: z.infer<T>) => Promise<unknown> | unknown,
    readOnly = true
  ) => {
    if (!TOOL_ROLES[name]?.includes(principal.role)) return;
    server.registerTool(
      name,
      {
        description,
        inputSchema: schema as StandardSchemaWithJSON,
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          openWorldHint: false
        }
      },
      async (args) => {
        try {
          const current = await store.principal(principal.id);
          requireRole(current, name);
          if (!adminCallsAudited || !isAdminTool(name))
            await store.recordToolCall(
              principal.id,
              name,
              (args as { siteId?: string }).siteId,
              (args as { test?: boolean }).test
            );
          const result = await action(args as z.infer<T>);
          if (isAdminTool(name))
            await store.adminResult(
              principal.id,
              name,
              'success',
              (args as { siteId?: string }).siteId,
              (args as { test?: boolean }).test
            );
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          const code =
            error instanceof AccessError || error instanceof SiteError
              ? error.code
              : 'operation_failed';
          if (isAdminTool(name))
            await store.adminResult(
              principal.id,
              name,
              code,
              (args as { siteId?: string }).siteId,
              (args as { test?: boolean }).test
            );
          if (
            sites &&
            [
              'site.build',
              'site.status',
              'site.deploy',
              'change.request'
            ].includes(name)
          )
            await sites.failure(
              principal.id,
              name,
              (args as { specId?: string }).specId,
              code,
              (args as { siteId?: string }).siteId
            );
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: code,
                  ...(error instanceof SiteError
                    ? { errors: error.errors }
                    : {})
                })
              }
            ]
          };
        }
      }
    );
  };
  add(
    'capabilities.get',
    'Read active mandate and role-scoped tools. Site work requires exact approval and confirmation.',
    empty,
    () => ({
      mandate: sites ? 'approved-catalog-sites' : 'discovery-only',
      role: principal.role,
      testMode: principal.testMode,
      test: principal.testMode,
      ...(principal.testMode
        ? {
            freePlan: { planId: plans.id, policyVersion: plans.version },
            paymentBypass: true
          }
        : {}),
      tools: Object.keys(TOOL_ROLES).filter(
        (name) =>
          TOOL_ROLES[name].includes(principal.role) &&
          (administration || !['site.admin.assign','site.admin.remove','site.admin.list','site.report','site.costs.refresh'].includes(name)) &&
          (sites || !['site.status','sites.list','site.inspect'].includes(name)) &&
          (sites ||
            ![
              'site.build',
              'site.deploy',
              'change.request',
              'tester.reset',
              'site.costs.refresh'
            ].includes(name))
      ),
      websiteProduction: Boolean(sites) && principal.role !== 'tester',
      payments: false,
      emailTransport: 'existing JWS v1; keys require separate owner enrollment'
    })
  );
  add(
    'plans.list',
    'Read proposed plan contracts; listing does not activate or sell a plan.',
    empty,
    () => ({
      plans: [
        {
          planId: plans.id,
          policyVersion: plans.version,
          status: 'contract-only'
        }
      ]
    })
  );
  add(
    'plan.get_manifest',
    'Read the exact pinned policy manifest in JSON and Markdown.',
    plan,
    () => ({ manifest: plans.manifest, markdown: plans.markdown })
  );
  add(
    'plan.get_schemas',
    'Read site-spec and change-request schemas for the exact pinned policy.',
    plan,
    () => ({ siteSpec: plans.siteSpec, changeRequest: plans.changeRequest })
  );
  add(
    'policy.version',
    'Read packaged policy version and SHA-256. No policy mutation.',
    empty,
    () => ({
      planId: plans.id,
      policyVersion: plans.version,
      policySha256: plans.manifest.policySha256
    })
  );
  if (sites) {
    add(
      'site.build',
      'Queue deterministic catalog generation and secret-free sandbox verification of your uploaded approved spec.',
      z.object({ specId: z.uuid() }).strict(),
      (args) => sites.build(principal.id, args.specId),
      false
    );
    add(
      'site.status',
      'Read only your site, hashes, job results, CMS login URL and UTC change allowance.',
      z.object({ siteId: z.uuid() }).strict(),
      (args) => sites.status(principal.id, args.siteId)
    );
    add(
      'site.deploy',
      'Deploy your verified build to an isolated client project. Confirmation DEPLOY_SITE:<siteId>, or DEPLOY_SITE:<siteId>:<domain> for an initial custom domain. DNS is never modified. cmsPassword is the initial CMS password; encrypted until delivered to Railway and never logged.',
      z
        .object({
          siteId: z.uuid(),
          specId: z.uuid(),
          confirmation: z.string().max(310),
          cmsPassword: z.string().min(16).max(128),
          domain: z
            .string()
            .max(253)
            .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)
            .optional()
        })
        .strict(),
      (args) =>
        sites.deploy(
          principal.id,
          args.siteId,
          args.specId,
          args.cmsPassword,
          args.confirmation,
          args.domain
        ),
      false
    );
    add(
      'change.request',
      'Validate a structured v1 change request against the live base, bind your uploaded candidate spec, and reserve its allowance. Explicit APPLY_CHANGE:<siteId>. CMS content edits use the CMS instead.',
      z
        .object({
          siteId: z.uuid(),
          specId: z.uuid(),
          spec: z.unknown(),
          confirmation: z.string().max(60)
        })
        .strict(),
      (args) =>
        sites.change(
          principal.id,
          args.siteId,
          args.spec,
          args.specId,
          args.confirmation
        ),
      false
    );
  }
  const email = z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase());
  for (const name of ['testers.add', 'testers.remove'] as const)
    add(
      name,
      'Superadmin only: ' +
        (name === 'testers.add'
          ? 'allowlist a free web-simple tester'
          : 'remove tester eligibility; existing test sites stay test-only') +
        '. No message is sent.',
      z.object({ email }).strict(),
      (args) => store.tester(principal.id, name, args.email),
      false
    );
  add(
    'testers.list',
    'Superadmin only: list tester eligibility, including disabled entries.',
    z
      .object({
        after: email.optional(),
        limit: z.number().int().min(1).max(100).default(25)
      })
      .strict(),
    (args) => store.tester(principal.id, 'testers.list', undefined, args)
  );
  add(
    'logs.query',
    'Superadmin only: query redacted audit events, up to 31 days, with bounded pagination; excludes provider logs.',
    z
      .object({
        from: z.iso.datetime().optional(),
        to: z.iso.datetime().optional(),
        actor: z.string().min(1).max(128).optional(),
        tool: z
          .enum(Object.keys(TOOL_ROLES) as [string, ...string[]])
          .optional(),
        test: z.boolean().optional(),
        before: z
          .string()
          .regex(/^[1-9][0-9]{0,17}$/)
          .optional(),
        limit: z.number().int().min(1).max(100).default(25)
      })
      .strict(),
    (args) => store.logs(principal.id, args)
  );
  if (sites) {
    add(
      'sites.list',
      'Superadmin only: list sites by test/live classification, owner or status; bounded cursor pagination.',
      z
        .object({
          test: z.boolean().optional(),
          owner: z.string().min(1).max(128).optional(),
          status: z
            .enum([
              'staged',
              'building',
              'verified',
              'deploying',
              'live',
              'failed',
              'unknown',
              'resetting',
              'archived'
            ])
            .optional(),
          after: z.uuid().optional(),
          limit: z.number().int().min(1).max(100).default(25)
        })
        .strict(),
      (args) => sites.list(principal.id, args)
    );
    add(
      'site.inspect',
      'Superadmin only: inspect status, deployment, hashes and successful/reserved UTC monthly usage. No credentials or client copy.',
      z.object({ siteId: z.uuid() }).strict(),
      (args) => sites.inspect(principal.id,args.siteId)
    );
    if (sites) add(
      'tester.reset',
      'Superadmin only: archive a test site and delete its isolated Railway project, PocketBase volume, bucket artifacts and site change history. Requires RESET <siteId>. Busy jobs must finish first; partial cleanup can be retried.',
      z.object({ siteId: z.uuid(), confirmation: z.string().max(42) }).strict(),
      (args) => sites.reset(principal.id, args.siteId, args.confirmation),
      false
    );
  }
  if (administration) {
    const id=z.object({siteId:z.uuid()}).strict();
    const period=z.string().regex(/^[0-9]{4}-(?:0[1-9]|1[0-2])$/);
    for(const op of ['assign','remove'] as const)add('site.admin.'+op,'Superadmin only: '+op+' verified-email administrators on this catalog site. No platform role or message.',id.extend({emails:z.array(z.email().max(254)).min(1).max(100)}).strict(),args=>administration.admins(principal.id,args.siteId,op,args.emails),false);
    add('site.admin.list','Superadmin only: list assigned/pending/disabled site administrators.',id,args=>administration.admins(principal.id,args.siteId,'list'));
    add('site.report','Private UTC-month operations, owner eligibility history, provider-accrued costs and CSV link. Missing costs remain null.',id.extend({period}).strict(),args=>administration.report(principal.id,args.siteId,args.period));
    if(sites)add('site.costs.refresh','Queue an idempotent read of recorded catalog resources and provider costs. No billing or resource mutation.',id.extend({period:period.optional()}).strict(),args=>administration.refresh(principal.id,args.siteId,args.period),false);
  }
  add(
    'agent_keys.register',
    'Bind a public ES256 key to yourself. Requires REGISTER_MY_AGENT_KEY. Does not enroll signed email.',
    z
      .object({
        publicJwk: z
          .object({
            kty: z.literal('EC'),
            crv: z.literal('P-256'),
            x: z.string().length(43),
            y: z.string().length(43),
            alg: z.literal('ES256').optional(),
            use: z.literal('sig').optional(),
            key_ops: z.array(z.literal('verify')).length(1).optional()
          })
          .strict(),
        confirmation: z.literal('REGISTER_MY_AGENT_KEY')
      })
      .strict(),
    async (args) =>
      store.registerKey(
        principal.id,
        await validatePublicKey(args.publicJwk),
        args.confirmation
      ),
    false
  );
  add(
    'agent_keys.list',
    'List only your public keys and revocation state; no private key material.',
    empty,
    () => store.listKeys(principal.id)
  );
  add(
    'agent_keys.revoke',
    'Revoke your platform key. Separate owner revocation in the email registry is still required.',
    z
      .object({
        keyId: z.string().regex(/^platform-[0-9a-f-]{36}$/),
        confirmation: z.string().max(100)
      })
      .strict(),
    (args) => store.revokeKey(principal.id, args.keyId, args.confirmation),
    false
  );
  add(
    'admin.invite',
    'Superadmin only: invite an admin by verified email for seven days. No invitation message is sent. Confirmation INVITE_ADMIN:<email>.',
    z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        confirmation: z.string().max(280)
      })
      .strict(),
    (args) => store.inviteAdmin(principal.id, args.email, args.confirmation),
    false
  );
  add(
    'admin.revoke',
    'Superadmin only: revoke an admin or pending invitation by email. Requires REVOKE_ADMIN:<email>. Legacy userId remains supported. The configured owner cannot be revoked.',
    z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase())
          .optional(),
        userId: z.string().min(1).max(128).optional(),
        confirmation: z.string().max(280)
      })
      .strict()
      .refine(
        (a) => Boolean(a.email) !== Boolean(a.userId),
        'Provide exactly one email or userId'
      ),
    (args) =>
      args.email
        ? store.revokeAdminEmail(principal.id, args.email, args.confirmation)
        : store.revokeAdmin(principal.id, args.userId!, args.confirmation),
    false
  );
  add(
    'admin.audit.list',
    'Read private audit records with backward pagination. Requires READ_PRIVATE_AUDIT_LOG; the read is audited.',
    z
      .object({
        confirmation: z.literal('READ_PRIVATE_AUDIT_LOG'),
        before: z
          .string()
          .regex(/^[1-9][0-9]{0,17}$/)
          .optional(),
        limit: z.number().int().min(1).max(100).default(25)
      })
      .strict(),
    (args) =>
      store.auditList(principal.id, args.before, args.limit, args.confirmation)
  );
  return server;
}
