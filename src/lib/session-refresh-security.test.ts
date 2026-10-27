import { describe, expect, it } from 'vitest';
import { canRefreshAuthSession } from './session-refresh-security';

describe('session refresh authorization', () => {
  it('accepts an active user only when the signed token version is current', () => {
    expect(canRefreshAuthSession(
      { sessionVersion: 4 },
      { status: 'ACTIVE', sessionVersion: 4, emailVerified: new Date(), emailVerificationRequired: true },
    )).toBe(true);
  });

  it('rejects tokens revoked by password reset or account status changes', () => {
    expect(canRefreshAuthSession(
      { sessionVersion: 3 },
      { status: 'ACTIVE', sessionVersion: 4, emailVerified: new Date(), emailVerificationRequired: false },
    )).toBe(false);
  });

  it('rejects missing session versions, inactive users, and unverified accounts', () => {
    const active = { status: 'ACTIVE', sessionVersion: 4, emailVerified: new Date(), emailVerificationRequired: false };
    expect(canRefreshAuthSession({}, active)).toBe(false);
    expect(canRefreshAuthSession({ sessionVersion: 4 }, { ...active, status: 'SUSPENDED' })).toBe(false);
    expect(canRefreshAuthSession({ sessionVersion: 4 }, { ...active, emailVerified: null, emailVerificationRequired: true })).toBe(false);
  });
});
