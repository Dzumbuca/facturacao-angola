const ADMIN_ROLES = new Set(['COMPANY_ADMIN']);
const PLATFORM_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

/** Regra pura de RBAC do núcleo Machine RH (testável sem Next/auth). */
export function isRhRoleAllowed(tenantRole: string, platformRole: string): boolean {
  return ADMIN_ROLES.has(tenantRole) || PLATFORM_ROLES.has(platformRole);
}
