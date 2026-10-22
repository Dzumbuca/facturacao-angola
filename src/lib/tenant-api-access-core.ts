import { AuthorizationError } from './admin-auth-core';
import type { TenantWriteOperation } from './admin-auth-core';

export type TenantAccess = {
  userId: string;
  tenantId: string;
  tenantRole: 'USER' | 'COMPANY_ADMIN' | 'BILLING' | 'VIEWER';
  tenantStatus: 'ACTIVE' | 'SUSPENDED';
};

export type TenantApiAccessResult =
  | { ok: true; access: TenantAccess }
  | { ok: false; status: 401 | 403 | 503; body: { error: string } };

type TenantApiAccessDependencies = {
  getTenantAccess: () => Promise<TenantAccess>;
  assertTenantWriteAllowed: (operation?: TenantWriteOperation) => Promise<TenantAccess>;
};

export function createTenantApiAccess(dependencies: TenantApiAccessDependencies) {
  async function run(operation: 'read' | 'write', writeType?: TenantWriteOperation): Promise<TenantApiAccessResult> {
    try {
      const access = operation === 'read'
        ? await dependencies.getTenantAccess()
        : await dependencies.assertTenantWriteAllowed(writeType);
      return { ok: true, access };
    } catch (error) {
      if (!(error instanceof AuthorizationError)) {
        return { ok: false, status: 503, body: { error: 'Não foi possível validar o acesso' } };
      }
      if (error.code === 'UNAUTHENTICATED') return { ok: false, status: 401, body: { error: 'Não autenticado' } };
      return { ok: false, status: 403, body: { error: 'Acesso negado' } };
    }
  }

  return {
    read: () => run('read'),
    write: (writeType?: TenantWriteOperation) => run('write', writeType),
  };
}
