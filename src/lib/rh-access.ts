import 'server-only';
import { getTenantAccess, AuthorizationError } from './admin-auth';
import { isApplicationEnabled } from './platform-apps';
import { auth } from './auth';
import { getSessionTenantId, getSessionUserId } from './session';
import { isRhRoleAllowed } from './rh-policy';

export type RhAccess = {
  tenantId: string;
  userId: string;
  tenantRole: string;
  platformRole: string;
};

export class RhAccessError extends Error {
  constructor(public status: 401 | 403, public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'APP_NOT_ENABLED', message: string) {
    super(message);
  }
}


/**
 * Autorização server-side da Machine RH: sessão + empresa + role + módulo.
 * Toda a API e página do RH passa por aqui (não confiar na UI).
 */
export async function requireRhAccess(): Promise<RhAccess> {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) throw new RhAccessError(401, 'UNAUTHENTICATED', 'Sessão inválida.');

  let tenantRole = '';
  let platformRole = '';
  try {
    const access = await getTenantAccess();
    tenantRole = access.tenantRole;
    platformRole = access.platformRole;
  } catch (error) {
    if (error instanceof AuthorizationError) throw new RhAccessError(403, 'FORBIDDEN', 'Sem acesso à empresa.');
    throw error;
  }

  if (!isRhRoleAllowed(tenantRole, platformRole)) {
    throw new RhAccessError(403, 'FORBIDDEN', 'O seu perfil não tem acesso ao módulo de RH.');
  }

  if (!(await isApplicationEnabled(tenantId, 'rh'))) {
    throw new RhAccessError(403, 'APP_NOT_ENABLED', 'O módulo Machine RH não está activo para esta empresa.');
  }

  return { tenantId, userId, tenantRole, platformRole };
}

export function rhAccessResponse(error: unknown): { status: number; body: { code: string; error: string } } {
  if (error instanceof RhAccessError) {
    return { status: error.status, body: { code: error.code, error: error.message } };
  }
  return { status: 500, body: { code: 'INTERNAL', error: 'Erro interno.' } };
}
