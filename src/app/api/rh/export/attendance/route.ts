import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { toCsv, csvResponse } from '@/lib/csv';
import { lateMinutesFor } from '@/lib/rh-service';

export async function GET(req: Request) {
  try {
    const access = await requireRhAccess();
    const url = new URL(req.url);
    const from = url.searchParams.get('from') ? new Date(`${url.searchParams.get('from')}T00:00:00.000Z`) : new Date(Date.now() - 30 * 86_400_000);
    const to = url.searchParams.get('to') ? new Date(`${url.searchParams.get('to')}T23:59:59.999Z`) : new Date();
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return Response.json({ error: 'Datas inválidas.' }, { status: 400 });
    }

    const rows = (await runWithTenant(access.tenantId, (tx) => tx.rhTimeEntry.findMany({
      where: { tenantId: access.tenantId, occurredAt: { gte: from, lte: to } },
      include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true, shift: { select: { startTime: true, toleranceMinutes: true } } } } },
      orderBy: { occurredAt: 'asc' },
      take: 5000,
    }), { userId: access.userId })) as any[];

    const csv = toCsv(
      ['data', 'hora', 'numero', 'funcionario', 'tipo', 'atraso_min', 'origem'],
      rows.map((entry) => [
        new Date(entry.occurredAt).toISOString().slice(0, 10),
        new Date(entry.occurredAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Luanda' }),
        entry.employee.employeeNumber,
        `${entry.employee.firstName} ${entry.employee.lastName}`,
        entry.type,
        entry.type === 'ENTRADA' ? lateMinutesFor(entry.occurredAt, entry.employee.shift) : 0,
        entry.source,
      ]),
    );
    return csvResponse('assiduidade.csv', csv);
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return Response.json(body, { status });
  }
}
