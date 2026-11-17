import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function BalancetePage({ searchParams }: { searchParams: Promise<{ exerciseCode?: string; periodCode?: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const sp = await searchParams;
  const exerciseCode = sp.exerciseCode ?? null;
  const periodCode = sp.periodCode ?? null;

  const exercises = await prisma.accountingExercise.findMany({ where: { tenantId }, orderBy: { year: 'desc' }, select: { id: true, year: true, state: true } });
  const selExercise = exerciseCode ? exercises.find((e: any) => String((e as any).year) === exerciseCode) : exercises[0];
  const periods = selExercise ? await prisma.accountingPeriod.findMany({ where: { tenantId, exerciseId: selExercise.id }, orderBy: { code: 'asc' } }) : [];
  const selPeriod = periodCode ? periods.find((p: any) => (p as any).code === periodCode) : null;

  // Build filter for JE lines
  const lineWhere: any = { tenantId };
  if (selPeriod) lineWhere.entry = { postedOnDate: { gte: selPeriod.startDate, lte: selPeriod.endDate } };
  else if (selExercise) lineWhere.entry = { postedOnDate: { gte: new Date(Date.UTC(selExercise.year, 0, 1)), lte: new Date(Date.UTC(selExercise.year, 11, 31, 23, 59, 59)) } };

  // Aggregate per-account reflections
  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, kind: true, synthetic: true },
  });

  // Aggregate lines per account filtered
  const grouped = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: lineWhere,
    _sum: { debit: true, credit: true },
  });
  const idMap = new Map<string, { debit: number; credit: number }>(grouped.map((g: any) => [g.accountId, { debit: Number(g._sum.debit ?? 0), credit: Number(g._sum.credit ?? 0) }]));

  // Opening balances within the scope of the WHERE-filtered interval
  // (i.e., balance BEFORE selPeriod start, in absence of period filter we use exercise start)
  // We only compute the cursor based on the earliest selected boundary.
  const startCursor = selPeriod?.startDate ?? (selExercise ? new Date(Date.UTC(selExercise.year, 0, 1)) : new Date(0));

  const openingWhere: any = { tenantId, entry: { postedOnDate: { lt: startCursor } } };
  const openingGrouped = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: openingWhere,
    _sum: { debit: true, credit: true },
  });
  const openingMap = new Map<string, number>(openingGrouped.map((g: any) => [g.accountId, Number(g._sum.debit ?? 0) - Number(g._sum.credit ?? 0)]));

  const rows = accounts.map((acc: any) => {
    const debit = idMap.get(acc.id)?.debit ?? 0;
    const credit = idMap.get(acc.id)?.credit ?? 0;
    const opening = openingMap.get(acc.id) ?? 0;
    const closing = opening + debit - credit;
    return { ...acc, opening, debit, credit, closing };
  });

  const totalDebit = rows.reduce((s: number, r: any) => s + r.debit, 0);
  const totalCredit = rows.reduce((s: number, r: any) => s + r.credit, 0);
  const totalOpening = rows.reduce((s: number, r: any) => s + r.opening, 0);
  const totalClosing = rows.reduce((s: number, r: any) => s + r.closing, 0);
  const fmt = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(v);

  const selExerciseLabel = selExercise ? `${selExercise.year} (${selExercise.state})` : 'todos';
  const selPeriodLabel = selPeriod ? selPeriod.code : 'todos';

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Balancete</h2>
        <p className="mt-1 text-xs text-[#708195]">Intervalo: <strong>{selExerciseLabel} · {selPeriodLabel}</strong></p>
      </div>

      <div className="flex justify-end">
        <a href="/api/contabilidade/export?type=balancete" className="rounded-xl border border-[#e2e9f1] bg-white px-3 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Exportar CSV</a><a href="/api/contabilidade/export/xlsx?type=balancete" className="rounded-xl border border-[#e2e9f1] bg-white px-3 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Exportar Excel</a>
      </div>

      <form action="/contabilidade/balancete" method="get" className="flex flex-wrap items-center gap-2">
        <select name="exerciseCode" defaultValue={selExercise ? String(selExercise.year) : ''} className="h-9 rounded-xl border border-[#e2e9f1] bg-[#f7fbff] px-3 text-sm">
          <option value="">Todos os exercícios</option>
          {exercises.map((e: any) => <option key={e.id} value={e.year}>{e.year} — {e.state}</option>)}
        </select>
        <select name="periodCode" defaultValue={selPeriod ? selPeriod.code : ''} className="h-9 rounded-xl border border-[#e2e9f1] bg-[#f7fbff] px-3 text-sm">
          <option value="">Todos os períodos</option>
          {periods.map((p: any) => <option key={p.id} value={p.code}>{p.code} — {p.state}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white hover:bg-[#011566]">Filtrar</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Saldos iniciais</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt(totalOpening)}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Débitos</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt(totalDebit)}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Créditos</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt(totalCredit)}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Saldo total</p>
          <p className={`mt-1 tabular-nums text-xl font-extrabold ${Math.abs(totalDebit - totalCredit) > 0.001 ? 'text-[#a83939]' : 'text-[#227958]'}`}>{fmt(totalClosing)}</p>
        </div>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f9fc] text-[#607286]"><tr><th className="p-3 text-left">Código</th><th className="p-3 text-left">Nome</th><th className="p-3 text-left">Tipo</th><th className="p-3 text-right">Saldo inicial</th><th className="p-3 text-right">Débito</th><th className="p-3 text-right">Crédito</th><th className="p-3 text-right">Saldo final</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.id} className="border-t border-[#edf1f5]">
                <td className="p-3 font-mono text-[#1c2d3f]">{r.code}{r.synthetic ? ' (sint.)' : ''}</td>
                <td className="p-3 text-[#1c2d3f]">{r.name}</td>
                <td className="p-3 text-[#627068]">{r.kind}</td>
                <td className="p-3 text-right tabular-nums">{r.opening !== 0 ? fmt(r.opening) : '—'}</td>
                <td className="p-3 text-right tabular-nums">{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                <td className="p-3 text-right tabular-nums">{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                <td className="p-3 text-right tabular-nums font-bold text-[#1c2d3f]">{fmt(r.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
