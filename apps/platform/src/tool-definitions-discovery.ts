import { z } from 'zod';
import { compactLibraryManifest } from '@a2aviary/generator';
import { ALL_ROLES } from './identity/types.ts';
import { validatePublicKey } from './identity/agent-keys.ts';
import { defineTool } from './tool-definition.ts';
import { availableTools, toolNames } from './tool-registry.ts';
import { empty, plan, email, id } from './tool-definitions-schemas.ts';

export const discoveryTools = [
  defineTool({
    name: 'capabilities.get',
    description:
      'Read active mandate and role-scoped tools. Site work requires exact approval and confirmation.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 0,
    registrationOrder: 0,
    inputSchema: () => empty,
    handler: ({ principal, plans, sites, administration }) => ({
      mandate: sites ? 'approved-catalog-sites' : 'discovery-only',
      role: principal.role,
      testMode: principal.testMode,
      test: principal.testMode,
      ...(principal.testMode
        ? {
            freePlan: { planId: plans.id, policyVersion: plans.version },
            paymentBypass: true,
          }
        : {}),
      tools: availableTools(
        principal.role,
        { sites, administration },
        'capabilities',
      ).map((t) => t.name),
      websiteProduction: Boolean(sites) && principal.role !== 'tester',
      payments: false,
      changeRequests: {
        available: false,
        reason: 'change_requests_unavailable',
        description:
          'Draft-based changes await their revision, snapshot and browser-approval redesign. CMS content edits remain available.',
      },
      emailTransport: 'existing JWS v1; keys require separate owner enrollment',
    }),
  }),
  defineTool({
    name: 'plans.list',
    description:
      'Read proposed plan contracts; listing does not activate or sell a plan.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 1,
    registrationOrder: 1,
    inputSchema: () => empty,
    handler: ({ plans }) => ({
      plans: [
        {
          planId: plans.id,
          policyVersion: plans.version,
          status: 'contract-only',
        },
      ],
    }),
  }),
  defineTool({
    name: 'plan.get_manifest',
    description:
      'Read compact pinned policy and curated package summaries; use library.get for details when site tools are enabled.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 2,
    registrationOrder: 2,
    inputSchema: ({ plans }) => plan(plans),
    handler: (_context) => compactLibraryManifest(),
  }),
  defineTool({
    name: 'plan.get_schemas',
    description:
      'Read site-spec and change-request schemas for the exact pinned policy.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 3,
    registrationOrder: 3,
    inputSchema: ({ plans }) => plan(plans),
    handler: ({ plans }) => ({
      siteSpec: plans.siteSpec,
      changeRequest: plans.changeRequest,
    }),
  }),
  defineTool({
    name: 'policy.version',
    description:
      'Read packaged policy version and SHA-256. No policy mutation.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 4,
    registrationOrder: 4,
    inputSchema: () => empty,
    handler: ({ plans }) => ({
      planId: plans.id,
      policyVersion: plans.version,
      policySha256: plans.manifest.policySha256,
    }),
  }),
  defineTool({
    name: 'testers.add',
    description:
      'Superadmin only: ' +
      (true
        ? 'allowlist a free web-simple tester'
        : 'remove tester eligibility; existing test sites stay test-only') +
      '. No message is sent.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 11,
    registrationOrder: 17,
    inputSchema: () => z.object({ email }).strict(),
    handler: ({ principal, store }, args) =>
      store.tester(principal.id, 'testers.add', args.email),
  }),
  defineTool({
    name: 'testers.remove',
    description:
      'Superadmin only: ' +
      (false
        ? 'allowlist a free web-simple tester'
        : 'remove tester eligibility; existing test sites stay test-only') +
      '. No message is sent.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 12,
    registrationOrder: 18,
    inputSchema: () => z.object({ email }).strict(),
    handler: ({ principal, store }, args) =>
      store.tester(principal.id, 'testers.remove', args.email),
  }),
  defineTool({
    name: 'testers.list',
    description:
      'Superadmin only: list tester eligibility, including disabled entries.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 13,
    registrationOrder: 19,
    inputSchema: () =>
      z
        .object({
          after: email.optional(),
          limit: z.number().int().min(1).max(100).default(25),
        })
        .strict(),
    handler: ({ principal, store }, args) =>
      store.tester(principal.id, 'testers.list', undefined, args),
  }),
  defineTool({
    name: 'logs.query',
    description:
      'Superadmin only: query redacted audit events, up to 31 days, with bounded pagination; excludes provider logs.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 16,
    registrationOrder: 20,
    inputSchema: () =>
      z
        .object({
          from: z.iso.datetime().optional(),
          to: z.iso.datetime().optional(),
          actor: z.string().min(1).max(128).optional(),
          tool: z.enum(toolNames as [string, ...string[]]).optional(),
          test: z.boolean().optional(),
          before: z
            .string()
            .regex(/^[1-9][0-9]{0,17}$/)
            .optional(),
          limit: z.number().int().min(1).max(100).default(25),
        })
        .strict(),
    handler: ({ principal, store }, args) => store.logs(principal.id, args),
  }),
  defineTool({
    name: 'agent_keys.register',
    description:
      'Bind a public ES256 key to yourself. Requires REGISTER_MY_AGENT_KEY. Does not enroll signed email.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 5,
    registrationOrder: 29,
    inputSchema: () =>
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
              key_ops: z.array(z.literal('verify')).length(1).optional(),
            })
            .strict(),
          confirmation: z.literal('REGISTER_MY_AGENT_KEY'),
        })
        .strict(),
    handler: async ({ principal, store }, args) =>
      store.registerKey(
        principal.id,
        await validatePublicKey(args.publicJwk),
        args.confirmation,
      ),
  }),
  defineTool({
    name: 'agent_keys.list',
    description:
      'List only your public keys and revocation state; no private key material.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 6,
    registrationOrder: 30,
    inputSchema: () => empty,
    handler: ({ principal, store }) => store.listKeys(principal.id),
  }),
  defineTool({
    name: 'agent_keys.revoke',
    description:
      'Revoke your platform key. Separate owner revocation in the email registry is still required.',
    roles: ALL_ROLES,
    feature: 'discovery',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 7,
    registrationOrder: 31,
    inputSchema: () =>
      z
        .object({
          keyId: z.string().regex(/^platform-[0-9a-f-]{36}$/),
          confirmation: z.string().max(100),
        })
        .strict(),
    handler: ({ principal, store }, args) =>
      store.revokeKey(principal.id, args.keyId, args.confirmation),
  }),
  defineTool({
    name: 'admin.invite',
    description:
      'Superadmin only: invite an admin by verified email for seven days. No invitation message is sent. Confirmation INVITE_ADMIN:<email>.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 8,
    registrationOrder: 32,
    inputSchema: () =>
      z
        .object({
          email: z
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          confirmation: z.string().max(280),
        })
        .strict(),
    handler: ({ principal, store }, args) =>
      store.inviteAdmin(principal.id, args.email, args.confirmation),
  }),
  defineTool({
    name: 'admin.revoke',
    description:
      'Superadmin only: revoke an admin or pending invitation by email. Requires REVOKE_ADMIN:<email>. Legacy userId remains supported. The configured owner cannot be revoked.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 9,
    registrationOrder: 33,
    inputSchema: () =>
      z
        .object({
          email: z
            .email()
            .max(254)
            .transform((v) => v.toLowerCase())
            .optional(),
          userId: z.string().min(1).max(128).optional(),
          confirmation: z.string().max(280),
        })
        .strict()
        .refine(
          (a) => Boolean(a.email) !== Boolean(a.userId),
          'Provide exactly one email or userId',
        ),
    handler: ({ principal, store }, args) =>
      args.email
        ? store.revokeAdminEmail(principal.id, args.email, args.confirmation)
        : store.revokeAdmin(principal.id, args.userId!, args.confirmation),
  }),
  defineTool({
    name: 'admin.audit.list',
    description:
      'Read private audit records with backward pagination. Requires READ_PRIVATE_AUDIT_LOG; the read is audited.',
    roles: ['superadmin'],
    feature: 'discovery',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 10,
    registrationOrder: 34,
    inputSchema: () =>
      z
        .object({
          confirmation: z.literal('READ_PRIVATE_AUDIT_LOG'),
          before: z
            .string()
            .regex(/^[1-9][0-9]{0,17}$/)
            .optional(),
          limit: z.number().int().min(1).max(100).default(25),
        })
        .strict(),
    handler: ({ principal, store }, args) =>
      store.auditList(principal.id, args.before, args.limit, args.confirmation),
  }),
];
