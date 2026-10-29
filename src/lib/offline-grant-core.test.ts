import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { isOfflineGrantForAccess, signOfflineGrant, verifyOfflineGrant } from './offline-grant-core';

const keys = generateKeyPairSync('ed25519');
const claims = {
  userId: 'user-1', tenantId: 'tenant-1', tenantRole: 'COMPANY_ADMIN' as const,
  sessionVersion: 3, canCreateInvoiceDrafts: true,
  issuedAt: 1_800_000_000, expiresAt: 1_800_000_000 + 60 * 60 * 12,
};

describe('offline authorization grants', () => {
  it('accepts a valid user and tenant scoped signature', () => {
    const token = signOfflineGrant(claims, keys.privateKey);
    expect(verifyOfflineGrant(token, keys.publicKey, claims.issuedAt + 1)).toEqual(claims);
  });

  it('rejects tampering, expiry, invalid roles and grants longer than 12 hours', () => {
    const token = signOfflineGrant(claims, keys.privateKey);
    expect(verifyOfflineGrant(`${token}x`, keys.publicKey, claims.issuedAt + 1)).toBeNull();
    expect(verifyOfflineGrant(token, keys.publicKey, claims.expiresAt)).toBeNull();
    expect(() => signOfflineGrant({ ...claims, tenantRole: 'VIEWER' as any }, keys.privateKey)).toThrow();
    expect(() => signOfflineGrant({ ...claims, expiresAt: claims.issuedAt + 60 * 60 * 13 }, keys.privateKey)).toThrow();
  });

  it('binds synchronization to the same current user, tenant, role and session version', () => {
    const token = signOfflineGrant(claims, keys.privateKey);
    expect(isOfflineGrantForAccess(token, keys.publicKey, claims, claims.issuedAt + 1)).toBe(true);
    expect(isOfflineGrantForAccess(token, keys.publicKey, { ...claims, userId: 'other-user' }, claims.issuedAt + 1)).toBe(false);
    expect(isOfflineGrantForAccess(token, keys.publicKey, { ...claims, tenantId: 'other-tenant' }, claims.issuedAt + 1)).toBe(false);
    expect(isOfflineGrantForAccess(token, keys.publicKey, { ...claims, sessionVersion: 4 }, claims.issuedAt + 1)).toBe(false);
  });
});
