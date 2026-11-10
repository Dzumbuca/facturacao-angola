const ADMIN_ROLES = new Set(['COMPANY_ADMIN']);
const PLATFORM_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

export type RhPermission =
  | 'employees:write'
  | 'attendance:write'
  | 'leaves:write'
  | 'payroll:write'
  | 'documents:write'
  | 'settings:write'
  | 'members:write';

export type RhMemberRole = 'ADMIN' | 'MANAGER' | 'FINANCE';

export const ALL_RH_PERMISSIONS: RhPermission[] = [
  'employees:write', 'attendance:write', 'leaves:write', 'payroll:write', 'documents:write', 'settings:write', 'members:write',
];

/** Regra pura: admin da empresa/plataforma tem acesso total ao RH. */
export function isRhRoleAllowed(tenantRole: string, platformRole: string): boolean {
  return ADMIN_ROLES.has(tenantRole) || PLATFORM_ROLES.has(platformRole);
}

/** Regra pura de permissões por função RH (testável sem Next/auth). */
export function rhPermissionsFor(tenantRole: string, platformRole: string, memberRole: RhMemberRole | null): RhPermission[] {
  if (isRhRoleAllowed(tenantRole, platformRole)) return [...ALL_RH_PERMISSIONS];
  if (!memberRole) return [];
  if (memberRole === 'ADMIN') return [...ALL_RH_PERMISSIONS];
  if (memberRole === 'MANAGER') return ['employees:write', 'attendance:write', 'leaves:write', 'documents:write'];
  if (memberRole === 'FINANCE') return ['payroll:write', 'documents:write'];
  return [];
}

export function hasRhPermission(permissions: RhPermission[], permission: RhPermission): boolean {
  return permissions.includes(permission);
}
