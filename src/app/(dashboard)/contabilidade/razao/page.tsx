import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function RazaoPage({ searchParams }: { searchParams: Promise<{ accountCode?: string; exerciseCode?: string; periodCode?: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const sp = await searchParams;
  const accountCode = sp.accountCode ?? null;
  const exerciseCode = sp.exerciseCode ?? null;
  const periodCode = sp.periodCode ?? null;

  const [accounts, exercises] = await Promise.all([
    prisma.glAccount.findMany({ where: { tenantId, isActive: true }, select: { id: true, code: true, name: true, kind: true }, orderBy: { code: 'asc' } }),
    prisma.accountingExercise.findMany({ where: { tenantId }, orderBy: { year: 'desc' }, select: { id: true, year: true, state: true } }),
  ]);

  const filterId = accountCode ?? (accounts[0]?.code ?? '');
  const selExercise = exerciseCode ? exercises.find((e: any) => String((e as any).year) === exerciseCode) : exercises[0];
  const periods = selExercise ? await prisma.accountingPeriod.findMany({ where: { tenantId, exerciseId: selExercise.id }, orderBy: { code: 'asc' } }) : [];
  const selPeriod = periodCode ? periods.find((p: any) => (p as any).code === periodCode) : null;

  // Opening balance = sum of (debit-credit) of lines BEFORE the selected period/exercise (per account)
  let openingBalance = 0;
  if (filterId) {
    const selected = await prisma.glAccount.findFirst({ where: { tenantId, code: filterId } });
    if (selected) {
      const beforeCursor = selPeriod?.startDate ?? (selExercise ? new Date(Date.UTC(selExercise.year, 0, 1)) : new Date(0));
      const opening = await prisma.journalEntryLine.aggregate({
        _sum: { debit: true, credit: true },
        where: { tenantId, accountId: selected.id, entry: { postedOnDate: { lt: beforeCursor } } },
      });
      openingBalance = Number(opening._sum.debit ?? 0) - Number(opening._sum.credit ?? 0);
    }
  }

  const accountEntries: any[] = [];
  let totalDebit = 0, totalCredit = 0, running = openingBalance;
  if (filterId) {
    const selected = await prisma.glAccount.findFirst({ where: { tenantId, code: filterId } });
    if (selected) {
      const lines = await prisma.journalEntryLine.findMany({
        where: {
          tenantId, accountId: selected.id,
          ...(selPeriod ? { entry: { postedOnDate: { gte: selPeriod.startDate, lte: selPeriod.endDate } } }
            : selExercise ? { entry: { postedOnDate: { gte: new Date(Date.UTC(selExercise.year, 0, 1)), lte: new Date(Date.UTC(selExercise.year, 11, 31, 23, 59, 59)) } } } : {}),
        },
        orderBy: { entry: { postedOnDate: 'asc' } },
        include: { entry: { select: { id: true, number: true, postedOnDate: true, description: true, source: true, sourceId: true, status: true } } },
      });
      for (const l of lines) {
        running += Number(l.debit) - Number(l.credit);
        totalDebit += Number(l.debit);
        totalCredit += Number(l.credit);
        accountEntries.push({ ...l, balance: running });
      }
    }
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(v);
  const selExerciseLabel = selExercise ? `${selExercise.year} (${selExercise.state})` : 'todos os exercícios';
  const selPeriodLabel = selPeriod ? selPeriod.code : 'todos os períodos';

  return (
    <div className="space-y-6 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Razão por conta</h2>
        <p className="mt-1 text-xs text-[#708195]">Intervalo: <strong>{selExerciseLabel} · {selPeriodLabel}</strong></p>
      </div>

      <div className="flex justify-end">
        <a href={`/api/contabilidade/export?type=razao&accountCode=${encodeURIComponent(filterId ?? '')}`} className="rounded-xl border border-[#e2e9f1] bg-white px-3 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Exportar CSV</a><a href={`/api/contabilidade/export/xlsx?type=razao&accountCode=${encodeURIComponent(filterId ?? '')}`} className="rounded-xl border border-[#e2e9f1] bg-white px-3 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Exportar Excel</a>
      </div>

      <form action="/contabilidade/razao" method="get" className="flex flex-wrap items-center gap-2">
        <select name="accountCode" defaultValue={filterId ?? ''} className="h-9 max-w-[280px] rounded-xl border border-[#e2e9f1] bg-[#f7fbff] px-3 text-sm">
          {accounts.map((a: any) => <option key={a.code} value={a.code}>{a.code} — {a.name}</option>)}
        </select>
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
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Saldo inicial</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt(openingBalance)}</p>
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
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Saldo final</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt(running)}</p>
        </div>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white">
        <table className="w-full text-xs">
          <thead className="bg-[#f7f9fc] text-[#607286]">
            <tr><th className="p-3 text-left">Data</th><th className="p-3 text-left">Nº</th><th className="p-3 text-left">Origem</th><th className="p-3 text-left">Descrição</th><th className="p-3 text-right">Débito</th><th className="p-3 text-right">Crédito</th><th className="p-3 text-right">Saldo</th></tr>
          </thead>
          <tbody>
            {accountEntries.length === 0 ? <tr><td className="p-6 text-center text-[#708195]" colSpan={7}>Sem lançamentos neste intervalo.</td></tr> : accountEntries.map((l) => (
              <tr key={l.id} className="border-t border-[#edf1f5]">
                <td className="p-3 text-[#708195]">{l.entry.postedOnDate.toISOString().slice(0, 10)}</td>
                <td className="p-3 font-mono text-[#2878d0]">{l.entry.number}</td>
                <td className="p-3 text-[#627068]">{l.entry.source ?? '—'}{l.entry.sourceId ? `:${l.entry.sourceId.slice(0, 8)}…` : ''}</td>
                <td className="p-3 text-[#1c2d3f]">{l.entry.description}</td>
                <td className="p-3 text-right tabular-nums">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : '—'}</td>
                <td className="p-3 text-right tabular-nums">{Number(l.credit) > 0 ? fmt(Number(l.credit)) : '—'}</td>
                <td className="p-3 text-right tabular-nums font-bold text-[#1c2d3f]">{fmt(l.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
