import { McpServer } from '@modelcontextprotocol/server';
import {
  AccessError,
  isAdminTool,
  requireRole,
  type Principal,
  type Store,
} from './identity/store.ts';
import type { Plans } from './plans.ts';
import type { Sites } from './sites/deployments.ts';
import type { SiteAdministration } from './admin/site-administration.ts';
import { SiteError } from '@a2aviary/generator';
import { availableTools } from './tools/tool-registry.ts';

export function createServer(
  principal: Principal,
  store: Store,
  plans: Plans,
  sites?: Sites,
  adminCallsAudited = false,
  administration?: SiteAdministration,
) {
  const server = new McpServer(
    {
      name: sites ? 'a2aviary-platform' : 'a2aviary-discovery',
      version: sites ? '0.2.0' : '0.1.0',
    },
    {
      capabilities: { tools: { listChanged: false } },
      maxToolInputElements: 4096,
    },
  );
  const context = { principal, store, plans, sites, administration };
  for (const definition of availableTools(principal.role, context)) {
    const {
      name,
      description,
      inputSchema,
      handler,
      readOnly,
      recordsSiteFailure,
    } = definition;
    server.registerTool(
      name,
      {
        description,
        inputSchema: inputSchema(context),
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint: !readOnly,
          openWorldHint: false,
        },
      },
      async (args) => {
        const uuid = (value: unknown) =>
          typeof value === 'string' &&
          /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
            value,
          )
            ? value
            : undefined;
        const siteId = uuid((args as { siteId?: unknown }).siteId),
          specId = uuid((args as { specId?: unknown }).specId),
          test = isAdminTool(name)
            ? (args as { test?: boolean }).test
            : undefined;
        try {
          const current = await store.principal(principal.id);
          requireRole(current, name);
          if (!adminCallsAudited || !isAdminTool(name))
            await store.recordToolCall(principal.id, name, siteId, test);
          const result = await handler(context, args);
          if (isAdminTool(name))
            await store.adminResult(
              principal.id,
              name,
              'success',
              siteId,
              test,
            );
          return { content: [{ type: 'text', text: JSON.stringify(result) }] };
        } catch (error) {
          const code =
            error instanceof AccessError || error instanceof SiteError
              ? error.code
              : 'operation_failed';
          if (isAdminTool(name))
            await store.adminResult(principal.id, name, code, siteId, test);
          if (sites && recordsSiteFailure)
            await sites.failure(principal.id, name, specId, code, siteId);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: code,
                  ...(error instanceof SiteError
                    ? { errors: error.errors }
                    : {}),
                }),
              },
            ],
          };
        }
      },
    );
  }
  return server;
}
