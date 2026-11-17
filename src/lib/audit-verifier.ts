/**
 * A13 — audit chain verifier
 *
 * Verifies the integrity of the hash chain for a tenant.
 * Returns INCOMPLETE when there are no events, VALID when chain links hold,
 * INVALID when a link breaks.
 *
 * NEVER mutates anything; purely read.
 */

import { runWithTenant } from './tenant-db';
import crypto from 'crypto';

export type ChainVerification = {
  status: 'VALID' | 'INVALID' | 'INCOMPLETE';
  tenantId: string;
  eventsVerified: number;
  first?: { hash: string; occurredAt: Date };
  last?: { hash: string; occurredAt: Date };
  firstBrokenAt?: { id: string; occurredAt: Date; reason: string };
  verifiedAt: Date;
};

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

const canonical = (e: any, previousHash: string | null, tenantId: string) => JSON.stringify({
  tenantId,
  action: e.action ?? null,
  entity: e.entity ?? null,
  entityId: e.entityId ?? null,
  actorUserId: e.actorUserId ?? null,
  before: e.before ?? null,
  after: e.after ?? null,
  justification: e.justification ?? null,
  correlationId: e.correlationId ?? null,
  source: e.source ?? null,
  result: e.result ?? 'SUCCESS',
  previousHash: previousHash ?? '',
});

export async function verifyAuditChain(tenantId: string): Promise<ChainVerification> {
  return runWithTenant(tenantId, async (tx) => {
    const events = await tx.auditEvent.findMany({
      where: { tenantId },
      orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, action: true, entity: true, entityId: true, actorUserId: true, before: true, after: true, justification: true, result: true, correlationId: true, source: true, hash: true, previousHash: true, occurredAt: true },
    });

    if (events.length === 0) {
      return { status: 'INCOMPLETE', tenantId, eventsVerified: 0, verifiedAt: new Date() };
    }

    let prevHash: string | null = null;
    let first: any, last: any;
    for (const e of events as any[]) {
      if (!e.hash) {
        return {
          status: 'INVALID', tenantId, eventsVerified: 0, verifiedAt: new Date(),
          firstBrokenAt: { id: e.id, occurredAt: e.occurredAt, reason: 'event has no hash (created before hash-chain migration)' },
        };
      }
      const expect = sha256(canonical(e, prevHash, tenantId));
      if (e.hash !== expect) {
        return {
          status: 'INVALID', tenantId, eventsVerified: 0, verifiedAt: new Date(),
          firstBrokenAt: { id: e.id, occurredAt: e.occurredAt, reason: 'hash mismatch — event content tampered or canonical mismatch' },
        };
      }
      if ((e.previousHash ?? null) !== prevHash) {
        return {
          status: 'INVALID', tenantId, eventsVerified: 0, verifiedAt: new Date(),
          firstBrokenAt: { id: e.id, occurredAt: e.occurredAt, reason: 'previousHash does not match prior event hash' },
        };
      }
      prevHash = e.hash;
      if (!first) first = e;
      last = e;
    }

    return {
      status: 'VALID',
      tenantId,
      eventsVerified: events.length,
      first: first ? { hash: first.hash, occurredAt: first.occurredAt } : undefined,
      last: last ? { hash: last.hash, occurredAt: last.occurredAt } : undefined,
      verifiedAt: new Date(),
    };
  });
}
