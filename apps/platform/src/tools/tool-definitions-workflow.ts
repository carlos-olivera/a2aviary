import { z } from 'zod';
import { getStarter, listStarters } from '@a2aviary/site-core';
import { SiteError, libraryDetail } from '@a2aviary/generator';
import { ALL_ROLES } from '../identity/types.ts';

import { defineTool } from './tool-definition.ts';

import {
  id,
  draftId,
  requestId,
  expectedRevision,
  operations,
} from './tool-definitions-schemas.ts';

export const workflowTools = [
  defineTool({
    name: 'starters.list', description: 'List data-only starting points visible to this principal. Experimental starters require tester classification.',
    roles: ALL_ROLES, feature: 'siteWorkflow', readOnly: true, recordsSiteFailure: false, order: 5.1,
    inputSchema: () => z.object({}).strict(),
    handler: ({ principal }) => ({ starters: listStarters(principal.testMode) }),
  }),
  defineTool({
    name: 'starter.get', description: 'Read a starter seed and English agent guidance, never site copy. Applied once at creation; a different starter requires a new site.',
    roles: ALL_ROLES, feature: 'siteWorkflow', readOnly: true, recordsSiteFailure: false, order: 5.2,
    inputSchema: () => z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), version: z.string().max(64).optional() }).strict(),
    handler: ({ principal }, a) => {
      const starter = getStarter(a.id, a.version, principal.testMode);
      if (!starter) throw new SiteError('starter_unavailable');
      return starter;
    },
  }),
  defineTool({
    name: 'library.get',
    description:
      'Read one curated package, compatibility, status and fictional example props. Does not accept code.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: true,
    recordsSiteFailure: false,
    order: 5,
    inputSchema: () => z.object({ id: z.string().max(96) }).strict(),
    handler: (_context, a) => libraryDetail(a.id),
  }),
  defineTool({
    name: 'site.draft.create',
    description:
      'Create an incomplete server draft, optionally seeded once from a starter. Starter provenance cannot change; all presentation and content values must be supplied.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: false,
    order: 6,
    inputSchema: () =>
      z
        .object({ slug: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), requestId, starter: z.object({ id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/), version: z.string().max(64).optional() }).strict().optional() })
        .strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.create(principal.id, a.slug, a.requestId, a.starter),
  }),
  defineTool({
    name: 'site.draft.apply',
    description:
      'Apply an atomic batch up to 32 operations/64 KiB with revision checking. Settings accept owner-supplied shell labels, language and tokens including mono font, motion and layout; sections/blocks accept effects. Supply content only; never code, audience, image bytes, hashes or approvals.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: false,
    order: 7,
    inputSchema: () =>
      z.object({ draftId, requestId, expectedRevision, operations }).strict(),
    handler: ({ principal, sites }, a) => sites!.drafts.apply(principal.id, a),
  }),
  defineTool({
    name: 'site.draft.get',
    description:
      'Compact language/token/effect and missing-input/budget summary. Use detail full, assets, or a page ID for content. Assets paginate with after.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: true,
    recordsSiteFailure: false,
    order: 8,
    inputSchema: () =>
      z
        .object({
          draftId,
          detail: z.string().max(64).optional(),
          after: z.number().int().min(0).optional(),
        })
        .strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.get(principal.id, a.draftId, a.detail, a.after),
  }),
  defineTool({
    name: 'site.draft.discard',
    description:
      'Discard this draft, invalidate snapshots and revoke upload sessions.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: false,
    order: 9,
    inputSchema: () => z.object({ draftId, expectedRevision }).strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.discard(principal.id, a.draftId, a.expectedRevision),
  }),
  defineTool({
    name: 'site.upload.open',
    description:
      'Open one shared agent/human upload session. Agent HTTP + file access requires a tiny probe first; otherwise show the link/QR and wait. Never send bytes through MCP.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: false,
    order: 10,
    inputSchema: () => z.object({ draftId, requestId }).strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.open(principal.id, a.draftId, a.requestId),
  }),
  defineTool({
    name: 'site.upload.status',
    description:
      'Read paginated progress for both upload channels; no capability secrets.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: true,
    recordsSiteFailure: false,
    order: 11,
    inputSchema: () =>
      z
        .object({
          sessionId: z.uuid(),
          after: z.number().int().min(0).optional(),
        })
        .strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.status(principal.id, a.sessionId, a.after),
  }),
  defineTool({
    name: 'site.upload.revoke',
    description: 'Revoke both channels of this upload session.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: false,
    order: 12,
    inputSchema: () => z.object({ sessionId: z.uuid() }).strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.revoke(principal.id, a.sessionId),
  }),
  defineTool({
    name: 'site.preview',
    description:
      'Full verification: queue server-made build, checks and screenshots of this complete revision; required before browser approval. Use site.preview.quick for unverified design/content iteration. Deduplicates identical snapshots. Human approval uses the browser link; never MCP.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: true,
    order: 13,
    inputSchema: () => z.object({ draftId, expectedRevision }).strict(),
    handler: ({ principal, sites }, a) =>
      sites!.drafts.preview(principal.id, a.draftId, a.expectedRevision),
  }),
  defineTool({
    name: 'site.preview.quick',
    description: 'Render this complete draft revision for fast design/content iteration, without hosted verification or AI. Returns verified:false and an ephemeral signed URL. Blockers still block; suggestions do not. Scripts and CMS are off. Separate quota: 60/owner and 300/service per rolling day. Never approvable or deployable; run site.preview before browser approval.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: true,
    order: 13.5,
    inputSchema: () => z.object({ draftId, expectedRevision }).strict(),
    handler: ({ principal, sites }, a) => sites!.drafts.quick.create(principal.id, a.draftId, a.expectedRevision),
  }),
  defineTool({
    name: 'site.status',
    description:
      'Read only your site, hashes, job results, CMS login URL and UTC change allowance.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: true,
    recordsSiteFailure: true,
    order: 14,
    inputSchema: () => z.object({ siteId: z.uuid() }).strict(),
    handler: ({ principal, sites }, args) =>
      sites!.status(principal.id, args.siteId),
  }),
  defineTool({
    name: 'site.deploy',
    description:
      'Deploy your verified build to an isolated client project. Confirmation DEPLOY_SITE:<siteId>, or DEPLOY_SITE:<siteId>:<domain> for an initial custom domain. DNS is never modified. cmsPassword is the initial CMS password; encrypted until delivered to Railway and never logged.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: true,
    order: 15,
    inputSchema: () =>
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
            .optional(),
        })
        .strict(),
    handler: ({ principal, sites }, args) =>
      sites!.deploy(
        principal.id,
        args.siteId,
        args.specId,
        args.cmsPassword,
        args.confirmation,
        args.domain,
      ),
  }),
  defineTool({
    name: 'change.request',
    description:
      'Unavailable: draft-based changes are deferred. CMS content edits remain available. Every request returns change_requests_unavailable.',
    roles: ALL_ROLES,
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: true,
    order: 16,
    inputSchema: () => z.object({}).passthrough(),
    handler: (_context) => {
      throw new SiteError('change_requests_unavailable');
    },
  }),
  defineTool({
    name: 'sites.list',
    description:
      'Superadmin only: list sites by test/live classification, owner or status; bounded cursor pagination.',
    roles: ['superadmin'],
    feature: 'siteWorkflow',
    readOnly: true,
    recordsSiteFailure: false,
    order: 21,
    inputSchema: () =>
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
              'archived',
            ])
            .optional(),
          after: z.uuid().optional(),
          limit: z.number().int().min(1).max(100).default(25),
        })
        .strict(),
    handler: ({ principal, sites }, args) => sites!.list(principal.id, args),
  }),
  defineTool({
    name: 'site.inspect',
    description:
      'Superadmin only: inspect status, deployment, hashes and successful/reserved UTC monthly usage. No credentials or client copy.',
    roles: ['superadmin'],
    feature: 'siteWorkflow',
    readOnly: true,
    recordsSiteFailure: false,
    order: 22,
    inputSchema: () => z.object({ siteId: z.uuid() }).strict(),
    handler: ({ principal, sites }, args) =>
      sites!.inspect(principal.id, args.siteId),
  }),
  defineTool({
    name: 'tester.reset',
    description:
      'Superadmin only: archive a test site and delete its isolated Railway project, PocketBase volume, bucket artifacts and site change history. Requires RESET <siteId>. Busy jobs must finish first; partial cleanup can be retried.',
    roles: ['superadmin'],
    feature: 'siteWorkflow',
    readOnly: false,
    recordsSiteFailure: false,
    order: 23,
    inputSchema: () =>
      z.object({ siteId: z.uuid(), confirmation: z.string().max(42) }).strict(),
    handler: ({ principal, sites }, args) =>
      sites!.reset(principal.id, args.siteId, args.confirmation),
  }),
];
