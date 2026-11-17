import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { logAuditEvent } from './audit-log';
import { verifyAuditChain } from './audit-verifier';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 60_000 } });
}

describeIfDisposable('A13 — audit chain verifier', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = `a13-chain-${Date.now()}`;
    await prisma.tenant.create({ data: { id: tenantId, name: `A13 ${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
  });

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('verifier returns VALID for untampered chain and INVALID for tampered one', async () => {
    if (!prisma) return;
    // Create 3 events; verify VALID
    await logAuditEvent(tenantId, { action: 'TEST_A', entity: 'Test', entityId: 'a', actorUserId: 'user-A', justification: 'phase 1' });
    await logAuditEvent(tenantId, { action: 'TEST_B', entity: 'Test', entityId: 'b', actorUserId: 'user-A', justification: 'phase 2' });
    await logAuditEvent(tenantId, { action: 'TEST_C', entity: 'Test', entityId: 'c', actorUserId: 'user-A', justification: 'phase 3' });
    const v1 = await verifyAuditChain(tenantId);
    expect(v1.status).toBe('VALID');
    expect(v1.eventsVerified).toBe(3);

    // Tamper: manually rewrite one event's justification (bypassing app)
    const target = await prisma.auditEvent.findFirst({ where: { tenantId, action: 'TEST_B' } });
    await prisma.auditEvent.update({
      where: { id: target!.id },
      data: { justification: 'TAMPERED' },
    });
    const v2 = await verifyAuditChain(tenantId);
    expect(v2.status).toBe('INVALID');
  });
});
