import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export default async function AuditoriaPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const [history, entries, auditEvents] = await Promise.all([
    prisma.glAccountHistory.findMany({
      where: { tenantId },
      orderBy: { changedAt: 'desc' },
      take: 100,
      include: { account: { select: { code: true, name: true } } },
    }),
    prisma.journalEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { lines: true },
    }),
    prisma.auditEvent.findMany({
      where: { tenantId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      select: { action: true, entity: true, entityId: true, result: true, justification: true, correlationId: true, occurredAt: true },
    }),
  ]);

  const fmt = new Intl.DateTimeFormat('pt-AO', { dateStyle: 'short', timeStyle: 'short' });
  const money = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Auditoria</h2>
        <p className="mt-2 text-sm text-[#708195]">Eventos contabilísticos recentes — criação/alteração de contas, lançamentos contabilísticos. Inclui apenas dados desta empresa.</p>
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#e2e9f1] bg-white overflow-hidden">
          <div className="border-b border-[#e7edf3] px-5 py-4">
            <h3 className="font-bold text-[#1c2d3f]">Alterações ao plano de contas</h3>
            <p className="mt-1 text-xs text-[#708195]">Quem criou/alterou/desactivou cada conta.</p>
          </div>
          {history.length === 0 ? (
            <p className="p-5 text-xs text-[#708195]">Sem alterações registadas.</p>
          ) : (
            <ul className="divide-y divide-[#edf1f5]">
              {history.map((h: any) => (
                <li key={h.id} className="px-5 py-3 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <strong className="text-[#1c2d3f]">{h.account?.code} — {h.account?.name}</strong>
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#2878d0]">{h.action}</span>
                    </div>
                    <span className="text-[#708195]">{fmt.format(h.changedAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[#e2e9f1] bg-white overflow-hidden">
          <div className="border-b border-[#e7edf3] px-5 py-4">
            <h3 className="font-bold text-[#1c2d3f]">Lançamentos contabilísticos</h3>
            <p className="mt-1 text-xs text-[#708195]">Os últimos 100 lançamentos com tipo, valor e origem.</p>
          </div>
          {entries.length === 0 ? (
            <p className="p-5 text-xs text-[#708195]">Sem lançamentos.</p>
          ) : (
            <ul className="divide-y divide-[#edf1f5]">
              {entries.map((e: any) => {
                const total = (e.lines as any[]).reduce((s: number, l: any) => s + Number(l.debit), 0);
                return (
                  <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-xs">
                    <div className="min-w-0">
                      <p className="tabular-nums font-semibold text-[#1c2d3f]"><span className="text-[#708195]">{e.postedOnDate.toISOString().slice(0, 10)}</span> · {e.number}</p>
                      <p className="truncate text-[#627068]">{e.description} · {e.source ?? '—'}</p>
                    </div>
                    <span className="tabular-nums font-bold text-[#1c2d3f]">{money(total)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e2e9f1] bg-white overflow-hidden">
        <div className="border-b border-[#e7edf3] px-5 py-4">
          <h3 className="font-bold text-[#1c2d3f]">Audit log (A12/A13) — hash-chained</h3>
          <p className="mt-1 text-xs text-[#708195]">FT, NC, apuramento, abertura, exportações. Cada evento liga-se ao anterior; tamper-evident, não tamper-proof.</p>
        </div>
        {auditEvents.length === 0 ? (
          <p className="p-5 text-xs text-[#708195]">Sem eventos.</p>
        ) : (
          <ul className="divide-y divide-[#edf1f5]">
            {auditEvents.map((a: any, i: number) => (
              <li key={i} className="grid grid-cols-[auto_auto_1fr_auto] items-baseline gap-3 px-5 py-2 text-xs">
                <span className="font-mono text-[#708195]">{new Date(a.occurredAt).toISOString().slice(0, 16).replace('T', ' ')}</span>
                <span className="font-mono font-bold text-[#2878d0]">{a.action}</span>
                <span className="truncate text-[#1c2d3f]">{a.entity} · {a.entityId?.slice(0, 12) ?? '—'}{a.justification ? ` · ${a.justification.slice(0, 40)}` : ''}</span>
                <span className={`text-[10px] font-bold ${a.result === 'SUCCESS' ? 'text-emerald-700' : 'text-red-700'}`}>{a.result}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-[#708195]">Hash chain per tenant (SHA-256 + previousHash). Tamper-EVIDENT, not tamper-PROOF.</p>
    </div>
  );
}
