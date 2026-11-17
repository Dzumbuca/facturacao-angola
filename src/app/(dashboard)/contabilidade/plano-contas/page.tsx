import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { AccountActions } from './account-actions';

export default async function PlanoContasPage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) redirect('/onboarding');

  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true },
    orderBy: { code: 'asc' },
    select: { id: true, code: true, name: true, kind: true, nature: true, synthetic: true, parentId: true },
  });

  const groups = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
  const labels: Record<string, string> = {
    ASSET: 'Activos',
    LIABILITY: 'Passivos',
    EQUITY: 'Capital próprio',
    REVENUE: 'Rendimentos',
    EXPENSE: 'Gastos',
  };
  const grouped: Record<string, typeof accounts> = Object.fromEntries(groups.map((g) => [g, []]));
  for (const acc of accounts) {
    const k = (acc.kind as string).toUpperCase();
    if (grouped[k]) grouped[k].push(acc);
  }

  return (
    <div className="space-y-8 pb-10">
      <div>
        <p className="text-sm text-[#708195]">Contabilidade</p>
        <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Plano de contas</h2>
        <p className="mt-2 text-sm text-[#708195]">Criação, edição e desactivação de contas. As alterações são registadas na auditoria.</p>
        <a href="/contabilidade/plano-contas/importar" className="mt-2 inline-block text-xs font-semibold text-[#2878d0] hover:underline">Importar plano via CSV</a>
      </div>

      <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5">
        <AccountActions accounts={accounts} />
      </section>

      {groups.map((group) => (
        <section key={group} className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white">
          <div className="border-b border-[#e7edf3] px-5 py-3 flex items-center justify-between">
            <h3 className="font-bold text-[#1c2d3f]">{labels[group] ?? group}</h3>
            <span className="text-xs font-semibold text-[#708195]">{grouped[group]?.length ?? 0} contas</span>
          </div>
          <ul className="divide-y divide-[#edf1f5]">
            {(grouped[group] ?? []).length === 0 ? (
              <li className="px-5 py-4 text-xs text-[#708195]">Sem contas nesta classe.</li>
            ) : (
              grouped[group].map((acc: any) => (
                <li key={acc.id} className="grid grid-cols-[80px_1fr_auto] gap-3 px-5 py-3">
                  <span className="font-mono text-xs font-bold text-[#2878d0]">{acc.code}{acc.synthetic ? ' (sint.)' : ''}</span>
                  <span className="text-sm text-[#1c2d3f]">{acc.name}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#708195]">{acc.kind}{acc.nature ? ` · ${acc.nature}` : ''}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
