import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server';
import type { z } from 'zod';
import type { Principal, Role } from './identity/types.ts';
import type { Store } from './identity/store.ts';
import type { Sites } from './sites/deployments.ts';
import type { SiteAdministration } from './admin/site-administration.ts';
import type { Plans } from './plans.ts';

export interface ToolContext {
  principal: Principal;
  store: Store;
  plans: Plans;
  sites?: Sites;
  administration?: SiteAdministration;
}
export interface ToolDefinition {
  name: string;
  description: string;
  roles: readonly Role[];
  feature: 'discovery' | 'siteWorkflow' | 'siteAdministration';
  readOnly: boolean;
  recordsSiteFailure: boolean;
  // Preserve the two existing observable orders independently.
  capabilityOrder: number;
  registrationOrder: number;
  requiresWorkflow?: boolean;
  advertiseWithoutFeature?: boolean;
  inputSchema: (context: ToolContext) => StandardSchemaWithJSON;
  handler: (context: ToolContext, args: unknown) => unknown;
}

// Check each schema/handler pair before erasing its argument type for iteration.
export function defineTool<T extends z.ZodObject & StandardSchemaWithJSON>(
  definition: Omit<ToolDefinition, 'inputSchema' | 'handler'> & {
    inputSchema: (context: ToolContext) => T;
    handler: (context: ToolContext, args: z.infer<T>) => unknown;
  },
): ToolDefinition {
  return {
    ...definition,
    handler: (context, args) => definition.handler(context, args as z.infer<T>),
  };
}
