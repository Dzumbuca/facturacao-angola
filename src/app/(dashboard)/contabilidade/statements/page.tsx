import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ exerciseCode?: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const sp = await searchParams;
  const exerciseCode = sp.exerciseCode ?? null;

  const exercises = await prisma.accountingExercise.findMany({ where: { tenantId }, select: { id: true, year: true, state: true }, orderBy: { year: 'desc' } });
  const selExercise = exerciseCode ? exercises.find((e: any) => String((e as any).year) === exerciseCode) : exercises[0];

  // Opening balance from previous exercise(s): lines with postedOnDate < exercise start
  const startCursor = selExercise ? new Date(Date.UTC(selExercise.year, 0, 1)) : new Date(0);
  const endCursor = selExercise ? new Date(Date.UTC(selExercise.year, 11, 31, 23, 59, 59)) : new Date();

  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, code: true, name: true, kind: true, synthetic: true },
  });

  // Aggregate per account
  const periodLines = await prisma.journalEntryLine.findMany({
    where: { tenantId, entry: { status: 'POSTED', postedOnDate: { gte: startCursor, lte: endCursor } } },
    select: { accountId: true, debit: true, credit: true },
  });
  const openingLines = await prisma.journalEntryLine.findMany({
    where: { tenantId, entry: { status: 'POSTED', postedOnDate: { lt: startCursor } } },
    select: { accountId: true, debit: true, credit: true },
  });

  const periodMap = new Map<string, { debit: number; credit: number }>();
  for (const l of periodLines) {
    const cur = periodMap.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    periodMap.set(l.accountId, cur);
  }
  const openingMap = new Map<string, { debit: number; credit: number }>();
  for (const l of openingLines) {
    const cur = openingMap.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    openingMap.set(l.accountId, cur);
  }

  // Compute statements per classification template: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  const tally = (kind: string) => {
    let asset = 0, liability = 0, equity = 0, revenue = 0, expense = 0;
    for (const acc of accounts) {
      if (acc.synthetic) continue;
      const k = (acc.kind as string).toUpperCase();
      const op = (openingMap.get(acc.id)?.debit ?? 0) - (openingMap.get(acc.id)?.credit ?? 0);
      const p = (periodMap.get(acc.id)?.debit ?? 0) - (periodMap.get(acc.id)?.credit ?? 0);
      // Naturally signed balance per kind
      const natural = (k === 'ASSET' || k === 'EXPENSE') ? op + p : -(op + p); // debit-natural or credit-natural
      if (k === 'ASSET') asset += natural;
      else if (k === 'LIABILITY') liability += natural;
      else if (k === 'EQUITY') equity += natural;
      else if (k === 'REVENUE') revenue += natural;
      else if (k === 'EXPENSE') expense += natural;
    }
    return { asset, liability, equity, revenue, expense };
  };

  const ctx = tally('');
  const totalRevenue = ctx.revenue, totalExpenses = ctx.expense, resultado = totalRevenue - totalExpenses;
  const totalAssets = ctx.asset;
  const totalLiabilities = ctx.liability;
  const totalEquity = ctx.equity;
  const balanceOK = Math.abs(totalAssets - (totalLiabilities + totalEquity + resultado)) < 0.10;

  // Identify unclassified accounts
  const validKinds = new Set(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
  const unclassified = accounts.filter((a: any) => !validKinds.has((a.kind as string).toUpperCase()));

  const fmt = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Balanço e Demonstração de resultados</h2>
        <p className="mt-1 text-xs text-[#708195]">Exercício: <strong>{selExercise ? `${selExercise.year} (${selExercise.state})` : 'todos'}</strong> · Entregável estimativa; não contém validação AGT</p>
      </div>

      <form action="/contabilidade/statements" method="get" className="flex flex-wrap items-center gap-2">
        <select name="exerciseCode" defaultValue={String(selExercise?.year ?? '')} className="h-9 rounded-xl border border-[#e2e9f1] bg-[#f7fbff] px-3 text-sm">
          {exercises.map((e: any) => <option key={e.id} value={e.year}>{e.year} — {e.state}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white hover:bg-[#011566]">Filtrar</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Activo</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(totalAssets)}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Passivo</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(totalLiabilities)}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Capital próprio</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(totalEquity)}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${balanceOK ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Resultado (Activo − P − CP)</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(totalAssets - totalLiabilities - totalEquity)}</p>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5">
          <h3 className="font-bold text-[#1c2d3f]">Balanço</h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr><td className="py-2 text-[#1c2d3f]">Activo total</td><td className="text-right tabular-nums">{fmt.format(totalAssets)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Passivo total</td><td className="text-right tabular-nums">{fmt.format(totalLiabilities)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Capital próprio</td><td className="text-right tabular-nums">{fmt.format(totalEquity)}</td></tr>
              <tr><td className="py-2 font-semibold text-[#1c2d3f]">Passivo + Capital próprio</td><td className="text-right tabular-nums font-bold text-[#1c2d3f]">{fmt.format(totalLiabilities + totalEquity)}</td></tr>
            </tbody>
          </table>
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${balanceOK ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {balanceOK ? 'Equação contabilística verificada (Activo ≈ Passivo + Capital próprio + Resultado)' : 'Equação NÃO verificada. Contacte o contabilista.'}
          </div>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5">
          <h3 className="font-bold text-[#1c2d3f]">Demonstração de resultados</h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr><td className="py-2 text-[#1c2d3f]">Rendimentos</td><td className="text-right tabular-nums">{fmt.format(totalRevenue)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Gastos</td><td className="text-right tabular-nums">{fmt.format(totalExpenses)}</td></tr>
              <tr><td className="py-2 font-semibold text-[#1c2d3f]">Resultado</td><td className={`text-right tabular-nums font-bold ${resultado >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt.format(resultado)}</td></tr>
            </tbody>
          </table>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Estimativa. Não é apresentação financeira oficial. Para fins fiscais (AGT), é necessária a validação de contabilista competente em Angola.
          </div>
        </div>
      </section>

      {unclassified.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-bold text-amber-800">Contas sem classificação reconhecida ({unclassified.length})</h3>
          <p className="mt-1 text-xs text-amber-900">Estas contas não são agregadas no Balanço nem na DRE. Defina a classificação (kind: ASSET, LIABILITY, EQUITY, REVENUE ou EXPENSE).</p>
          <ul className="mt-2 grid gap-1 text-[11px] text-amber-900">
            {unclassified.map((u: any) => (
              <li key={u.id} className="font-mono">{u.code} — {u.name} <span className="text-amber-700">(kind: {u.kind ?? '—'})</span></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

