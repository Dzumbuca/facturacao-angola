import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { runWithTenant } from '@/lib/tenant-db';
import { rhAudit } from '@/lib/rh-service';

export async function GET(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!(await isApplicationEnabled(tenantId, 'rh'))) return NextResponse.json({ error: 'Módulo inactivo.' }, { status: 403 });

  const url = new URL(req.url);
  const cycleId = url.searchParams.get('cycleId');
  if (!cycleId) return NextResponse.json({ error: 'Ciclo obrigatório.' }, { status: 400 });

  const row = (await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return null;
    const employee = await tx.rhEmployee.findFirst({ where: { tenantId, email: { equals: user.email, mode: 'insensitive' } }, select: { id: true } });
    if (!employee) return null;
    return tx.rhPerformanceReviewSelfAssessment.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
    });
  }, { userId })) as any;

  return NextResponse.json(row ?? { submitted: false });
}

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!(await isApplicationEnabled(tenantId, 'rh'))) return NextResponse.json({ error: 'Módulo inactivo.' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const cycleId = typeof body.cycleId === 'string' ? body.cycleId : '';
  const selfScore = body.selfScore === undefined || body.selfScore === null ? null : Number(body.selfScore);
  const comments = typeof body.comments === 'string' && body.comments.trim() ? body.comments.trim().slice(0, 2000) : null;
  if (!cycleId) return NextResponse.json({ error: 'Ciclo obrigatório.' }, { status: 400 });
  if (selfScore !== null && (!Number.isInteger(selfScore) || selfScore < 0 || selfScore > 100)) {
    return NextResponse.json({ error: 'Pontuação deve ser um inteiro entre 0 e 100.' }, { status: 400 });
  }

  const result = await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return { code: 'NO_EMPLOYEE' as const };
    const employee = await tx.rhEmployee.findFirst({
      where: { tenantId, email: { equals: user.email, mode: 'insensitive' } },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) return { code: 'NO_EMPLOYEE' as const };

    const cycle = await tx.rhPerformanceCycle.findFirst({ where: { id: cycleId, tenantId }, select: { id: true, name: true, status: true } });
    if (!cycle) return { code: 'NOT_FOUND' as const };
    if (cycle.status !== 'ABERTO') return { code: 'CLOSED' as const };

    const row = await tx.rhPerformanceReviewSelfAssessment.upsert({
      where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
      update: { selfScore, comments, submittedAt: new Date() },
      create: { tenantId, cycleId, employeeId: employee.id, selfScore, comments },
    });
    await rhAudit(tx, { tenantId, actorUserId: userId, action: 'RH_SELF_ASSESSMENT_SUBMITTED', entity: 'RhPerformanceReviewSelfAssessment', entityId: row.id, metadata: { cycleId, selfScore } });
    return { code: 'OK' as const, row };
  }, { userId });

  if (result.code === 'NO_EMPLOYEE') return NextResponse.json({ error: 'Utilizador sem funcionário associado.' }, { status: 404 });
  if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Ciclo não encontrado.' }, { status: 404 });
  if (result.code === 'CLOSED') return NextResponse.json({ error: 'O ciclo está fechado.' }, { status: 409 });
  return NextResponse.json(result.row, { status: 201 });
}