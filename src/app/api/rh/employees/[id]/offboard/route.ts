import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const lastDay = typeof body.lastDay === 'string' ? new Date(`${body.lastDay}T00:00:00.000Z`) : null;
    const revokeAccess = body.revokeAccess === true;
    const status = body.status === 'EM_PROCESSO' ? 'EM_PROCESSO' : 'CONCLUIDO';
    if (!reason || reason.length > 500) return NextResponse.json({ error: 'Motivo do desligamento é obrigatório.' }, { status: 400 });
    if (!lastDay || Number.isNaN(lastDay.getTime())) return NextResponse.json({ error: 'Data efectiva inválida.' }, { status: 400 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const employee = await tx.rhEmployee.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, email: true, status: true } });
      if (!employee) return { code: 'NOT_FOUND' as const };
      const existing = await tx.rhOffboarding.findUnique({ where: { employeeId: id }, select: { id: true } });
      if (existing) return { code: 'ALREADY_OFFBOARDED' as const };

      let revokedUserId: string | null = null;
      if (revokeAccess && employee.email) {
        const user = await tx.user.findFirst({ where: { tenantId: access.tenantId, email: { equals: employee.email, mode: 'insensitive' } }, select: { id: true, status: true } });
        if (user && user.status === 'ACTIVE') {
          await tx.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
          revokedUserId = user.id;
        }
      }

      const offboarding = await tx.rhOffboarding.create({
        data: { tenantId: access.tenantId, employeeId: id, reason, lastDay, status, notes: body.notes?.trim() || null, revokeAccess, decidedByUserId: access.userId },
      });
      await tx.rhEmployee.update({ where: { id }, data: { status: 'INACTIVO' } });
      await rhAudit(tx, {
        tenantId: access.tenantId, actorUserId: access.userId,
        action: 'RH_EMPLOYEE_OFFBOARDED', entity: 'RhEmployee', entityId: id,
        metadata: { reason, lastDay: lastDay.toISOString(), status, revokeAccess, revokedUserId },
      });
      return { code: 'OK' as const, offboarding };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (result.code === 'ALREADY_OFFBOARDED') return NextResponse.json({ code: 'ALREADY_OFFBOARDED', error: 'Este funcionário já foi desligado.' }, { status: 409 });
    return NextResponse.json(result.offboarding, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
