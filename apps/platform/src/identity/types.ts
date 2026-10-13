export type Role = 'superadmin' | 'admin' | 'client' | 'tester';
export interface Principal {
  id: string;
  role: Role;
  testMode: boolean;
}
export class AccessError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
export const ALL_ROLES: readonly Role[] = [
  'superadmin',
  'admin',
  'client',
  'tester',
];
