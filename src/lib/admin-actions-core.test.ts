import { describe, expect, it } from 'vitest';
import { isLastActivePlatformAdminChange, validateAdminReason } from './admin-actions-core';

describe('administrative mutation safeguards', () => {
  it('blocks suspending or demoting the last active platform admin', () => {
    expect(isLastActivePlatformAdminChange({ currentRole: 'ADMIN', currentStatus: 'ACTIVE', nextRole: 'ADMIN', nextStatus: 'SUSPENDED', activeAdminCount: 1 })).toBe(true);
    expect(isLastActivePlatformAdminChange({ currentRole: 'ADMIN', currentStatus: 'ACTIVE', nextRole: 'NONE', nextStatus: 'ACTIVE', activeAdminCount: 1 })).toBe(true);
  });

  it('allows the change when another active platform admin remains', () => {
    expect(isLastActivePlatformAdminChange({ currentRole: 'ADMIN', currentStatus: 'ACTIVE', nextRole: 'NONE', nextStatus: 'ACTIVE', activeAdminCount: 2 })).toBe(false);
  });

  it('protects the last SUPERADMIN while preserving the legacy ADMIN alias', () => {
    expect(isLastActivePlatformAdminChange({ currentRole: 'SUPERADMIN', currentStatus: 'ACTIVE', nextRole: 'NONE', nextStatus: 'ACTIVE', activeAdminCount: 1 })).toBe(true);
    expect(isLastActivePlatformAdminChange({ currentRole: 'ADMIN', currentStatus: 'ACTIVE', nextRole: 'SUPERADMIN', nextStatus: 'ACTIVE', activeAdminCount: 1 })).toBe(false);
  });

  it('requires a concise reason with safe length bounds', () => {
    expect(validateAdminReason('  Revisão de suporte  ')).toBe('Revisão de suporte');
    expect(validateAdminReason(' ')).toBeNull();
    expect(validateAdminReason('x'.repeat(501))).toBeNull();
  });
});
