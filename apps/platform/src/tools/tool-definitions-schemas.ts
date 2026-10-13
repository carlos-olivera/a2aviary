import { z } from 'zod';
export const empty = z.object({}).strict();
export const plan = (plans: { id: string; version: string }) =>
  z
    .object({
      planId: z.literal(plans.id),
      policyVersion: z.literal(plans.version),
    })
    .strict();
export const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
export const id = z.object({ siteId: z.uuid() }).strict();
export const period = z.string().regex(/^[0-9]{4}-(?:0[1-9]|1[0-2])$/);
export const draftId = z.uuid(),
  requestId = z.uuid(),
  expectedRevision = z.number().int().min(0);
export const operations = z
  .array(
    z.discriminatedUnion('op', [
      z
        .object({
          op: z.literal('settings'),
          settings: z
            .object({
              tokens: z.unknown().optional(),
              language: z.string().optional(),
              shell: z.unknown().optional(),
              navigation: z.unknown().optional(),
              cms: z.unknown().optional(),
            })
            .strict(),
        })
        .strict(),
      z
        .object({
          op: z.literal('upsert-page'),
          page: z
            .unknown()
            .describe(
              'Page with stable id, path, optional seo and sections; see site schema',
            ),
          index: z.number().int().min(0).optional(),
        })
        .strict(),
      z.object({ op: z.literal('remove-page'), pageId: z.string() }).strict(),
      z
        .object({
          op: z.literal('upsert-section'),
          pageId: z.string(),
          section: z
            .unknown()
            .describe('Section with stable id and optional blocks'),
          index: z.number().int().min(0).optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal('remove-section'),
          pageId: z.string(),
          sectionId: z.string(),
        })
        .strict(),
      z
        .object({
          op: z.literal('upsert-block'),
          pageId: z.string(),
          sectionId: z.string(),
          block: z
            .unknown()
            .describe(
              'Catalog block: id, component, variant, props; see site schema',
            ),
          index: z.number().int().min(0).optional(),
        })
        .strict(),
      z
        .object({
          op: z.literal('remove-block'),
          pageId: z.string(),
          sectionId: z.string(),
          blockId: z.string(),
        })
        .strict(),
      z
        .object({
          op: z.literal('asset-metadata'),
          assetId: z.string(),
          alt: z.string(),
        })
        .strict(),
      z.object({ op: z.literal('remove-asset'), assetId: z.string() }).strict(),
    ]),
  )
  .min(1)
  .max(32);
