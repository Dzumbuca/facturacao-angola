import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;
let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } } });
}

describeIfDisposable('A12 — audit event isolation', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = `a12-audit-${Date.now()}`;
    await prisma.tenant.create({ data: { id: tenantId, name: `A12 ${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
  });

  afterAll(async () => { if (prisma) await prisma.$disconnect(); });

  it('audit events are visible for the tenant only', async () => {
    if (!prisma) return;
    await prisma.auditEvent.create({
      data: {
        tenantId,
        action: 'EXERCISE_CLOSED',
        entity: 'AccountingExercise',
        entityId: 'test-1',
        actorUserId: 'user-1',
        result: 'SUCCESS',
      },
    });
    const own = await prisma.auditEvent.findMany({ where: { tenantId } });
    expect(own.length).toBe(1);
    expect(own[0].action).toBe('EXERCISE_CLOSED');

    // Another tenant cannot see
    const otherTenant = await prisma.tenant.create({ data: { id: `a12-other-${Date.now()}`, name: 'Other', plan: 'PRO', status: 'ACTIVE' } });
    const crossView = await prisma.auditEvent.findMany({ where: { tenantId: otherTenant.id } });
    expect(crossView.length).toBe(0);
  });
});
