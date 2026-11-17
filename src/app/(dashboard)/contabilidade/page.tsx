import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function ContabilidadePage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const entries = await prisma.journalEntry.findMany({
    where: { tenantId },
    orderBy: [{ postedOnDate: 'desc' }, { createdAt: 'desc' }],
    take: 50,
    include: {
      lines: {
        include: { account: { select: { code: true, name: true } } },
      },
    },
  });

  const totalDebit = entries.reduce((sum: number, e: any) => sum + e.lines.reduce((s: number, l: any) => s + Number(l.debit), 0), 0);
  const totalCredit = entries.reduce((sum: number, e: any) => sum + e.lines.reduce((s: number, l: any) => s + Number(l.credit), 0), 0);
  const fmt = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#708195]">Contabilidade</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Diário contabilístico</h2>
          <p className="mt-2 text-sm text-[#708195]">Lançamentos contabilísticos com débitos e créditos. Cada lançamento é imutável após confirmação; correções via estorno.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/api/contabilidade/export?type=diario" className="rounded-xl border border-[#e2e9f1] bg-white px-4 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Exportar CSV</a>
          <Link href="/contabilidade/plano-contas" className="rounded-xl border border-[#e2e9f1] bg-white px-4 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Plano de contas</Link>
          <Link href="/contabilidade/balancete" className="rounded-xl border border-[#e2e9f1] bg-white px-4 py-2 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff]">Balancete</Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Lançamentos</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{entries.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Total débitos</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{fmt(totalDebit)}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Total créditos</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{fmt(totalCredit)}</p>
        </div>
      </div>

      {Math.abs(totalDebit - totalCredit) > 0.001 && (
        <p role="alert" className="border-l-4 border-[#a83939] bg-[#fff4f4] px-4 py-2 text-xs font-semibold text-[#a83939]">Débitos ({fmt(totalDebit)}) ≠ Créditos ({fmt(totalCredit)}) — os lançamentos estão desequilibrados. Contacte o contador.</p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
        <div className="border-b border-[#e7edf3] px-5 py-4">
          <h3 className="font-bold text-[#1c2d3f]">Últimos 50 lançamentos</h3>
        </div>
        {entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#708195]">Sem lançamentos registados.</div>
        ) : (
          <ul className="divide-y divide-[#edf1f5]">
            {entries.map((entry: any) => {
              const lines = entry.lines;
              const totalLine = (lines as any[]).reduce((s: number, l: any) => s + Number(l.debit), 0);
              return (
                <li key={entry.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="tabular-nums text-xs font-semibold text-[#708195]">{entry.postedOnDate.toISOString().slice(0, 10)}</span>
                      <strong className="ml-2 tabular-nums text-sm text-[#1c2d3f]">{entry.number}</strong>
                      <span className="ml-2 rounded-full bg-[#f0f4f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#2878d0]">{entry.entryType}</span>
                    </div>
                    <span className="tabular-nums text-sm font-bold text-[#1c2d3f]">{fmt(totalLine)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#627068]">{entry.description}</p>
                  <div className="mt-2 grid gap-1 text-[11px] text-[#627068]">
                    {lines.map((l: any) => (
                      <div key={l.id} className="grid grid-cols-[60px_1fr_80px] gap-2">
                        <span className="tabular-nums font-semibold text-[#1c2d3f]">{l.account?.code}</span>
                        <span className="truncate">{l.account?.name}{l.memo ? ` — ${l.memo}` : ''}</span>
                        <span className="text-right tabular-nums">{Number(l.debit) > 0 ? fmt(Number(l.debit)) : fmt(Number(l.credit))}{Number(l.debit) > 0 ? ' D' : ' C'}</span>
                      </div>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
