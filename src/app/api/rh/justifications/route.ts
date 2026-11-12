import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const TYPES = ['FALTA', 'ATRASO', 'SAIDA_ANTECIPADA', 'OUTRO'] as const;
type JustificationType = (typeof TYPES)[number];

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const status = url.searchParams.get('status');
    const employeeId = url.searchParams.get('employeeId');
    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhAbsenceJustification.findMany({
      where: {
        tenantId: access.tenantId,
        ...(status && ['PENDENTE', 'APROVADO', 'REJEITADO'].includes(status) ? { status: status as 'PENDENTE' | 'APROVADO' | 'REJEITADO' } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { date: 'desc' },
      take: 200,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('leaves:write');
    const body = await req.json().catch(() => ({}));
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const type = TYPES.includes(body.type) ? (body.type as JustificationType) : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const date = typeof body.date === 'string' ? new Date(`${body.date}T00:00:00.000Z`) : null;
    if (!employeeId) return NextResponse.json({ error: 'Funcionário obrigatório.' }, { status: 400 });
    if (!type) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
    if (!reason || reason.length > 1000) return NextResponse.json({ error: 'Motivo obrigatório (até 1000 caracteres).' }, { status: 400 });
    if (!date || Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const employee = await tx.rhEmployee.findFirst({ where: { id: employeeId, tenantId: access.tenantId }, select: { id: true } });
      if (!employee) return { code: 'NOT_FOUND' as const };
      const existing = await tx.rhAbsenceJustification.findUnique({
        where: { tenantId_employeeId_date_type: { tenantId: access.tenantId, employeeId, date, type } },
        select: { id: true },
      });
      if (existing) return { code: 'DUPLICATE' as const };
      const row = await tx.rhAbsenceJustification.create({
        data: { tenantId: access.tenantId, employeeId, date, type, reason, createdByUserId: access.userId },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_JUSTIFICATION_CREATED', entity: 'RhAbsenceJustification', entityId: row.id, metadata: { employeeId, type, date: date.toISOString() } });
      return { code: 'OK' as const, row };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (result.code === 'DUPLICATE') return NextResponse.json({ code: 'DUPLICATE', error: 'Já existe uma justificação deste tipo nesta data.' }, { status: 409 });
    return NextResponse.json(result.row, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}