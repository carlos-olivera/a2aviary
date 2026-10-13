import { discoveryTools } from './tool-definitions-discovery.ts';
import { workflowTools } from './tool-definitions-workflow.ts';
import { administrationTools } from './tool-definitions-administration.ts';
import type { ToolDefinition } from './tool-definition.ts';
import type { Role } from './identity/types.ts';

// Registration order matches the original tools/list response.
export const toolRegistry: readonly ToolDefinition[] = [
  ...discoveryTools,
  ...workflowTools,
  ...administrationTools,
].sort((a, b) => a.registrationOrder - b.registrationOrder);
export const toolIndex: Readonly<Record<string, ToolDefinition>> =
  Object.fromEntries(toolRegistry.map((t) => [t.name, t]));
export const toolNames = [...toolRegistry]
  .sort((a, b) => a.capabilityOrder - b.capabilityOrder)
  .map((t) => t.name);
// Retain the old export shape for consumers/tests while eliminating its hand-maintained map.
export const legacyToolRoles = Object.fromEntries(
  toolNames.map((name) => [name, toolIndex[name].roles]),
);

export function availableTools(
  role: Role,
  context: { sites?: unknown; administration?: unknown },
  surface: 'registration' | 'capabilities' = 'registration',
) {
  const tools = toolRegistry.filter((tool) => {
    if (!tool.roles.includes(role)) return false;
    if (surface === 'capabilities' && tool.advertiseWithoutFeature) return true;
    if (tool.feature === 'siteWorkflow' && !context.sites) return false;
    if (tool.feature === 'siteAdministration' && !context.administration)
      return false;
    return !tool.requiresWorkflow || Boolean(context.sites);
  });
  return surface === 'capabilities'
    ? tools.sort((a, b) => a.capabilityOrder - b.capabilityOrder)
    : tools;
}
