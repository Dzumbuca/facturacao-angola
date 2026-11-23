/**
 * A12 — distributed per-tenant emission capacity control
 *
 * Row-based semaphore with atomic acquire/release. Multiple Node processes
 * share this PG row; atomic UPDATE with WHERE inflight < maxSlots caps
 * concurrent emissions. maxSlots intentionally NOT denominator-based — use
 * maxSlots=2, matching A11 in-process semaphore.
 */
import { prisma } from './prisma';
import { runWithTenant } from './tenant-db';

export async function acquireEmissionSlot(tenantId: string, maxSlots = 2, maxWaitMs = 60_000): Promise<{ ok: true; inflight: number } | { ok: false }> {
  const deadline = Date.now() + maxWaitMs;
  let backoff = 5;
  while (Date.now() < deadline) {
    const result = await runWithTenant(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<Array<{ inflight: number }>>`
        INSERT INTO "DistributedSlot" ("tenantId", "inflight", "maxSlots", "updatedAt")
        VALUES (${tenantId}, 1, ${maxSlots}, NOW())
        ON CONFLICT ("tenantId") DO UPDATE
          SET "inflight" = "DistributedSlot"."inflight" + 1, "updatedAt" = NOW()
          WHERE "DistributedSlot"."inflight" < "DistributedSlot"."maxSlots"
        RETURNING "inflight"`;
      if (rows.length === 1 && typeof rows[0].inflight === 'number') {
        return { ok: true as const, inflight: Number(rows[0].inflight) };
      }
      return { ok: false as const };
    });
    if (result.ok) return result;
    await new Promise((r) => setTimeout(r, backoff + Math.random() * 10));
    backoff = Math.min(backoff * 2, 100);
  }
  return { ok: false };
}

export async function releaseEmissionSlot(tenantId: string): Promise<void> {
  await runWithTenant(tenantId, async (tx) => {
    await tx.$executeRaw`
      UPDATE "DistributedSlot"
      SET "inflight" = GREATEST(0, "inflight" - 1), "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}`;
  });
}
export const currentEmissionInflight = async (tenantId: string): Promise<number> => {
  const r = await prisma.distributedSlot.findUnique({ where: { tenantId }, select: { inflight: true } });
  return r?.inflight ?? 0;
};
