import { describe, expect, it } from 'vitest';
import { isAdminPagePath, isProtectedPagePath } from './route-access';

describe('protected dashboard paths', () => {
  it('matches public URLs generated from the dashboard route group', () => {
    expect(isProtectedPagePath('/')).toBe(true);
    expect(isProtectedPagePath('/customers')).toBe(true);
    expect(isProtectedPagePath('/invoices/new')).toBe(true);
    expect(isProtectedPagePath('/documentos')).toBe(true);
    expect(isProtectedPagePath('/documentos/novo')).toBe(true);
    expect(isProtectedPagePath('/documentos/doc-1')).toBe(true);
    expect(isProtectedPagePath('/documentos/doc-1/editar')).toBe(true);
    expect(isProtectedPagePath('/pagamento')).toBe(true);
  });

  it('keeps the public tools centre and marketing pages outside the dashboard', () => {
    expect(isProtectedPagePath('/ferramentas')).toBe(false);
    expect(isProtectedPagePath('/ferramentas/iva')).toBe(false);
    expect(isProtectedPagePath('/inicio')).toBe(false);
  });

  it('does not treat auth APIs or unrelated static pages as dashboard pages', () => {
    expect(isProtectedPagePath('/api/auth/signin')).toBe(false);
    expect(isProtectedPagePath('/about')).toBe(false);
  });

  it('recognizes the complete administrative route area separately', () => {
    expect(isAdminPagePath('/admin')).toBe(true);
    expect(isAdminPagePath('/admin/empresas/tenant-1')).toBe(true);
    expect(isAdminPagePath('/administer')).toBe(false);
  });
});
