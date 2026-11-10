import { describe, it, expect } from 'vitest';
import { isRhRoleAllowed, rhPermissionsFor, hasRhPermission } from './rh-policy';

describe('Machine RH - RBAC', () => {
  it('COMPANY_ADMIN tem acesso', () => {
    expect(isRhRoleAllowed('COMPANY_ADMIN', 'NONE')).toBe(true);
  });
  it('USER, VIEWER e BILLING não têm acesso directo ao núcleo', () => {
    expect(isRhRoleAllowed('USER', 'NONE')).toBe(false);
    expect(isRhRoleAllowed('VIEWER', 'NONE')).toBe(false);
    expect(isRhRoleAllowed('BILLING', 'NONE')).toBe(false);
  });
  it('administrador da plataforma tem acesso', () => {
    expect(isRhRoleAllowed('USER', 'ADMIN')).toBe(true);
    expect(isRhRoleAllowed('USER', 'SUPERADMIN')).toBe(true);
  });
  it('gestor tem escrita de pessoas mas não de payroll', () => {
    const permissions = rhPermissionsFor('VIEWER', 'NONE', 'MANAGER');
    expect(hasRhPermission(permissions, 'employees:write')).toBe(true);
    expect(hasRhPermission(permissions, 'leaves:write')).toBe(true);
    expect(hasRhPermission(permissions, 'payroll:write')).toBe(false);
    expect(hasRhPermission(permissions, 'members:write')).toBe(false);
  });
  it('financeiro escreve payroll mas não pessoas', () => {
    const permissions = rhPermissionsFor('VIEWER', 'NONE', 'FINANCE');
    expect(hasRhPermission(permissions, 'payroll:write')).toBe(true);
    expect(hasRhPermission(permissions, 'employees:write')).toBe(false);
  });
  it('sem função RH não há permissões', () => {
    expect(rhPermissionsFor('VIEWER', 'NONE', null)).toEqual([]);
  });
});
