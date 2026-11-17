import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function StatementsPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true, synthetic: false },
    include: {
      lines: { select: { debit: true, credit: true, entry: { select: { status: true } } } },
    },
  });

  const compute = (kind: string) => {
    let totalDebit = 0, totalCredit = 0;
    for (const acc of accounts as any[]) {
      if ((acc.kind as string).toUpperCase() !== kind) continue;
      for (const line of acc.lines) {
        if ((line.entry as any).status && line.entry.status !== 'POSTED') continue;
        totalDebit += Number(line.debit);
        totalCredit += Number(line.credit);
      }
    }
    return { debit: totalDebit, credit: totalCredit, net: totalDebit - totalCredit };
  };

  const assets = compute('ASSET');
  const liabilities = compute('LIABILITY');
  const equity = compute('EQUITY');
  const revenue = compute('REVENUE');
  const expenses = compute('EXPENSE');

  const totalAssets = assets.debit;  // assets naturally have debit balance
  const totalLiabilities = liabilities.credit;
  const totalEquity = equity.credit;
  const totalRevenue = revenue.credit;
  const totalExpenses = expenses.debit;
  const resultado = totalRevenue - totalExpenses;

  const balanceOK = Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.10;
  const fmt = new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Balanço e Demonstração de resultados</h2>
        <p className="mt-2 text-sm text-[#708195]">Estimativa com base nas lançamentos confirmados. Não é apresentação oficial; AGT compliance requires external validation.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-5">
          <h3 className="font-bold text-[#1c2d3f]">Balanço</h3>
          <table className="mt-3 w-full text-sm">
            <tbody>
              <tr><td className="py-2 font-semibold text-[#1c2d3f]">Activo</td><td className="text-right tabular-nums">{fmt.format(totalAssets)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Passivo</td><td className="text-right tabular-nums">{fmt.format(totalLiabilities)}</td></tr>
              <tr><td className="py-2 text-[#1c2d3f]">Capital próprio</td><td className="text-right tabular-nums">{fmt.format(totalEquity)}</td></tr>
              <tr><td className="py-2 font-semibold text-[#1c2d3f]">Passivo + Capital próprio</td><td className="text-right tabular-nums font-bold text-[#1c2d3f]">{fmt.format(totalLiabilities + totalEquity)}</td></tr>
            </tbody>
          </table>
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${balanceOK ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {balanceOK ? 'Equação contabilística verificada: Activo = Passivo + Capital próprio' : 'Equação NÃO verificada — ver com contabilista. Contabilidade inconsistente.'}
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
            Não é uma demonstração financeira oficial. Para fins fiscais (AGT), é necessária a validação de um contabilista competente em Angola.
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e2e9f1] bg-white overflow-hidden">
        <div className="border-b border-[#e7edf3] px-5 py-4">
          <h3 className="font-bold text-[#1c2d3f]">Contas identificadas</h3>
          <p className="text-xs text-[#708195]">Apenas contas activas com linhas contabilísticas e não sintéticas.</p>
        </div>
        <ul className="divide-y divide-[#edf1f5]">
          {accounts.length === 0 ? <li className="p-5 text-xs text-[#708195]">Sem contas activas.</li> : accounts.map((a: any) => (
            <li key={a.id} className="grid grid-cols-[80px_1fr_auto] items-baseline gap-3 px-5 py-3 text-xs">
              <span className="font-mono font-bold text-[#2878d0]">{a.code}</span>
              <span className="truncate text-[#1c2d3f]">{a.name}</span>
              <span className="text-[#708195]">{a.kind}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
