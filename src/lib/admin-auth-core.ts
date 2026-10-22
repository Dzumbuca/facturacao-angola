export type PlatformRoleValue = 'NONE' | 'ADMIN' | 'SUPERADMIN' | 'COMPANY_MANAGER' | 'USER_MANAGER' | 'DOCUMENT_MANAGER' | 'AUDITOR' | 'SUPPORT';
export type TenantRoleValue = 'USER' | 'COMPANY_ADMIN' | 'BILLING' | 'VIEWER';
export type AccountStatusValue = 'ACTIVE' | 'SUSPENDED';
export type TenantWriteOperation = 'billing' | 'company_settings';
export const PLATFORM_PERMISSIONS = [
  'dashboard.read', 'companies.read', 'companies.create', 'companies.update', 'companies.suspend',
  'users.read', 'users.update_role', 'users.suspend', 'team.read', 'team.invite', 'team.update_role',
  'team.suspend', 'team.superadmin', 'documents.read', 'audit.read', 'settings.read', 'settings.update',
  'system.read', 'support.read', 'emails.read', 'emails.manage',
] as const;
export type PlatformPermission = typeof PLATFORM_PERMISSIONS[number];

const allPermissions: readonly PlatformPermission[] = PLATFORM_PERMISSIONS;
const defaultPermissions: Record<PlatformRoleValue, readonly PlatformPermission[]> = {
  NONE: [],
  ADMIN: allPermissions,
  SUPERADMIN: allPermissions,
  COMPANY_MANAGER: ['companies.read'],
  USER_MANAGER: ['users.read', 'users.update_role', 'users.suspend'],
  DOCUMENT_MANAGER: ['documents.read'],
  AUDITOR: ['audit.read'],
  SUPPORT: ['support.read', 'system.read'],
};
const additionalPermissions: Partial<Record<PlatformRoleValue, readonly PlatformPermission[]>> = {
  COMPANY_MANAGER: ['companies.create', 'companies.update', 'companies.suspend'],
  USER_MANAGER: ['users.update_role', 'users.suspend'],
};

export function getPlatformPermissions(role: PlatformRoleValue, grants: readonly string[] = []): Set<PlatformPermission> {
  const allowedExtras = additionalPermissions[role] ?? [];
  const validGrants = grants.filter((permission): permission is PlatformPermission =>
    allowedExtras.includes(permission as PlatformPermission));
  return new Set([...defaultPermissions[role], ...validGrants]);
}

export const isSuperAdminRole = (role: PlatformRoleValue) => role === 'ADMIN' || role === 'SUPERADMIN';

export type AccessUser = {
  id: string;
  name: string | null;
  email: string | null;
  tenantId: string | null;
  platformRole: PlatformRoleValue;
  platformPermissions?: string[];
  tenantRole: TenantRoleValue;
  status: AccountStatusValue;
  tenant: { status: AccountStatusValue } | null;
};

type SessionWithUserId = { user?: { id?: unknown } } | null;
type AccessDependencies = {
  getSession: () => Promise<SessionWithUserId>;
  findUserById: (id: string) => Promise<AccessUser | null>;
};

export class AuthorizationError extends Error {
  constructor(readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'TENANT_SUSPENDED') {
    super(code === 'UNAUTHENTICATED' ? 'Authentication required' : 'Access denied');
    this.name = 'AuthorizationError';
  }
}

export function createAuthorizationGuards(dependencies: AccessDependencies) {
  async function getCurrentUser() {
    const session = await dependencies.getSession();
    const id = typeof session?.user?.id === 'string' ? session.user.id : '';
    if (!id) throw new AuthorizationError('UNAUTHENTICATED');
    const user = await dependencies.findUserById(id);
    if (!user || user.status !== 'ACTIVE') throw new AuthorizationError('FORBIDDEN');
    return user;
  }

  async function requirePlatformAdmin() {
    const user = await getCurrentUser();
    if (!isSuperAdminRole(user.platformRole)) throw new AuthorizationError('FORBIDDEN');
    return { id: user.id, name: user.name, email: user.email };
  }

  async function getPlatformMember() {
    const user = await getCurrentUser();
    if (user.platformRole === 'NONE') throw new AuthorizationError('FORBIDDEN');
    return {
      id: user.id, name: user.name, email: user.email, platformRole: user.platformRole,
      permissions: [...getPlatformPermissions(user.platformRole, user.platformPermissions)],
    };
  }

  async function requirePlatformPermission(permission: PlatformPermission) {
    const user = await getCurrentUser();
    if (!PLATFORM_PERMISSIONS.includes(permission) || !getPlatformPermissions(user.platformRole, user.platformPermissions).has(permission)) {
      throw new AuthorizationError('FORBIDDEN');
    }
    return { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, platformRole: user.platformRole };
  }

  async function getTenantAccess() {
    const user = await getCurrentUser();
    if (!user.tenantId || !user.tenant) throw new AuthorizationError('FORBIDDEN');
    return {
      userId: user.id,
      tenantId: user.tenantId,
      platformRole: user.platformRole,
      platformPermissions: user.platformPermissions ?? [],
      tenantRole: user.tenantRole,
      tenantStatus: user.tenant.status,
    };
  }

  async function assertTenantWriteAllowed(operation: TenantWriteOperation = 'billing') {
    const access = await getTenantAccess();
    if (access.tenantStatus !== 'ACTIVE') throw new AuthorizationError('TENANT_SUSPENDED');
    if (access.tenantRole === 'VIEWER') throw new AuthorizationError('FORBIDDEN');
    if (operation === 'company_settings' && access.tenantRole !== 'COMPANY_ADMIN') {
      throw new AuthorizationError('FORBIDDEN');
    }
    return access;
  }

  return { requirePlatformAdmin, requirePlatformPermission, getPlatformMember, getTenantAccess, assertTenantWriteAllowed };
}
