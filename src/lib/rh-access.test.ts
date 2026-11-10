import { describe, it, expect } from 'vitest';
import { isRhRoleAllowed } from './rh-policy';

describe('Machine RH - RBAC', () => {
  it('COMPANY_ADMIN tem acesso', () => {
    expect(isRhRoleAllowed('COMPANY_ADMIN', 'NONE')).toBe(true);
  });
  it('USER, VIEWER e BILLING não têm acesso ao núcleo', () => {
    expect(isRhRoleAllowed('USER', 'NONE')).toBe(false);
    expect(isRhRoleAllowed('VIEWER', 'NONE')).toBe(false);
    expect(isRhRoleAllowed('BILLING', 'NONE')).toBe(false);
  });
  it('administrador da plataforma tem acesso', () => {
    expect(isRhRoleAllowed('USER', 'ADMIN')).toBe(true);
    expect(isRhRoleAllowed('USER', 'SUPERADMIN')).toBe(true);
  });
});
