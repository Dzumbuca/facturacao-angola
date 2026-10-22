import 'server-only';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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
    const user = await (prisma.user as any).findUnique({
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
    });
    return user as AccessUser | null;
  },
});

export const requirePlatformAdmin = guards.requirePlatformAdmin;
export const requirePlatformPermission = guards.requirePlatformPermission;
export const getPlatformMember = guards.getPlatformMember;
export const getTenantAccess = guards.getTenantAccess;
export const assertTenantWriteAllowed = (operation?: TenantWriteOperation) =>
  guards.assertTenantWriteAllowed(operation);
