/**
 * A14 — split acquire/execute/release emission capacity
 *
 * Architecture: acquire, run business work, release — as three separate transactions.
 * This avoids holding a row lock while waiting for chain lock + inner GL transaction;
 * that pattern produced P2010 deadlocks in A13 because nested transactions share
 * PG connections under load.
 *
 *   1) acquireEmissionLease(tenantId, maxSlots=2)
 *      - reaps expired leases
 *      - if active < max, creates row, returns id (SHORT transaction)
 *   2) business work runs OUTSIDE any lease-related tx (FT acquires its own chain locks)
 *   3) releaseEmissionLease(tenantId, leaseId)
 *
 * Migration: A13's EmissionLease table is reused (state must be ACTIVE).
 * PG clock (NOW()) is the authoritative source of truth for acquisition/expiry.
 */

import { runWithTenant } from './tenant-db';
import crypto from 'crypto';

export async function acquireEmissionLease(
  tenantId: string,
  operationId: string,
  maxSlots = 2,
) {
  return runWithTenant(tenantId, async (tx) => {
    // A14 — lock the Tenant row first; serializes lease create against other lease create/release per tenant.
    await tx.$executeRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId} FOR UPDATE`;

    // Reap leases expired by TTL (PG clock is authoritative)
    await tx.$executeRaw`
      UPDATE "EmissionLease"
      SET state = 'EXPIRED'
      WHERE "tenantId" = ${tenantId}
        AND state = 'ACTIVE'
        AND "expiresAt" < NOW()`;

    const activeCount = await tx.emissionLease.count({
      where: { tenantId, state: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    if (activeCount >= maxSlots) {
      return { busy: true as const, leaseId: null as string | null };
    }

    const processId = `${process.pid}:${crypto.randomBytes(6).toString('hex')}`;
    const rows = await tx.$queryRaw<Array<{ id: string; expiresAt: Date }>>`
      INSERT INTO "EmissionLease" (id, "tenantId", "operationId", "processId", state, "acquiredAt", "expiresAt", "lastRenewedAt")
      VALUES (gen_random_uuid()::text, ${tenantId}, ${operationId}, ${processId}, 'ACTIVE', NOW(), NOW() + INTERVAL '120 seconds', NOW())
      RETURNING id, "expiresAt"`;

    return { busy: false as const, leaseId: rows[0]?.id ?? null };
  });
}

export async function releaseEmissionLease(tenantId: string, leaseId: string) {
  return runWithTenant(tenantId, async (tx) => {
    await tx.$executeRaw`
      UPDATE "EmissionLease"
      SET state = 'RELEASED', "releasedAt" = NOW()
      WHERE "id" = ${leaseId} AND "tenantId" = ${tenantId} AND state = 'ACTIVE'`;
  });
}

export async function withEmissionLease<T>(
  tenantId: string,
  operationId: string,
  fn: () => Promise<T>,
  maxSlots = 2,
): Promise<{ value: T | null; busy: boolean; leaseId: string | null }> {
  // === A17 crash-recovery failpoint (test-only) ==========================
  // Opt-in via A17_CRASH_AT environment variable. NEVER activates in
  // production because there is no production-side path to set it.
  //   A17_CRASH_AT=after_lease_acquire — exit the process hard without
  //     releasing the lease (simulates SIGKILL during the half-second
  //     between acquire and business work).
  //   A17_CRASH_AT=any — same effect.
  // Leaving the lease ACTIVE lets the test observe recoverability.
  // ======================================================================
  const crashAt = process.env.A17_CRASH_AT;

  // Polling with backoff: retry up to 120s total
  const deadline = Date.now() + 120_000;
  let backoffMs = 10;

  while (Date.now() < deadline) {
    const acquire = await acquireEmissionLease(tenantId, operationId, maxSlots);
    if (!acquire.busy && acquire.leaseId) {
      if (crashAt === 'after_lease_acquire' || crashAt === 'any') {
        // OS-level SIGKILL from inside the test worker — atomic; least recoverable point
        // eslint-disable-next-line no-restricted-process-env
        process.kill(process.pid, 'SIGKILL');
      }
      try {
        const value = await fn();
        if (crashAt === 'after_commit' || crashAt === 'any') {
          process.kill(process.pid, 'SIGKILL');
        }
        return { value, busy: false, leaseId: acquire.leaseId };
      } finally {
        if (crashAt === 'before_release' || crashAt === 'any') {
          process.kill(process.pid, 'SIGKILL');
        }
        try { await releaseEmissionLease(tenantId, acquire.leaseId); } catch { /* best-effort release */ }
      }
    }
    // Wait before retry — short backoff so FTs make progress under contention
    await new Promise((r) => setTimeout(r, backoffMs));
    backoffMs = Math.min(backoffMs * 1.4, 150);
  }
  return { value: null, busy: true, leaseId: null };
}
