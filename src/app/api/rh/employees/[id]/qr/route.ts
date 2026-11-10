import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { createQrToken } from '@/lib/rh-qr';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const employee = (await runWithTenant(access.tenantId, (tx) => tx.rhEmployee.findFirst({
      where: { id, tenantId: access.tenantId, status: 'ACTIVO' },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true },
    }), { userId: access.userId })) as { id: string; firstName: string; lastName: string; employeeNumber: string } | null;
    if (!employee) return NextResponse.json({ error: 'Funcionário não encontrado.' }, { status: 404 });

    const { token, expiresAt } = createQrToken(access.tenantId, employee.id, 300);
    const svg = await QRCode.toString(token, { type: 'svg', margin: 1, width: 220 });
    return NextResponse.json({ employee: { id: employee.id, name: `${employee.firstName} ${employee.lastName}`, employeeNumber: employee.employeeNumber }, token, expiresAt: expiresAt.toISOString(), svg });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
