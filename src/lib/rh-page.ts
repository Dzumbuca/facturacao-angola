import 'server-only';
import { redirect } from 'next/navigation';
import { requireRhAccess, RhAccessError } from './rh-access';
import type { RhPermission } from './rh-policy';

/** Acesso a páginas RH: em vez de 401, manda para login/apps. */
export async function requireRhPage(permission?: RhPermission) {
  try {
    return await requireRhAccess(permission);
  } catch (error) {
    if (error instanceof RhAccessError) {
      if (error.code === 'UNAUTHENTICATED') redirect('/login?callbackUrl=/rh/dashboard');
      if (error.code === 'APP_NOT_ENABLED') redirect('/apps?rh=bloqueado');
      redirect('/apps?rh=sem-permissao');
    }
    throw error;
  }
}
