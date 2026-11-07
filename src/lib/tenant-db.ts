import { prisma } from '@/lib/prisma';

export type TenantContext = {
  userId?: string | null;
  isAdmin?: boolean;
};

export type RlsContext = {
  tenantId?: string | null;
  userId?: string | null;
  isAdmin?: boolean;
};

async function applyRlsContext(tx: any, context: RlsContext) {
  const tenantId = typeof context.tenantId === 'string' ? context.tenantId.trim() : '';
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
  await tx.$executeRaw`SELECT set_config('app.user_id', ${context.userId ?? ''}, true)`;
  await tx.$executeRaw`SELECT set_config('app.is_admin', ${context.isAdmin === true ? 'true' : 'false'}, true)`;
}

export async function runWithRlsContext<T>(fn: (tx: any) => Promise<T>, context: RlsContext): Promise<T> {
  return prisma.$transaction(async (tx: any) => {
    await applyRlsContext(tx, context);
    return fn(tx);
  });
}

export async function runWithTenant<T>(
  tenantId: string,
  fn: (tx: any) => Promise<T>,
  context?: TenantContext,
): Promise<T> {
  if (!tenantId || typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new Error('runWithTenant: tenantId is required');
  }
  return runWithRlsContext(fn, { tenantId, userId: context?.userId ?? null, isAdmin: context?.isAdmin === true });
}

/** Admin executor: cross-tenant/platform operations only. Caller must be server-authorized (DB/session/secret). */
export async function runAsAdmin<T>(fn: (tx: any) => Promise<T>, context?: { userId?: string | null; tenantId?: string | null }): Promise<T> {
  return runWithRlsContext(fn, { isAdmin: true, userId: context?.userId ?? null, tenantId: context?.tenantId ?? null });
}

/** Auth/bootstrap executor: no tenant, no admin. Used for identity flows where adapter/auth tables are RLS-off prototype or policies allow self access. */
export async function runAsAuth<T>(fn: (tx: any) => Promise<T>, context?: { userId?: string | null }): Promise<T> {
  return runWithRlsContext(fn, { isAdmin: false, userId: context?.userId ?? null, tenantId: null });
}

/** Narrow system executor for RLS-admin-only infrastructure tables (e.g. rate limits). Keep transaction scope minimal. */
export async function runAsSystem<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  return runWithRlsContext(fn, { isAdmin: true, userId: null, tenantId: null });
}
