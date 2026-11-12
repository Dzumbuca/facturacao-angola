import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { rhAudit } from '@/lib/rh-service';

const TYPES = ['ADIANTAMENTO', 'EMPRESTIMO', 'OUTRO'] as const;
type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess('payroll:write');
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: any = {};
    if (body.description !== undefined) {
      const value = typeof body.description === 'string' ? body.description.trim() : '';
      if (!value || value.length > 200) return NextResponse.json({ error: 'Descrição inválida.' }, { status: 400 });
      data.description = value;
    }
    if (body.type !== undefined) {
      if (!TYPES.includes(body.type)) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 });
      data.type = body.type;
    }
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
      data.amount = amount;
    }
    if (body.remainingInstallments !== undefined) {
      data.remainingInstallments = body.remainingInstallments === null ? null : (Number.isFinite(Number(body.remainingInstallments)) && Number(body.remainingInstallments) >= 1 ? Math.floor(Number(body.remainingInstallments)) : null);
    }
    if (body.active !== undefined) data.active = body.active === true || body.active === 'true';

    const updated = await runWithTenant(access.tenantId, async (tx) => {
      const existing = await tx.rhEmployeeDeduction.findFirst({ where: { id, tenantId: access.tenantId }, select: { id: true } });
      if (!existing) return null;
      const row = await tx.rhEmployeeDeduction.update({ where: { id }, data });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_DEDUCTION_UPDATED', entity: 'RhEmployeeDeduction', entityId: id, metadata: { fields: Object.keys(data) } });
      return row;
    }, { userId: access.userId });

    if (!updated) return NextResponse.json({ error: 'Desconto não encontrado.' }, { status: 404 });
    return NextResponse.json({ ...updated, amount: Number(updated.amount) });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}