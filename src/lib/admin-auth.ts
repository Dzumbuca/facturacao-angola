import 'server-only';
import { auth } from '@/lib/auth';
import { runWithRlsContext } from '@/lib/tenant-db';
import {
  createAuthorizationGuards,
  type AccessUser,
  type TenantWriteOperation,
} from './admin-auth-core';

export { AuthorizationError, createAuthorizationGuards, PLATFORM_PERMISSIONS, getPlatformPermissions, isSuperAdminRole } from './admin-auth-core';
export type { AccessUser, PlatformPermission, TenantWriteOperation } from './admin-auth-core';

const guards = createAuthorizationGuards({
  getSession: () => auth(),
  findUserById: async (id) => {
    // RLS (5437 NOBYPASSRLS): server-controlled authz lookup. Read self user + own tenant
    // status in a single transaction to avoid two sequential DB round-trips through the
    // Supabase transaction pooler (connection_limit=1). User id comes from the
    // authenticated NextAuth session, so isAdmin=true is safe (self-lookup only).
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
        tenant: { select: { status: true } },
      },
    }), { userId: id, tenantId: null, isAdmin: true }) as any;
    if (!user) return null;
    return { ...user, tenant: user.tenant } as AccessUser | null;
  },
});

export const requirePlatformAdmin = guards.requirePlatformAdmin;
export const requirePlatformPermission = guards.requirePlatformPermission;
export const getPlatformMember = guards.getPlatformMember;
export const getTenantAccess = guards.getTenantAccess;
export const assertTenantWriteAllowed = (operation?: TenantWriteOperation) =>
  guards.assertTenantWriteAllowed(operation);
