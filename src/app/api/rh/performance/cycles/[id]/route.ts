import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

type Context = { params: Promise<{ id: string }> };

/** Gera revisões PENDENTE para todos os funcionários ACTIVOS que ainda não têm revisão no ciclo. */
export async function POST(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const cycle = await tx.rhPerformanceCycle.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true, status: true } });
      if (!cycle) return { code: 'NOT_FOUND' as const };
      if (cycle.status === 'FECHADO') return { code: 'CLOSED' as const };

      const employees = await tx.rhEmployee.findMany({ where: { tenantId: access.tenantId, status: 'ACTIVO' }, select: { id: true, firstName: true, lastName: true } });
      const existing = await tx.rhPerformanceReview.findMany({ where: { tenantId: access.tenantId, cycleId: id }, select: { employeeId: true } });
      const existingIds = new Set(existing.map((row: { employeeId: string }) => row.employeeId));
      const toCreate = employees.filter((employee: { id: string }) => !existingIds.has(employee.id));

      if (toCreate.length === 0) return { code: 'OK' as const, created: 0 };
      await tx.rhPerformanceReview.createMany({
        data: toCreate.map((employee: { id: string }) => ({ tenantId: access.tenantId, cycleId: id, employeeId: employee.id, reviewerName: access.userId })),
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_REVIEW_REVIEWS_GENERATED', entity: 'RhPerformanceCycle', entityId: id, metadata: { created: toCreate.length } });
      return { code: 'OK' as const, created: toCreate.length };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Ciclo não encontrado.' }, { status: 404 });
    if (result.code === 'CLOSED') return NextResponse.json({ error: 'O ciclo está fechado.' }, { status: 409 });
    return NextResponse.json({ created: result.created });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

/** Fecha o ciclo. */
export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('employees:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'close') return NextResponse.json({ error: 'Acção desconhecida.' }, { status: 400 });

    const cycle = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhPerformanceCycle.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
      if (!existing) return null;
      const updated = await tx.rhPerformanceCycle.update({ where: { id }, data: { status: 'FECHADO' } });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_REVIEW_CYCLE_CLOSED', entity: 'RhPerformanceCycle', entityId: id, metadata: {} });
      return updated;
    }, { userId: access.userId });

    if (!cycle) return NextResponse.json({ error: 'Ciclo não encontrado.' }, { status: 404 });
    return NextResponse.json(cycle);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}