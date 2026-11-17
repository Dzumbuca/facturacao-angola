import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { runReconciliation, listRecentReconciliations } from '@/lib/reconciliation-service';
import { ReconciliationRunButton } from './run-button';

const severityColour: Record<string, string> = { HIGH: 'text-[#a83939]', MEDIUM: 'text-[#8a5a10]', LOW: 'text-[#708195]' };

export default async function ReconciliarPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const { runs, issues } = await listRecentReconciliations(tenantId, 5);
  const openIssues = issues.filter((i: any) => i.state === 'OPEN');
  const fmt = (v: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Math.round(v));

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-[#708195]">Contabilidade</p>
          <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Reconciliação</h2>
          <p className="mt-2 text-sm text-[#708195]">Compara documentos e lançamentos contabilísticos. Apresenta divergências sem corrigir automaticamente — todo o ajuste exige intervenção explícita.</p>
        </div>
        <ReconciliationRunButton />
      </div>

      {runs.length === 0 ? (
        <section className="rounded-2xl border border-[#e2e9f1] bg-white p-6 text-center">
          <p className="text-sm text-[#708195]">Nenhuma reconciliação executada ainda. Clique em <strong>Executar reconciliação</strong> acima.</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-[#e2e9f1] bg-white p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#708195]">Última execução</p>
          <div className="mt-1 flex flex-wrap gap-4 text-xs text-[#627068]">
            <span>Iniciada: {runs[0].startedAt.toISOString().slice(0, 19).replace('T', ' ')}</span>
            <span>Regras: {runs[0].rulesClaimed}</span>
            <span>Divergências encontradas: {runs[0].issuesFound}</span>
            <span>Estado: {runs[0].status}</span>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
        <div className="border-b border-[#e7edf3] px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-[#1c2d3f]">Divergências em aberto ({openIssues.length})</h3>
        </div>
        {openIssues.length === 0 ? (
          <div className="space-y-3 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-[#227958]">Nenhuma divergência em aberto. ✓</p>
            <p className="text-xs text-[#708195]">{issues.length > 0 ? 'Todas as anteriores foram marcadas como resolvidas.' : 'Nenhuma divergência detectada na última execução.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#edf1f5]">
            {openIssues.map((i: any) => (
              <li key={i.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className={`tabular-nums text-[10px] font-bold uppercase tracking-wider rounded-full bg-white border px-2 py-0.5 ${severityColour[i.severity] ?? severityColour.MEDIUM}`}>{i.severity}</span>
                    <span className="ml-2 text-[10px] text-[#708195]">{i.issueType}</span>
                  </div>
                  <span className="tabular-nums text-xs text-[#708195]">{i.value != null ? fmt(Number(i.value)) : '—'}</span>
                </div>
                <p className="mt-2 text-sm text-[#1c2d3f]">{i.description}</p>
                <p className="mt-1 text-[10px] text-[#708195]">Criada {i.createdAt.toISOString().slice(0, 19).replace('T', ' ')}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
