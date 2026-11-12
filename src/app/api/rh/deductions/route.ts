import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const TYPES = ['ADIANTAMENTO', 'EMPRESTIMO', 'OUTRO'] as const;

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const employeeId = url.searchParams.get('employeeId');
    const active = url.searchParams.get('active');
    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhEmployeeDeduction.findMany({
      where: {
        tenantId: access.tenantId,
        ...(employeeId ? { employeeId } : {}),
        ...(active === '1' ? { active: true } : active === '0' ? { active: false } : {}),
      },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }), { userId: access.userId })) as any[];
    return NextResponse.json(rows.map((row) => ({ ...row, amount: Number(row.amount) })));
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('payroll:write');
    const body = await req.json().catch(() => ({}));
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const type = TYPES.includes(body.type) ? body.type as (typeof TYPES)[number] : 'OUTRO';
    const amount = Number(body.amount);
    const remainingInstallments = body.remainingInstallments === undefined || body.remainingInstallments === null
      ? null
      : Math.max(1, Math.floor(Number(body.remainingInstallments)));
    if (!employeeId) return NextResponse.json({ error: 'Funcionário obrigatório.' }, { status: 400 });
    if (!description || description.length > 200) return NextResponse.json({ error: 'Descrição obrigatória (até 200 caracteres).' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
    if (body.remainingInstallments !== undefined && body.remainingInstallments !== null && (!Number.isFinite(Number(body.remainingInstallments)) || Number(body.remainingInstallments) < 1)) {
      return NextResponse.json({ error: 'Número de prestações inválido.' }, { status: 400 });
    }

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const employee = await tx.rhEmployee.findFirst({ where: { id: employeeId, tenantId: access.tenantId }, select: { id: true } });
      if (!employee) return { code: 'NOT_FOUND' as const };
      const row = await tx.rhEmployeeDeduction.create({
        data: { tenantId: access.tenantId, employeeId, description, type, amount, remainingInstallments },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DEDUCTION_CREATED', entity: 'RhEmployeeDeduction', entityId: row.id, metadata: { employeeId, amount, remainingInstallments } });
      return { code: 'OK' as const, row };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    return NextResponse.json({ ...result.row, amount: Number(result.row.amount) }, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}