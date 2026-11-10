import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';
import { parsePayrollConfig } from '@/lib/rh-payroll';

export async function GET() {
  try {
    const access = await requireRhAccess();
    const rows = await runWithTenant(access.tenantId, (tx) => tx.rhPayrollRuleSet.findMany({
      where: { tenantId: access.tenantId },
      orderBy: { effectiveFrom: 'desc' },
    }), { userId: access.userId });
    return NextResponse.json(rows);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const effectiveFrom = typeof body.effectiveFrom === 'string' ? new Date(`${body.effectiveFrom}T00:00:00.000Z`) : null;
    if (!name || name.length > 120) return NextResponse.json({ error: 'Nome do conjunto inválido.' }, { status: 400 });
    if (!effectiveFrom || Number.isNaN(effectiveFrom.getTime())) return NextResponse.json({ error: 'Data de vigência inválida.' }, { status: 400 });
    const parsed = parsePayrollConfig(body);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const created = await runWithTenant(access.tenantId, async (tx) => {
      const row = await tx.rhPayrollRuleSet.create({
        data: { tenantId: access.tenantId, name, effectiveFrom, status: 'ACTIVE', config: parsed.config as any },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_PAYROLL_RULESET_CREATED', entity: 'RhPayrollRuleSet', entityId: row.id, metadata: { name, effectiveFrom: effectiveFrom.toISOString() } });
      return row;
    }, { userId: access.userId });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ error: 'Já existe um conjunto com esse nome.' }, { status: 409 });
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
