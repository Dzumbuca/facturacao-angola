/**
 * A12 — distributed per-tenant emission capacity control
 *
 * Semaphore implemented in PostgreSQL, not process memory. Multiple Node
 * processes can use the same atomic pattern to bound concurrent FT issuance
 * per tenant to maxSlots (default 2).
 *
 * Algorithm:
 *   acquire → INSERT … ON CONFLICT … WHERE inflight < maxSlots RETURNING …
 *   release → UPDATE … SET inflight = GREATEST(0, inflight − 1)
 *
 * If a process dies while holding a slot, inflight stays elevated until
 * the row's `updatedAt` is inspected/reaped. A reconciler is out of scope
 * for this phase; document the limitation honestly.
 *
 * No new external service (Redis/Rabbit) required — only PG.
 */

import { prisma } from './prisma';
import { runWithTenant } from './tenant-db';

export type AcquireResult = { ok: true; inflight: number } | { ok: false };

export async function acquireEmissionSlot(tenantId: string, maxSlots = 2): Promise<AcquireResult> {
  return runWithTenant(tenantId, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ inflight: number }>>`
      INSERT INTO "DistributedSlot" ("tenantId", "inflight", "maxSlots", "updatedAt")
      VALUES (${tenantId}, 1, ${maxSlots}, NOW())
      ON CONFLICT ("tenantId") DO UPDATE
        SET "inflight" = "DistributedSlot"."inflight" + 1,
            "updatedAt" = NOW()
        WHERE "DistributedSlot"."inflight" < "DistributedSlot"."maxSlots"
      RETURNING "inflight"`;
    if (rows.length === 1 && typeof rows[0].inflight === 'number') {
      return { ok: true as const, inflight: Number(rows[0].inflight) } as AcquireResult;
    }
    return { ok: false as const } as AcquireResult;
  });
}

export async function releaseEmissionSlot(tenantId: string): Promise<void> {
  await runWithTenant(tenantId, async (tx) => {
    await tx.$executeRaw`
      UPDATE "DistributedSlot"
      SET "inflight" = GREATEST(0, "inflight" - 1),
          "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId}`;
  });
}

export async function currentEmissionInflight(tenantId: string): Promise<number> {
  const row = await prisma.distributedSlot.findUnique({ where: { tenantId }, select: { inflight: true } });
  return row?.inflight ?? 0;
}
