/**
 * A13 — lease-based distributed emission capacity (split acquire/release)
 *
 * Acquire and release are separate transactions to avoid nested runWithTenant
 * deadlocks. Caller flows issueInvoiceOnce which opens its own transaction.
 */

export async function acquireEmissionLease(
  tenantId: string,
  operationId = 'INVOICE',
  maxSlots = 2,
) {
  const crypto = await import('crypto');
  const { runWithTenant } = await import('./tenant-db');
  return runWithTenant(tenantId, async (tx) => {
    await tx.$executeRaw`
      UPDATE "EmissionLease"
      SET state = 'EXPIRED'
      WHERE "tenantId" = ${tenantId}
        AND state = 'ACTIVE'
        AND "expiresAt" < NOW()`;
    const activeCount = await tx.emissionLease.count({
      where: { tenantId, state: 'ACTIVE', expiresAt: { gt: new Date() } },
    });

    if (activeCount >= maxSlots) return { busy: true as const };
    const processId = `${process.pid}:${crypto.randomBytes(6).toString('hex')}`;
    const created = await tx.$queryRaw<Array<{ id: string; expiresAt: Date }>>`
      INSERT INTO "EmissionLease" (id, "tenantId", "operationId", "processId", state, "acquiredAt", "expiresAt", "lastRenewedAt")
      VALUES (gen_random_uuid()::text, ${tenantId}, ${operationId}, ${processId}, 'ACTIVE', NOW(), NOW() + INTERVAL '60 seconds', NOW())
      RETURNING id, "expiresAt"`;
    const id = created[0]?.id ?? '';
    const expiresAt = created[0]?.expiresAt ?? new Date();
    return { busy: false as const, leaseId: id, expiresAt };
  });
}

export async function releaseEmissionLease(tenantId: string, leaseId: string) {
  const { runWithTenant } = await import('./tenant-db');
  return runWithTenant(tenantId, async (tx) => {
    await tx.$executeRaw`
      UPDATE "EmissionLease"
      SET state = 'RELEASED', "releasedAt" = NOW()
      WHERE "id" = ${leaseId} AND "tenantId" = ${tenantId} AND state = 'ACTIVE'`;
  });
}
