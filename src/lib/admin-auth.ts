import 'server-only';
import { auth } from '@/lib/auth';
import { runWithRlsContext } from '@/lib/tenant-db';
import {
  createAuthorizationGuards,
  PLATFORM_PERMISSIONS,
  getPlatformPermissions,
  isSuperAdminRole,
  type AccessUser,
  type PlatformPermission,
  type TenantWriteOperation,
} from './admin-auth-core';

export { AuthorizationError, createAuthorizationGuards, PLATFORM_PERMISSIONS, getPlatformPermissions, isSuperAdminRole } from './admin-auth-core';
export type { AccessUser, PlatformPermission, TenantWriteOperation } from './admin-auth-core';

const guards = createAuthorizationGuards({
  getSession: () => auth(),
  findUserById: async (id) => {
    // RLS (5437 NOBYPASSRLS): server-controlled authz lookup. Read self user in user context;
    // read own tenant status in tenant context only when tenantId is present. No cross-tenant data.
    const user = await runWithRlsContext((tx) => (tx.user as any).findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        tenantId: true,
        platformRole: true,
        platformPermissions: true,
        tenantRole: true,
        status: true,
      },
    }), { userId: id, tenantId: null, isAdmin: false }) as any;
    if (!user) return null;
    let tenant: { status: string } | null = null;
    if (typeof user.tenantId === 'string' && user.tenantId.trim()) {
      tenant = await runWithRlsContext((tx) => (tx.tenant as any).findUnique({
        where: { id: user.tenantId },
        select: { status: true },
      }), { userId: id, tenantId: user.tenantId, isAdmin: false }) as { status: string } | null;
    }
    return { ...user, tenant } as AccessUser | null;
  },
});

export const requirePlatformAdmin = guards.requirePlatformAdmin;
export const requirePlatformPermission = guards.requirePlatformPermission;
export const getPlatformMember = guards.getPlatformMember;
export const getTenantAccess = guards.getTenantAccess;
export const assertTenantWriteAllowed = (operation?: TenantWriteOperation) =>
  guards.assertTenantWriteAllowed(operation);
