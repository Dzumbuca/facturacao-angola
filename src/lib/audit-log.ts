/**
 * A12 — audit log helper (hash-chained per tenant)
 *
 * Each AuditEvent is linked to the previous AuditEvent for the same tenant
 * via SHA-256 hash of (previousHash + canonical fields). Detects historical
 * tampering; the chain is NOT cryptographic proof of global integrity
 * (an attacker with full DB access can re-write the chain); it's a
 * tamper-evident signal only.
 */

import { createHash } from 'crypto';
import { runWithTenant } from './tenant-db';

type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  actorUserId?: string | null;
  before?: unknown;
  after?: unknown;
  justification?: string | null;
  result?: 'SUCCESS' | 'FAILURE';
  correlationId?: string | null;
  source?: string | null;
};

const canonical = (entry: Partial<AuditEntry>, previousHash: string | null, tenantId: string): string =>
  JSON.stringify({
    tenantId,
    action: entry.action ?? null,
    entity: entry.entity ?? null,
    entityId: entry.entityId ?? null,
    actorUserId: entry.actorUserId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    justification: entry.justification ?? null,
    correlationId: entry.correlationId ?? null,
    source: entry.source ?? null,
    result: entry.result ?? 'SUCCESS',
    previousHash: previousHash ?? '',
  });

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

export async function logAuditEvent(tenantId: string, entry: AuditEntry, tx?: any): Promise<{ id: string; hash: string; previousHash: string | null }> {
  const runner = tx
    ? (fn: (t: any) => Promise<any>) => fn(tx)
    : (fn: (t: any) => Promise<any>) => runWithTenant(tenantId, fn);

  return runner(async (t) => {
    const latest = await t.auditEvent.findFirst({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      select: { hash: true },
    });
    const previousHash = latest?.hash ?? null;
    const canonicalStr = canonical(entry, previousHash, tenantId);
    const hash = sha256(canonicalStr);

    const created = await t.auditEvent.create({
      data: {
        tenantId,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: entry.before ? (entry.before as any) : undefined,
        after: entry.after ? (entry.after as any) : undefined,
        justification: entry.justification ?? null,
        result: entry.result ?? 'SUCCESS',
        correlationId: entry.correlationId ?? null,
        source: entry.source ?? null,
        previousHash,
        hash,
      },
    });
    return { id: created.id, hash: created.hash ?? hash, previousHash };
  });
}
