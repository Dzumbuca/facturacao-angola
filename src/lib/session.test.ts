import { describe, expect, it } from 'vitest';
import { getSessionTenantId, getSessionUserId } from './session';

describe('getSessionTenantId', () => {
  it('returns the authenticated user tenant id', () => {
    expect(getSessionTenantId({ user: { tenantId: 'tenant-1' } })).toBe('tenant-1');
  });

  it('rejects missing or empty tenant ids', () => {
    expect(getSessionTenantId(null)).toBeNull();
    expect(getSessionTenantId({ user: {} })).toBeNull();
    expect(getSessionTenantId({ user: { tenantId: '' } })).toBeNull();
  });
});

describe('getSessionUserId', () => {
  it('returns the authenticated id for platform-only and tenant users', () => {
    expect(getSessionUserId({ user: { id: 'user-1' } })).toBe('user-1');
    expect(getSessionUserId({ user: { id: 'platform-1', tenantId: null } })).toBe('platform-1');
  });

  it('rejects a missing id', () => {
    expect(getSessionUserId(null)).toBeNull();
    expect(getSessionUserId({ user: { id: '' } })).toBeNull();
  });
});
