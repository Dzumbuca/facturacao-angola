import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function RazaoPage({ searchParams }: { searchParams: Promise<{ accountCode?: string }> }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const sp = await searchParams;
  const accountCode = sp.accountCode ?? null;

  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: 'asc' },
    select: { code: true, name: true, kind: true },
  });

  const filterId = accountCode ?? (accounts[0]?.code ?? '');

  // Compute ledger totals per account for active in central position
  const totals = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: { tenantId },
    _sum: { debit: true, credit: true },
  });
  const idMap = new Map<string, { debit: number; credit: number }>();
  const accountByCode = new Map<string, typeof accounts[number]>();
  for (const acc of accounts as any[]) accountByCode.set(acc.code, acc);
  const inlined = await prisma.glAccount.findMany({ where: { tenantId, code: { in: Array.from(new Set(totals.map((t) => t.accountId))) } }, select: { id: true, code: true } });
  // filterId refers to code — but JournalEntryLine.accountId is GlAccount.id. Map GlAccount.id → code
  const idToCode = new Map<string, string>();
  const allAccounts = await prisma.glAccount.findMany({ where: { tenantId }, select: { id: true, code: true } });
  for (const a of allAccounts) idToCode.set(a.id, a.code);

  const ledgerByCode = new Map<string, { debit: number; credit: number }>();
  for (const t of totals) {
    const code = idToCode.get(t.accountId);
    if (code) ledgerByCode.set(code, { debit: Number(t._sum.debit ?? 0), credit: Number(t._sum.credit ?? 0) });
  }

  const fmt = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(Math.round(v * 100) / 100);

  // Filter to selected account and show its ledger entries
  let accountEntries: any[] = [];
  let openingBalance = 0, closingBalance = 0;
  if (filterId) {
    const selected = await prisma.glAccount.findFirst({ where: { tenantId, code: filterId } });
    if (selected) {
      const lines = await prisma.journalEntryLine.findMany({
        where: { tenantId, accountId: selected.id },
        orderBy: { entry: { postedOnDate: 'asc' } },
        include: { entry: { select: { id: true, number: true, postedOnDate: true, description: true, source: true, sourceId: true, status: true } } },
      });
      // compute running balance
      let running = 0;
      accountEntries = lines.map((l) => {
        running += Number(l.debit) - Number(l.credit);
        return { ...l, balance: running };
      });
      openingBalance = (selected as any).balance ?? 0;
      closingBalance = running;
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Razão por conta</h2>
        <p className="mt-2 text-sm text-[#708195]">Saldo inicial, movimentos a débito e crédito e saldo final da conta selecionada.</p>
      </div>

      <form id="filter-form" action="/contabilidade/razao" method="get" className="flex items-center gap-3">
        <label className="text-xs font-semibold text-[#627068]">Conta</label>
        <select name="accountCode" defaultValue={filterId} onChange={(e) => { (document.getElementById('filter-form') as HTMLFormElement)?.submit(); }} className="h-9 rounded-xl border border-[#e2e9f1] bg-[#f7fbff] px-3 text-sm">
          {accounts.map((a) => (
            <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
          ))}
        </select>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Lançamentos</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{accountEntries.length}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Total débitos</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{fmt(accountEntries.reduce((s: number, l: any) => s + Number(l.debit), 0))}</p>
        </div>
        <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Total créditos</p>
          <p className="mt-1 tabular-nums text-2xl font-extrabold text-[#1c2d3f]">{fmt(accountEntries.reduce((s: number, l: any) => s + Number(l.credit), 0))}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Saldo final</p>
        <p className="mt-1 tabular-nums text-3xl font-extrabold text-[#1c2d3f]">{fmt(closingBalance)}</p>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-[#e2e9f1] bg-white">
        <table className="w-full text-xs">
          <thead className="bg-[#f7f9fc] text-[#607286]">
            <tr>
              <th className="p-3 text-left">Data</th>
              <th className="p-3 text-left">Nº</th>
              <th className="p-3 text-left">Origem</th>
              <th className="p-3 text-left">Descrição</th>
              <th className="p-3 text-right">Débito</th>
              <th className="p-3 text-right">Crédito</th>
              <th className="p-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {accountEntries.length === 0 ? (
              <tr><td className="p-6 text-center text-sm text-[#708195] colspan=7" colSpan={7}>Sem lançamentos nesta conta.</td></tr>
            ) : accountEntries.map((l: any) => (
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
