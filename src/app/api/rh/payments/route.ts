import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const PROVIDERS = ['MANUAL', 'EMIS'] as const;

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhPaymentBatch.findMany({
      where: { tenantId: access.tenantId },
      include: { run: { select: { period: true, status: true } }, _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('payroll:write');
    const body = await req.json().catch(() => ({}));
    const runId = typeof body.runId === 'string' ? body.runId : '';
    const provider = PROVIDERS.includes(body.provider) ? body.provider : 'MANUAL';
    if (!runId) return NextResponse.json({ error: 'Processamento obrigatório.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const run = await tx.rhPayrollRun.findFirst({ where: { id: runId, tenantId: access.tenantId } });
      if (!run) return { code: 'RUN_NOT_FOUND' as const };
      if (!['APROVADO', 'PENDENTE_PAGAMENTO'].includes(run.status)) return { code: 'RUN_NOT_APPROVED' as const };
      const existing = await tx.rhPaymentBatch.findUnique({ where: { runId } });
      if (existing) return { code: 'EXISTS' as const };
      const payslips = (await tx.rhPayslip.findMany({ where: { runId, tenantId: access.tenantId }, select: { employeeId: true, net: true } })) as any[];
      const total = payslips.reduce((sum: number, slip: any) => sum + Number(slip.net), 0);
      const batch = await tx.rhPaymentBatch.create({
        data: {
          tenantId: access.tenantId,
          runId,
          provider,
          total,
          items: { create: payslips.map((slip: any) => ({ tenantId: access.tenantId, employeeId: slip.employeeId, amount: slip.net })) },
        },
      });
      await tx.rhPayrollRun.update({ where: { id: runId }, data: { status: 'PENDENTE_PAGAMENTO' } });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PAYMENT_BATCH_CREATED', entity: 'RhPaymentBatch', entityId: batch.id, metadata: { runId, provider, total } });
      return { code: 'OK' as const, batch };
    }, { userId: access.userId });

    if (result.code === 'RUN_NOT_FOUND') return NextResponse.json({ error: 'Processamento não encontrado.' }, { status: 404 });
    if (result.code === 'RUN_NOT_APPROVED') return NextResponse.json({ error: 'O processamento tem de estar aprovado.' }, { status: 409 });
    if (result.code === 'EXISTS') return NextResponse.json({ code: 'EXISTS', error: 'Já existe um lote para este processamento.' }, { status: 409 });
    return NextResponse.json(result.batch, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
