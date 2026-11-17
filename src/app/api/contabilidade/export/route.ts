import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

function csvEscape(s: string): string {
  if (s.includes(';') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function GET(req: NextRequest) {
  const tenantId = await getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const type = sp.get('type') ?? 'razao';
  const accountCode = sp.get('accountCode') ?? null;
  const exerciseCode = sp.get('exerciseCode') ?? null;
  const periodCode = sp.get('periodCode') ?? null;

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
  const tenantName = tenant?.name ?? '';

  let rows: string[][] = [];

  if (type === 'razao') {
    const accounts = accountCode
      ? await prisma.glAccount.findMany({ where: { tenantId, code: accountCode }, select: { id: true, code: true, name: true } })
      : await prisma.glAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
    rows.push([`Empresa: ${tenantName}`, `Tipo: Razão por conta`, new Date().toISOString().slice(0, 10)]);
    rows.push(['Conta', 'Nome', 'Data', 'Lançamento', 'Descrição', 'Origem', 'Débito', 'Crédito', 'Saldo']);
    let running = 0;
    for (const acc of accounts) {
      const lines = await prisma.journalEntryLine.findMany({
        where: { tenantId, accountId: acc.id },
        orderBy: { entry: { postedOnDate: 'asc' } },
        include: { entry: { select: { number: true, postedOnDate: true, description: true, source: true, sourceId: true } } },
      });
      running = 0;
      for (const l of lines) {
        running += Number(l.debit) - Number(l.credit);
        rows.push([acc.code, acc.name, (l as any).entry.postedOnDate.toISOString().slice(0, 10), (l as any).entry.number, (l as any).entry.description, (l as any).entry.source ?? '', String(l.debit), String(l.credit), String(running)]);
      }
    }
  } else if (type === 'balancete') {
    const accounts = await prisma.glAccount.findMany({ where: { tenantId, isActive: true }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } });
    const grouped = await prisma.journalEntryLine.groupBy({ by: ['accountId'], where: { tenantId }, _sum: { debit: true, credit: true } });
    const idMap = new Map<string, { debit: number; credit: number }>(grouped.map((g: any) => [g.accountId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));
    rows.push([`Empresa: ${tenantName}`, `Tipo: Balancete`, new Date().toISOString().slice(0, 10)]);
    rows.push(['Conta', 'Nome', 'Débito', 'Crédito', 'Saldo']);
    for (const a of accounts) {
      const sum = idMap.get(a.id) ?? { debit: 0, credit: 0 };
      const net = sum.debit - sum.credit;
      rows.push([a.code, a.name, String(sum.debit), String(sum.credit), String(net)]);
    }
  } else if (type === 'diario') {
    const entries = await prisma.journalEntry.findMany({
      where: { tenantId },
      orderBy: [{ postedOnDate: 'desc' }, { number: 'desc' }],
      take: 100,
      include: { lines: true },
    });
    rows.push([`Empresa: ${tenantName}`, `Tipo: Diário contabilístico`, new Date().toISOString().slice(0, 10)]);
    rows.push(['Data', 'Lançamento', 'Descrição', 'Débito', 'Crédito', 'Origem']);
    for (const e of entries) {
      const debit = e.lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
      const credit = e.lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
      rows.push([e.postedOnDate.toISOString().slice(0, 10), e.number, e.description, String(debit), String(credit), e.source ?? '']);
    }
  } else {
    return NextResponse.json({ error: 'unknown_type' }, { status: 400 });
  }

  const csv = rows.map((r) => r.map(csvEscape).join(';')).join('\r\n');
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
