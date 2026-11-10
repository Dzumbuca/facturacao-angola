import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

type Context = { params: Promise<{ id: string }> };
type Status = 'CALCULADO' | 'EM_REVISAO' | 'APROVADO' | 'PENDENTE_PAGAMENTO' | 'PAGO' | 'CANCELADO';

const TRANSITIONS: Record<string, Status[]> = {
  CALCULADO: ['EM_REVISAO', 'APROVADO', 'CANCELADO'],
  EM_REVISAO: ['APROVADO', 'CANCELADO'],
  APROVADO: ['PENDENTE_PAGAMENTO', 'CANCELADO'],
  PENDENTE_PAGAMENTO: ['PAGO', 'CANCELADO'],
};

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const run = await runWithTenant(access.tenantId, (tx) => tx.rhPayrollRun.findFirst({
      where: { id, tenantId: access.tenantId },
      include: {
        ruleset: { select: { id: true, name: true } },
        payslips: { include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } } },
      },
    }), { userId: access.userId });
    if (!run) return NextResponse.json({ error: 'Processamento não encontrado.' }, { status: 404 });
    return NextResponse.json(run);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const target = body.status as Status;
    const result = await runWithTenant(access.tenantId, async (tx) => {
      const run = await tx.rhPayrollRun.findFirst({ where: { id, tenantId: access.tenantId } });
      if (!run) return { code: 'NOT_FOUND' as const };
      const allowed = TRANSITIONS[run.status] ?? [];
      if (!allowed.includes(target)) return { code: 'INVALID_TRANSITION' as const, from: run.status };
      const updated = await tx.rhPayrollRun.update({
        where: { id },
        data: {
          status: target,
          ...(target === 'APROVADO' ? { approvedByUserId: access.userId, approvedAt: new Date() } : {}),
          ...(target === 'PAGO' ? { paidAt: new Date() } : {}),
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: `RH_PAYROLL_${target}`, entity: 'RhPayrollRun', entityId: id, metadata: { from: run.status, to: target } });
      return { code: 'OK' as const, updated };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Processamento não encontrado.' }, { status: 404 });
    if (result.code === 'INVALID_TRANSITION') return NextResponse.json({ code: 'INVALID_TRANSITION', error: `Transição inválida a partir de ${result.from}.` }, { status: 409 });
    return NextResponse.json(result.updated);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
