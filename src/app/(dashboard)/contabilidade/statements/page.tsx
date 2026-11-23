import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { computeStatements } from '@/lib/accounting-statements';

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ exerciseCode?: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const sp = await searchParams;
  const exerciseCode = sp.exerciseCode ?? null;
  const exercises = await prisma.accountingExercise.findMany({ where: { tenantId }, select: { id: true, year: true, state: true }, orderBy: { year: 'desc' } });
  const selExercise = exerciseCode ? exercises.find((e: any) => String((e as any).year) === exerciseCode) : exercises[0];
  const year = selExercise?.year ?? new Date().getUTCFullYear();

  const totals = await computeStatements(tenantId, year);
  const { assets, liabilities, equity, revenue, expenses, result, balanceOK } = totals;

  const fmt = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#708195]">Contabilidade</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Balanço e Demonstração de resultados</h2>
          <p className="mt-1 text-xs text-[#708195]">Exercício: <strong>{selExercise ? `${selExercise.year} (${selExercise.state})` : 'todos'}</strong> · Estimativa sem certificação AGT</p>
        </div>
        <a href={`/api/contabilidade/export/pdf?year=${year}`} className="rounded-xl border border-[#e2e9f1] bg-white px-4 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Exportar PDF</a>
      </div>

      <form action="/contabilidade/statements" method="get" className="flex flex-wrap items-center gap-2">
        <select name="exerciseCode" defaultValue={String(selExercise?.year ?? '')} className="h-9 rounded-xl border border-[#e2e9f1] bg-[#f7fbff] px-3 text-sm">
          {exercises.map((e: any) => <option key={e.id} value={e.year}>{e.year} — {e.state}</option>)}
        </select>
        <button type="submit" className="h-9 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white hover:bg-[#011566]">Filtrar</button>
      </form>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Activo</p><p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(assets)}</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Passivo</p><p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(liabilities)}</p></div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Capital próprio</p><p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(equity)}</p></div>
        <div className={`rounded-2xl border p-4 ${balanceOK ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Resultado</p><p className="mt-1 tabular-nums text-xl font-extrabold text-[#1c2d3f]">{fmt.format(result)}</p></div>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5">
          <h3 className="font-bold text-[#1c2d3f]">Balanço</h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr><td className="py-2 text-[#1c2d3f]">Activo total</td><td className="text-right tabular-nums">{fmt.format(assets)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Passivo total</td><td className="text-right tabular-nums">{fmt.format(liabilities)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Capital próprio</td><td className="text-right tabular-nums">{fmt.format(equity)}</td></tr>
              <tr><td className="py-2 font-semibold text-[#1c2d3f]">Passivo + Capital próprio</td><td className="text-right tabular-nums font-bold text-[#1c2d3f]">{fmt.format(liabilities + equity)}</td></tr>
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
              <tr><td className="py-2 text-[#1c2d3f]">Rendimentos</td><td className="text-right tabular-nums">{fmt.format(revenue)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Gastos</td><td className="text-right tabular-nums">{fmt.format(expenses)}</td></tr>
              <tr><td className="py-2 font-semibold text-[#1c2d3f]">Resultado</td><td className={`text-right tabular-nums font-bold ${result >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt.format(result)}</td></tr>
            </tbody>
          </table>
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            Estimativa. Não é apresentação financeira oficial. Para fins fiscais (AGT), é necessária a validação de contabilista competente em Angola.
          </div>
        </div>
      </section>
    </div>
  );
}
