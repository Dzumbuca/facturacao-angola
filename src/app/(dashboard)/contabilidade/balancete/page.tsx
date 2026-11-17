import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function BalancetePage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: 'asc' },
    include: {
      lines: {
        select: { debit: true, credit: true, entry: { select: { status: true, entryType: true } } },
      },
    },
  });

  // Filter lines to POSTED entries only (ignore future 'REVERSED' for balance)
  const rows = accounts.map((acc: any) => {
    let debit = 0, credit = 0;
    for (const line of acc.lines) {
      if (line.entry?.status !== 'POSTED' && line.entry?.status !== undefined) continue;
      debit += Number(line.debit);
      credit += Number(line.credit);
    }
    const balance = debit - credit;
    return { code: acc.code, name: acc.name, kind: acc.kind, synthetic: acc.synthetic, debit, credit, balance };
  });

  const totalDebit = rows.reduce((s: number, r: any) => s + r.debit, 0);
  const totalCredit = rows.reduce((s: number, r: any) => s + r.credit, 0);
  const fmt = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Balancete</h2>
        <p className="mt-2 text-sm text-[#708195]">Lista de todas as contas com a soma de débitos, créditos e saldo. Dá uma visão da situação contabilística da empresa.</p>
      </div>

      <div className="rounded-2xl border border-[#e2e9f1] bg-white px-4 py-3 text-sm">
        <span className="text-[#708195]">Débitos totais:</span> <strong className="tabular-nums">{fmt(totalDebit)}</strong> {' · '}
        <span className="text-[#708195]">Créditos totais:</span> <strong className="tabular-nums">{fmt(totalCredit)}</strong> {' · '}
        <span className="text-[#708195]">Diferença:</span> <strong className={`tabular-nums ${Math.abs(totalDebit - totalCredit) > 0.001 ? 'text-[#a83939]' : 'text-[#227958]'}`}>{fmt(totalDebit - totalCredit)}</strong>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#f7f9fc] text-[#607286]">
            <tr>
              <th className="p-3 text-left">Código</th>
              <th className="p-3 text-left">Nome</th>
              <th className="p-3 text-left">Tipo</th>
              <th className="p-3 text-right">Débito</th>
              <th className="p-3 text-right">Crédito</th>
              <th className="p-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.code} className="border-t border-[#edf1f5]">
                <td className="p-3 font-mono text-[#1c2d3f]">{r.code}{r.synthetic ? ' (sint.)' : ''}</td>
                <td className="p-3 text-[#1c2d3f]">{r.name}</td>
                <td className="p-3 text-[#627068]">{r.kind}</td>
                <td className="p-3 text-right tabular-nums">{r.debit > 0 ? fmt(r.debit) : '—'}</td>
                <td className="p-3 text-right tabular-nums">{r.credit > 0 ? fmt(r.credit) : '—'}</td>
                <td className="p-3 text-right tabular-nums font-bold">{Math.abs(r.balance) > 0.001 ? (r.balance > 0 ? `D ${fmt(Math.abs(r.balance))}` : `C ${fmt(Math.abs(r.balance))}`) : '0'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
