import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { lateMinutesFor } from '@/lib/rh-service';

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const from = parseDate(url.searchParams.get('from'), start);
    const to = parseDate(url.searchParams.get('to'), end);
    const employeeId = url.searchParams.get('employeeId');

    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhTimeEntry.findMany({
      where: {
        tenantId: access.tenantId,
        occurredAt: { gte: from, lte: to },
        ...(employeeId ? { employeeId } : {}),
      },
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeNumber: true, shift: { select: { name: true, startTime: true, toleranceMinutes: true } } } } },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    }), { userId: access.userId })) as any[];

    return NextResponse.json(rows.map((row) => ({ ...row, lateMinutes: row.type === 'ENTRADA' ? lateMinutesFor(row.occurredAt, row.employee.shift) : 0, shiftName: row.employee.shift?.name ?? null })));
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
