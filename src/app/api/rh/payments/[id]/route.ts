import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const batch = await runWithTenant(access.tenantId, (tx) => tx.rhPaymentBatch.findFirst({
      where: { id, tenantId: access.tenantId },
      include: { run: { select: { period: true, status: true } }, items: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } } } },
    }), { userId: access.userId });
    if (!batch) return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });
    return NextResponse.json(batch);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('payroll:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const target = body.status;

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const batch = await tx.rhPaymentBatch.findFirst({ where: { id, tenantId: access.tenantId } });
      if (!batch) return { code: 'NOT_FOUND' as const };
      if (target === 'SENT' && batch.status === 'DRAFT') {
        const updated = await tx.rhPaymentBatch.update({ where: { id }, data: { status: 'SENT', sentAt: new Date(), reference: `MANUAL-${Date.now()}` } });
        await tx.rhPaymentItem.updateMany({ where: { batchId: id }, data: { status: 'SENT' } });
        await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PAYMENT_SENT', entity: 'RhPaymentBatch', entityId: id, metadata: {} });
        return { code: 'OK' as const, batch: updated };
      }
      if ((target === 'CONFIRMED' || target === 'FAILED') && batch.status === 'SENT') {
        const updated = await tx.rhPaymentBatch.update({ where: { id }, data: { status: target, confirmedAt: target === 'CONFIRMED' ? new Date() : null, error: target === 'FAILED' ? 'Falha reportada manualmente.' : null } });
        await tx.rhPaymentItem.updateMany({ where: { batchId: id }, data: { status: target } });
        if (target === 'CONFIRMED') {
          await tx.rhPayrollRun.update({ where: { id: batch.runId }, data: { status: 'PAGO', paidAt: new Date() } });
        }
        await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: `RH_PAYMENT_${target}`, entity: 'RhPaymentBatch', entityId: id, metadata: {} });
        return { code: 'OK' as const, batch: updated };
      }
      return { code: 'INVALID_TRANSITION' as const, from: batch.status, to: target };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });
    if (result.code === 'INVALID_TRANSITION') return NextResponse.json({ error: `Transição inválida de ${result.from} para ${result.to}.` }, { status: 409 });
    return NextResponse.json(result.batch);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
