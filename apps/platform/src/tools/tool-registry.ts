import { discoveryTools } from './tool-definitions-discovery.ts';
import { workflowTools } from './tool-definitions-workflow.ts';
import { administrationTools } from './tool-definitions-administration.ts';
import type { ToolDefinition } from './tool-definition.ts';
import type { Role } from '../identity/types.ts';

// Preserve tools/list order; all discovery surfaces share this same registry.
export const toolRegistry: readonly ToolDefinition[] = [
  ...discoveryTools,
  ...workflowTools,
  ...administrationTools,
].sort((a, b) => a.order - b.order);
export const toolIndex: Readonly<Record<string, ToolDefinition>> =
  Object.fromEntries(toolRegistry.map((t) => [t.name, t]));
export const toolNames = toolRegistry.map((t) => t.name);
export function availableTools(
  role: Role,
  context: { sites?: unknown; administration?: unknown },
) {
  const tools = toolRegistry.filter((tool) => {
    if (!tool.roles.includes(role)) return false;
    if (tool.feature === 'siteWorkflow' && !context.sites) return false;
    if (tool.feature === 'siteAdministration' && !context.administration)
      return false;
    return !tool.requiresWorkflow || Boolean(context.sites);
  });
  return tools;
}
