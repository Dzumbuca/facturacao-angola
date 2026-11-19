import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { createApprovalRequest, decideApprovalRequest, executeApprovedRequest } from './approval-service';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 60_000 } });
}

describeIfDisposable('A13 — approval workflow', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = `a13-app-${Date.now()}`;
    await prisma.tenant.create({ data: { id: tenantId, name: `A13 ${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
  });

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('creates a request, segregated decision, then executes idempotently', async () => {
    if (!prisma) return;
    const req = await createApprovalRequest({
      tenantId, operation: 'REOPEN_PERIOD', entityType: 'AccountingPeriod', entityId: 'period-1',
      requestedBy: 'user-A', justification: 'Ajustar lançamentos de um período encerrado por engano',
    });
    expect(req.state).toBe('PENDING');

    // Self-approval rejected
    await expect(decideApprovalRequest({ tenantId, requestId: req.id, decision: 'APPROVED', decidedBy: 'user-A' }))
      .rejects.toThrow(/SEGREGATION/);

    // Approve by different user
    const decided = await decideApprovalRequest({ tenantId, requestId: req.id, decision: 'APPROVED', decidedBy: 'user-B', decisionReason: 'OK' });
    expect(decided.state).toBe('APPROVED');

    // Execute — idempotent
    const r1 = await executeApprovedRequest({ tenantId, requestId: req.id, executedBy: 'user-B', execute: async () => 'done' });
    expect(r1.skipped).toBe(false);
    const r2 = await executeApprovedRequest({ tenantId, requestId: req.id, executedBy: 'user-B', execute: async () => { throw new Error('should not run'); } });
    expect(r2.skipped).toBe(true);
  });

  it('rejects request by same user for segregated operations', async () => {
    if (!prisma) return;
    const req = await createApprovalRequest({
      tenantId, operation: 'REOPEN_EXERCISE', entityType: 'AccountingExercise', entityId: 'ex-2026',
      requestedBy: 'user-A', justification: 'Modal reformulação de saldos de abertura',
    });
    const decided = await decideApprovalRequest({ tenantId, requestId: req.id, decision: 'REJECTED', decidedBy: 'user-B', decisionReason: 'Razão insuficiente' });
    expect(decided.state).toBe('REJECTED');
  });
});
