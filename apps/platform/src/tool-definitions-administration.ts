import { z } from 'zod';

import { defineTool } from './tool-definition.ts';

import { email, id, period } from './tool-definitions-schemas.ts';

export const administrationTools = [
  defineTool({
    name: 'site.admin.assign',
    description:
      'Superadmin only: ' +
      'assign' +
      ' verified-email administrators on this catalog site. No platform role or message.',
    roles: ['superadmin'],
    feature: 'siteAdministration',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 30,
    registrationOrder: 24,
    inputSchema: () =>
      id
        .extend({ emails: z.array(z.email().max(254)).min(1).max(100) })
        .strict(),
    handler: ({ principal, administration }, args) =>
      administration!.admins(principal.id, args.siteId, 'assign', args.emails),
  }),
  defineTool({
    name: 'site.admin.remove',
    description:
      'Superadmin only: ' +
      'remove' +
      ' verified-email administrators on this catalog site. No platform role or message.',
    roles: ['superadmin'],
    feature: 'siteAdministration',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 31,
    registrationOrder: 25,
    inputSchema: () =>
      id
        .extend({ emails: z.array(z.email().max(254)).min(1).max(100) })
        .strict(),
    handler: ({ principal, administration }, args) =>
      administration!.admins(principal.id, args.siteId, 'remove', args.emails),
  }),
  defineTool({
    name: 'site.admin.list',
    description:
      'Superadmin only: list assigned/pending/disabled site administrators.',
    roles: ['superadmin'],
    feature: 'siteAdministration',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 32,
    registrationOrder: 26,
    inputSchema: () => id,
    handler: ({ principal, administration }, args) =>
      administration!.admins(principal.id, args.siteId, 'list'),
  }),
  defineTool({
    name: 'site.report',
    description:
      'Private UTC-month operations, owner eligibility history, provider-accrued costs and CSV link. Missing costs remain null.',
    roles: ['superadmin', 'admin', 'client'],
    feature: 'siteAdministration',
    readOnly: true,
    recordsSiteFailure: false,
    capabilityOrder: 33,
    registrationOrder: 27,
    inputSchema: () => id.extend({ period }).strict(),
    handler: ({ principal, administration }, args) =>
      administration!.report(principal.id, args.siteId, args.period),
  }),
  defineTool({
    name: 'site.costs.refresh',
    description:
      'Queue an idempotent read of recorded catalog resources and provider costs. No billing or resource mutation.',
    roles: ['superadmin', 'admin', 'client'],
    feature: 'siteAdministration',
    readOnly: false,
    recordsSiteFailure: false,
    capabilityOrder: 34,
    registrationOrder: 28,
    requiresWorkflow: true,
    inputSchema: () => id.extend({ period: period.optional() }).strict(),
    handler: ({ principal, administration }, args) =>
      administration!.refresh(principal.id, args.siteId, args.period),
  }),
];
