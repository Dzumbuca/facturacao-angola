import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
type RhContractType = 'INDEFINIDO' | 'TERMO_CERTO' | 'ESTAGIO' | 'PRESTACAO_SERVICOS';
type RhContractStatus = 'RASCUNHO' | 'ACTIVO' | 'RENOVADO' | 'CESSAO' | 'EXPIRADO';

const TYPES: RhContractType[] = ['INDEFINIDO', 'TERMO_CERTO', 'ESTAGIO', 'PRESTACAO_SERVICOS'];
const STATUSES: RhContractStatus[] = ['RASCUNHO', 'ACTIVO', 'RENOVADO', 'CESSAO', 'EXPIRADO'];

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhContract.findMany({
      where: { tenantId: access.tenantId },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true } } },
      orderBy: { startDate: 'desc' },
      take: 200,
    }), { userId: access.userId })) as any[];
    return NextResponse.json((rows as any[]).map((row) => ({ ...row, salary: Number(row.salary) })));
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId : '';
    const startDate = parseDate(body.startDate);
    const endDate = parseDate(body.endDate);
    const salary = Number(body.salary);
    const type = TYPES.includes(body.type) ? body.type : 'INDEFINIDO';
    const status = STATUSES.includes(body.status) ? body.status : 'RASCUNHO';
    if (!employeeId) return NextResponse.json({ error: 'Funcionário obrigatório.' }, { status: 400 });
    if (!startDate) return NextResponse.json({ error: 'Data de início inválida.' }, { status: 400 });
    if (endDate && endDate < startDate) return NextResponse.json({ error: 'A data de fim não pode ser anterior ao início.' }, { status: 400 });
    if (!Number.isFinite(salary) || salary < 0) return NextResponse.json({ error: 'Salário inválido.' }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const employee = await tx.rhEmployee.findFirst({ where: { id: employeeId, tenantId: access.tenantId }, select: { id: true } });
      if (!employee) throw new Error('EMPLOYEE_NOT_FOUND');
      const row = await tx.rhContract.create({
        data: {
          tenantId: access.tenantId,
          employeeId,
          type,
          status,
          startDate,
          endDate,
          salary,
          documentUrl: body.documentUrl?.trim() || null,
          notes: body.notes?.trim() || null,
        },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_CONTRACT_CREATED', entity: 'RhContract', entityId: row.id, metadata: { employeeId, type, status } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json({ ...created, salary: Number(created.salary) }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'EMPLOYEE_NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
