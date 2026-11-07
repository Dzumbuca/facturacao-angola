import 'server-only';
import { prisma } from '@/lib/prisma';

export type TenantContext = {
  userId?: string | null;
};

export type RlsContext = {
  tenantId?: string | null;
  userId?: string | null;
  isAdmin?: boolean;
};

// Internal marker for privileged RLS executors. Server-only module + symbol reduces accidental use;
// callers remain responsible for performing authorization before invoking admin/system executors.
export const PRIVILEGED_RLS: unique symbol = Symbol('PRIVILEGED_RLS');
export type PrivilegedRlsAuthz = typeof PRIVILEGED_RLS;

function assertPrivileged(authz: unknown, name: string): asserts authz is PrivilegedRlsAuthz {
  if (authz !== PRIVILEGED_RLS) {
    throw new Error(`${name}: privileged RLS authorization required`);
  }
}

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
  // Never accept admin escalation from tenant-scoped business callers.
  return runWithRlsContext(fn, { tenantId, userId: context?.userId ?? null, isAdmin: false });
}

/** Admin executor: cross-tenant/platform operations only. Caller must be server-authorized. */
export async function runAsAdmin<T>(
  fn: (tx: any) => Promise<T>,
  context: { userId?: string | null; tenantId?: string | null },
  authz: PrivilegedRlsAuthz,
): Promise<T> {
  assertPrivileged(authz, 'runAsAdmin');
  return runWithRlsContext(fn, { isAdmin: true, userId: context?.userId ?? null, tenantId: context?.tenantId ?? null });
}

/** Narrow system executor for RLS-admin-only infrastructure tables. Caller must be server-authorized. */
export async function runAsSystem<T>(fn: (tx: any) => Promise<T>, authz: PrivilegedRlsAuthz): Promise<T> {
  assertPrivileged(authz, 'runAsSystem');
  return runWithRlsContext(fn, { isAdmin: true, userId: null, tenantId: null });
}

/** Auth/bootstrap executor: no tenant, no admin. */
export async function runAsAuth<T>(fn: (tx: any) => Promise<T>, context?: { userId?: string | null }): Promise<T> {
  return runWithRlsContext(fn, { isAdmin: false, userId: context?.userId ?? null, tenantId: null });
}
