import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { verifyQrToken } from '@/lib/rh-qr';
import { rhAudit } from '@/lib/rh-service';

const TYPES = ['ENTRADA', 'SAIDA_ALMOCO', 'REGRESSO_ALMOCO', 'SAIDA'] as const;
type TimeEntryType = (typeof TYPES)[number];

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess();
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const type = TYPES.includes(body.type) ? (body.type as TimeEntryType) : null;
    if (!token) return NextResponse.json({ error: 'QR obrigatório.' }, { status: 400 });
    if (!type) return NextResponse.json({ error: 'Tipo de marcação inválido.' }, { status: 400 });

    const payload = verifyQrToken(token);
    if (!payload) return NextResponse.json({ code: 'INVALID_QR', error: 'QR inválido ou expirado.' }, { status: 401 });
    if (payload.tenantId !== access.tenantId) return NextResponse.json({ code: 'INVALID_QR', error: 'QR de outra empresa.' }, { status: 403 });

    const result = await runWithTenant(access.tenantId, async (tx) => {
      const employee = await tx.rhEmployee.findFirst({
        where: { id: payload.employeeId, tenantId: access.tenantId },
        select: { id: true, status: true },
      });
      if (!employee) return { code: 'NOT_FOUND' as const };
      if (employee.status !== 'ACTIVO') return { code: 'INACTIVE' as const };

      const recent = await tx.rhTimeEntry.findFirst({
        where: { tenantId: access.tenantId, employeeId: employee.id, type, occurredAt: { gte: new Date(Date.now() - 60_000) } },
        select: { id: true },
      });
      if (recent) return { code: 'DUPLICATE' as const };

      const entry = await tx.rhTimeEntry.create({
        data: { tenantId: access.tenantId, employeeId: employee.id, type, source: 'QR' },
      });
      await rhAudit(tx, { tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_TIME_ENTRY_CREATED', entity: 'RhTimeEntry', entityId: entry.id, metadata: { employeeId: employee.id, type, source: 'QR' } });
      return { code: 'OK' as const, entry };
    }, { userId: access.userId });

    if (result.code === 'NOT_FOUND') return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });
    if (result.code === 'INACTIVE') return NextResponse.json({ error: 'Funcionário inactivo.' }, { status: 400 });
    if (result.code === 'DUPLICATE') return NextResponse.json({ code: 'DUPLICATE', error: 'Já existe uma marcação deste tipo no último minuto.' }, { status: 409 });
    return NextResponse.json(result.entry, { status: 201 });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
