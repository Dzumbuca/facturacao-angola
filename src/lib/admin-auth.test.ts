import { describe, expect, it } from 'vitest';
import { createAuthorizationGuards, AuthorizationError, getPlatformPermissions, isSuperAdminRole, type AccessUser } from './admin-auth-core';

const user = (overrides: Partial<AccessUser> = {}): AccessUser => ({
  id: 'user-1',
  name: 'Ana',
  email: 'ana@example.test',
  tenantId: 'tenant-1',
  platformRole: 'NONE',
  tenantRole: 'USER',
  status: 'ACTIVE',
  tenant: { status: 'ACTIVE' },
  ...overrides,
});

function guards(currentUser: AccessUser | null, sessionId = 'user-1') {
  return createAuthorizationGuards({
    getSession: async () => sessionId ? { user: { id: sessionId, platformRole: 'ADMIN' } } : null,
    findUserById: async (id) => id === currentUser?.id ? currentUser : null,
  });
}

describe('server authorization guards', () => {
  it('denies unauthenticated requests', async () => {
    await expect(guards(user(), '').requirePlatformAdmin()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('uses the current database role instead of a stale admin role in the token', async () => {
    await expect(guards(user({ platformRole: 'NONE' })).requirePlatformAdmin()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('enforces platform permissions from the current database role', async () => {
    const companyManager = guards(user({ platformRole: 'COMPANY_MANAGER' as any }));
    await expect((companyManager as any).requirePlatformPermission('companies.read')).resolves.toMatchObject({ id: 'user-1' });
    await expect((companyManager as any).requirePlatformPermission('settings.update')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not treat company administrators as platform administrators', async () => {
    const companyAdmin = guards(user({ platformRole: 'NONE', tenantRole: 'COMPANY_ADMIN' }));
    await expect((companyAdmin as any).requirePlatformPermission('companies.read')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps role grants inside each role ceiling and preserves legacy ADMIN access', () => {
    expect([...getPlatformPermissions('USER_MANAGER', ['team.superadmin', 'users.suspend'])]).toEqual(['users.read', 'users.update_role', 'users.suspend']);
    expect(isSuperAdminRole('ADMIN')).toBe(true);
    expect(isSuperAdminRole('SUPERADMIN')).toBe(true);
    expect(isSuperAdminRole('COMPANY_MANAGER')).toBe(false);
  });

  it('allows only an active platform administrator even without a tenant', async () => {
    const access = await guards(user({ platformRole: 'ADMIN', tenantId: null, tenant: null })).requirePlatformAdmin();
    expect(access.id).toBe('user-1');
  });

  it('permits active-user reads from a suspended tenant but blocks writes', async () => {
    const access = guards(user({ tenant: { status: 'SUSPENDED' } }));
    await expect(access.getTenantAccess()).resolves.toMatchObject({ tenantStatus: 'SUSPENDED' });
    await expect(access.assertTenantWriteAllowed()).rejects.toMatchObject({ code: 'TENANT_SUSPENDED' });
  });

  it('returns the current platform role for navigation without trusting the session token', async () => {
    await expect(guards(user({ platformRole: 'ADMIN' })).getTenantAccess()).resolves.toMatchObject({ platformRole: 'ADMIN' });
    await expect(guards(user({ platformRole: 'NONE' })).getTenantAccess()).resolves.toMatchObject({ platformRole: 'NONE' });
  });

  it('blocks all tenant access for a suspended user', async () => {
    await expect(guards(user({ status: 'SUSPENDED' })).getTenantAccess()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows writes for an active user in an active tenant', async () => {
    await expect(guards(user()).assertTenantWriteAllowed()).resolves.toMatchObject({ tenantId: 'tenant-1' });
  });

  it('keeps viewers read-only and reserves company settings for company admins', async () => {
    await expect(guards(user({ tenantRole: 'VIEWER' })).assertTenantWriteAllowed()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(guards(user({ tenantRole: 'BILLING' })).assertTenantWriteAllowed('company_settings')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(guards(user({ tenantRole: 'COMPANY_ADMIN' })).assertTenantWriteAllowed('company_settings')).resolves.toMatchObject({ tenantId: 'tenant-1' });
  });
});
