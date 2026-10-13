import { toolIndex } from '../tools/tool-registry.ts';
import { AccessError, type Principal } from './types.ts';
export * from './types.ts';
export function isAdminTool(tool: string) {
  const roles = Object.hasOwn(toolIndex, tool)
    ? toolIndex[tool].roles
    : undefined;
  return roles?.length === 1 && roles[0] === 'superadmin';
}
export function requireRole(principal: Principal, tool: string) {
  if (
    !Object.hasOwn(toolIndex, tool) ||
    !toolIndex[tool].roles.includes(principal.role)
  )
    throw new AccessError('forbidden');
}
export function requireConfirmation(value: string, expected: string) {
  if (value !== expected) throw new AccessError('confirmation_required');
}
