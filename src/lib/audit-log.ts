/**
 * A12 — audit log helper
 *
 * Lightweight write-through audit events. Halts silently are NOT allowed:
 * every call, success or failure, must attempt to write.
 *
 * Does not include secrets — callers must not pass passwords/tokens.
 *
 * Hash-chain: explicitly NOT implemented in this phase (would present as
 * inviolable without DB-level tamper resistance). Documented honestly.
 */

import { prisma } from './prisma';
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

export async function logAuditEvent(tenantId: string, entry: AuditEntry, tx?: any): Promise<void> {
  const data = {
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
  };
  if (tx) {
    await tx.auditEvent.create({ data });
  } else {
    await runWithTenant(tenantId, async (t) => {
      await t.auditEvent.create({ data });
    });
  }
}
