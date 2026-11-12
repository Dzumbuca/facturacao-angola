import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { notifyRhUsers } from '@/lib/rh-notify';
type RhLeaveType = 'FERIAS' | 'LICENCA' | 'DISPENSA' | 'DOENCA' | 'OUTRA';
type RhLeaveStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'CANCELADO';

const TYPES: RhLeaveType[] = ['FERIAS', 'LICENCA', 'DISPENSA', 'DOENCA', 'OUTRA'];
const OPEN: RhLeaveStatus[] = ['PENDENTE', 'APROVADO'];

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get('year') ?? new Date().getFullYear());
    const status = url.searchParams.get('status');
    const employeeId = url.searchParams.get('employeeId');
    const start = new Date(Date.UTC(Number.isFinite(year) ? year : new Date().getFullYear(), 0, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));

    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhLeaveRequest.findMany({
      where: {
        tenantId: access.tenantId,
        startDate: { gte: start, lt: end },
        ...(status ? { status: status as RhLeaveStatus } : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { startDate: 'desc' },
      take: 300,
    }), { userId: access.userId })) as any[];

    const settings = (await runWithTenant(access.tenantId, (tx) => tx.rhSettings.findUnique({ where: { tenantId: access.tenantId } }), { userId: access.userId })) as { vacationDaysPerYear: number | null } | null;
    return NextResponse.json({ items: rows, vacationDaysPerYear: settings?.vacationDaysPerYear ?? null });
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
    const type: RhLeaveType = TYPES.includes(body.type) ? body.type : 'FERIAS';
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    if (!employeeId) return NextResponse.json({ error: 'Funcionário obrigatório.' }, { status: 400 });
    if (!startDate || !endDate) return NextResponse.json({ error: 'Datas inválidas.' }, { status: 400 });
    if (endDate < startDate) return NextResponse.json({ error: 'A data de fim não pode ser anterior ao início.' }, { status: 400 });
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    if (days < 1 || days > 365) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const employee = await tx.rhEmployee.findFirst({ where: { id: employeeId, tenantId: access.tenantId }, select: { id: true, firstName: true, lastName: true } });
      if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
      const overlap = await tx.rhLeaveRequest.findFirst({
        where: {
          tenantId: access.tenantId,
          employeeId,
          status: { in: OPEN },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true },
      });
      if (overlap) throw new Error('OVERLAP');
      const row = await tx.rhLeaveRequest.create({
        data: { tenantId: access.tenantId, employeeId, type, startDate, endDate, days, reason: body.reason?.trim() || null },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_LEAVE_CREATED', entity: 'RhLeaveRequest', entityId: row.id, metadata: { employeeId, type, days } });
      await notifyRhUsers(tx, {
        tenantId: access.tenantId,
        roles: ['MANAGER', 'ADMIN'],
        title: 'Novo pedido de férias',
        body: `${employee.firstName} ${employee.lastName} · ${days} dia(s) a partir de ${startDate.toISOString().slice(0, 10)}`,
        entityType: 'RhLeaveRequest',
        entityId: row.id,
      });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (error?.message === 'OVERLAP') return NextResponse.json({ code: 'OVERLAP', error: 'Já existe um pedido pendente ou aprovado neste período.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
