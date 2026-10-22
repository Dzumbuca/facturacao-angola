import { describe, expect, it } from 'vitest';
import { createAuthorizationGuards, type AccessUser } from './admin-auth-core';
import { createTenantApiAccess } from './tenant-api-access-core';

const account = (overrides: Partial<AccessUser> = {}): AccessUser => ({
  id: 'user-123',
  name: null,
  email: null,
  tenantId: 'tenant-123',
  platformRole: 'NONE',
  tenantRole: 'USER',
  status: 'ACTIVE',
  tenant: { status: 'ACTIVE' },
  ...overrides,
});

const apiFor = (user: AccessUser | null) => {
  const guards = createAuthorizationGuards({
    getSession: async () => user ? { user: { id: user.id } } : null,
    findUserById: async () => user,
  });
  return createTenantApiAccess({ getTenantAccess: guards.getTenantAccess, assertTenantWriteAllowed: guards.assertTenantWriteAllowed });
};

describe('tenant API access responses', () => {
  it('returns 401 for a missing session and generic 403 for a suspended user', async () => {
    await expect(apiFor(null).read()).resolves.toMatchObject({ ok: false, status: 401 });
    await expect(apiFor(account({ status: 'SUSPENDED' })).write()).resolves.toMatchObject({ ok: false, status: 403, body: { error: 'Acesso negado' } });
  });

  it('allows reads and export routes when the tenant is suspended', async () => {
    await expect(apiFor(account({ tenant: { status: 'SUSPENDED' } })).read()).resolves.toMatchObject({ ok: true, access: { tenantId: 'tenant-123' } });
  });

  it('blocks writes when the tenant is suspended or the user is read-only', async () => {
    await expect(apiFor(account({ tenant: { status: 'SUSPENDED' } })).write()).resolves.toMatchObject({ ok: false, status: 403 });
    await expect(apiFor(account({ tenantRole: 'VIEWER' })).write()).resolves.toMatchObject({ ok: false, status: 403 });
  });

  it('allows a billing write for an active tenant member', async () => {
    await expect(apiFor(account()).write()).resolves.toMatchObject({ ok: true, access: { tenantId: 'tenant-123' } });
  });

  it('fails closed with a generic service error when authorization storage is unavailable', async () => {
    const api = createTenantApiAccess({
      getTenantAccess: async () => { throw new Error('database password must not be returned'); },
      assertTenantWriteAllowed: async () => { throw new Error('database password must not be returned'); },
    });
    await expect(api.read()).resolves.toEqual({ ok: false, status: 503, body: { error: 'Não foi possível validar o acesso' } });
  });
});
