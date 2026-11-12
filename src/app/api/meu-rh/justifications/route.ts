import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { runWithTenant } from '@/lib/tenant-db';
import { rhAudit } from '@/lib/rh-service';
import { notifyRhUsers } from '@/lib/rh-notify';

const TYPES = ['FALTA', 'ATRASO', 'SAIDA_ANTECIPADA', 'OUTRO'] as const;

export async function GET() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!(await isApplicationEnabled(tenantId, 'rh'))) return NextResponse.json({ error: 'Módulo inactivo.' }, { status: 403 });

  const rows = await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return [];
    const employee = await tx.rhEmployee.findFirst({ where: { tenantId, email: { equals: user.email, mode: 'insensitive' } }, select: { id: true } });
    if (!employee) return [];
    return tx.rhAbsenceJustification.findMany({
      where: { tenantId, employeeId: employee.id },
      orderBy: { date: 'desc' },
      take: 30,
    });
  }, { userId });

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!(await isApplicationEnabled(tenantId, 'rh'))) return NextResponse.json({ error: 'Módulo inactivo.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const type = TYPES.includes(body.type) ? body.type : null;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const date = typeof body.date === 'string' ? new Date(`${body.date}T00:00:00.000Z`) : null;
  if (!type) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
  if (!reason || reason.length > 1000) return NextResponse.json({ error: 'Motivo obrigatório (até 1000 caracteres).' }, { status: 400 });
  if (!date || Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });

  const result = await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return { code: 'NO_EMPLOYEE' as const };
    const employee = await tx.rhEmployee.findFirst({
      where: { tenantId, email: { equals: user.email, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) return { code: 'NO_EMPLOYEE' as const };

    const existing = await tx.rhAbsenceJustification.findUnique({
      where: { tenantId_employeeId_date_type: { tenantId, employeeId: employee.id, date, type } },
      select: { id: true },
    });
    if (existing) return { code: 'DUPLICATE' as const };

    const row = await tx.rhAbsenceJustification.create({
      data: { tenantId, employeeId: employee.id, date, type, reason, createdByUserId: userId },
    });
    await rhAudit(tx, { tenantId, actorUserId: userId, action: 'RH_JUSTIFICATION_SUBMITTED', entity: 'RhAbsenceJustification', entityId: row.id, metadata: { employeeId: employee.id, type, date: date.toISOString() } });

    await notifyRhUsers(tx, {
      tenantId,
      roles: ['MANAGER', 'ADMIN'],
      title: 'Nova justificação submetida',
      body: `${employee.firstName} ${employee.lastName} · ${type} em ${date.toISOString().slice(0, 10)}`,
      entityType: 'RhAbsenceJustification',
      entityId: row.id,
    });
    return { code: 'OK' as const, row };
  }, { userId });

  if (result.code === 'NO_EMPLOYEE') return NextResponse.json({ error: 'Utilizador sem funcionário associado.' }, { status: 404 });
  if (result.code === 'DUPLICATE') return NextResponse.json({ code: 'DUPLICATE', error: 'Já existe uma justificação deste tipo nesta data.' }, { status: 409 });
  return NextResponse.json(result.row, { status: 201 });
}