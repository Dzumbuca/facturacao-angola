import Link from 'next/link';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { rhFullName } from '@/lib/rh-service';
import { IconUsers, IconBuilding, IconCheckSquare, IconCurrency, IconFileText } from '@/components/rh/icons';
import { PremiumHero, PremiumKpi, PremiumPanel } from '@/components/dashboard/premium-kit';
import { MonthlyAdmissionsChart, type MonthAdmission } from '@/components/rh/monthly-admissions-chart';
import { EmptyState } from '@/components/ui/data-table';

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(value || 0);
}

export default async function RhDashboardPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [total, active, departments, contractsExpiring, salaryAgg, recent] = await Promise.all([
      tx.rhEmployee.count({ where: { tenantId: access.tenantId } }),
      tx.rhEmployee.count({ where: { tenantId: access.tenantId, status: 'ACTIVO' } }),
      tx.rhDepartment.count({ where: { tenantId: access.tenantId } }),
      tx.rhContract.count({ where: { tenantId: access.tenantId, status: { in: ['ACTIVO', 'RENOVADO'] }, endDate: { gte: now, lte: in30 } } }),
      tx.rhEmployee.aggregate({ where: { tenantId: access.tenantId, status: 'ACTIVO' }, _sum: { baseSalary: true } }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId }, orderBy: { createdAt: 'desc' }, take: 5, include: { department: { select: { name: true } }, position: { select: { title: true } } } }),
    ]);
    const year = now.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const employeesForYear = await tx.rhEmployee.findMany({
      where: { tenantId: access.tenantId, createdAt: { gte: start, lt: end } },
      select: { createdAt: true },
    });
    const admissionsByMonth: MonthAdmission[] = Array.from({ length: 12 }, (_, month) => ({
      month: month + 1 > 9 ? `${month + 1}` : `0${month + 1}`,
      fullDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      count: 0,
    }));
    for (const employee of employeesForYear as any[]) {
      const month = employee.createdAt.getMonth();
      admissionsByMonth[month].count += 1;
    }

    return { total, active, departments, contractsExpiring, monthly: Number(salaryAgg._sum.baseSalary ?? 0), recent, admissionsByMonth };
  }, { userId: access.userId });

  const activeLabel = data.active === 1 ? 'activo' : 'activos';
  const kpis = [
    { label: 'Funcionários', value: data.total, hint: `${data.active} ${activeLabel}`, tone: 'neutral' as const, icon: <IconUsers width={18} height={18} /> },
    { label: 'Departamentos', value: data.departments, hint: data.departments === 0 ? 'sem estrutura' : 'estrutura actual', tone: (data.departments === 0 ? 'warning' : 'success') as 'warning' | 'success', icon: <IconBuilding width={18} height={18} /> },
    { label: 'Contratos a vencer', value: data.contractsExpiring, hint: 'próximos 30 dias', tone: (data.contractsExpiring === 0 ? 'success' : 'warning') as 'warning' | 'success', icon: <IconCheckSquare width={18} height={18} /> },
    { label: 'Custo mensal base', value: money(data.monthly), hint: 'salários activos', tone: 'primary' as const, icon: <IconCurrency width={18} height={18} /> },
  ];

  return (
    <div className="space-y-6">
      <PremiumHero>
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="kpi-pill">MACHINE RH</span>
            <span className="kpi-pill">Equipa activa</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.05] tracking-[-.04em] text-white sm:text-4xl">{new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 19 ? 'Boa tarde' : 'Boa noite'} — aqui está a saúde da sua equipa.</h1>
          <p className="mt-3 text-sm leading-6 text-[#a9c4ff]">Pessoas, contratos, assiduidade e custos com pessoal. Tudo num só sítio, actualizado a partir dos seus dados.</p>
          <Link href="/rh/funcionarios" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-white px-5 text-sm font-bold text-[#041f52] transition hover:bg-[#eef2ff]"><span aria-hidden="true">+</span>Registar funcionário</Link>
        </div>
      </PremiumHero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {kpis.map((kpi) => (
          <PremiumKpi key={kpi.label} label={kpi.label} value={typeof kpi.value === 'number' ? kpi.value.toLocaleString('pt-AO') : String(kpi.value)} detail={kpi.hint} tone={kpi.tone} icon={kpi.icon} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <PremiumPanel title="Evolução de admissões" kicker="Este ano">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Funcionários contratados por mês</p>
              <p className="mt-0.5 text-lg font-extrabold text-[var(--text)]">{(data.admissionsByMonth as MonthAdmission[]).reduce((sum, m) => sum + m.count, 0)} admissões este ano</p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Ano corrente</span>
          </div>
          <div className="mt-4">
            {(data.admissionsByMonth as MonthAdmission[]).reduce((sum, m) => sum + m.count, 0) === 0 ? (
              <div className="flex h-44 flex-col items-center justify-center rounded-[18px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] text-center">
                <p className="text-sm font-semibold text-[var(--text)]">Ainda sem histórico suficiente para mostrar tendência.</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">As admissões aparecerão aqui quando os primeiros funcionários forem registados.</p>
              </div>
            ) : (
              <MonthlyAdmissionsChart months={data.admissionsByMonth as MonthAdmission[]} />
            )}
          </div>
        </PremiumPanel>

        <PremiumPanel title="Admissões recentes" kicker={data.recent.length === 1 ? "Última admissão" : `Últimas ${Math.min(data.recent.length, 5)}`}>
          <div className="flex items-center justify-between">
            <span />
            <Link href="/rh/funcionarios" className="text-xs font-semibold text-[#021f87] underline-offset-4 hover:underline">Ver todos →</Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="mt-4"><EmptyState title="Sem admissões" description="Ainda não há funcionários registados. A criação do primeiro equipa é simples." action={<Link href="/rh/funcionarios" className="inline-flex min-h-9 items-center rounded-lg bg-[#021f87] px-3 text-xs font-semibold text-white">Criar funcionário</Link>} /></div>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {(data.recent as any[]).map((employee) => (
                <li key={employee.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text)]">{rhFullName(employee.firstName, employee.lastName)}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">{employee.position?.title ?? 'Sem cargo'} · {employee.department?.name ?? 'Sem departamento'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-[10px] font-semibold text-[#021f87]">{employee.employeeNumber}</span>
                </li>
              ))}
            </ul>
          )}
        </PremiumPanel>

        <PremiumPanel title="Módulos implementados" kicker="Disponível agora">
          <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
            {['Funcionários e organização','Contratos e vencimentos','Assiduidade (Machine Point)','Documentos oficiais com IA','Férias e licenças'].map((m) => (
              <li key={m} className="flex items-center justify-between gap-3 py-3"><span className="text-[var(--text)]">{m}</span><span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Activo</span></li>
            ))}
          </ul>
          <p className="mt-4 rounded-lg bg-[#f5f8fc] p-3 text-xs text-[var(--text-muted)]">
            Use o menu RH para navegar entre Funcionários, Contratos, Assiduidade, Documentos e Processamento Salarial.
          </p>
        </PremiumPanel>

        <PremiumPanel title="Próximos passos" kicker="Acesso rápido">
          <ul className="mt-3 space-y-2">
            {[
              { href: '/rh/funcionarios', label: 'Registar funcionário', desc: 'Criar colaborador com contrato e departamento' },
              { href: '/rh/contratos', label: 'Criar contrato', desc: 'Vínculo, vencimento e salário base' },
              { href: '/rh/assiduidade', label: 'Ver assiduidade', desc: 'Presença e entradas dos funcionários' },
              { href: '/rh/documentos', label: 'Gerar documentos', desc: 'Contratos, declarações e comunicados com IA' },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 transition hover:border-[#021f87] hover:bg-[var(--surface)]">
                  <IconFileText width={18} height={18} className="mt-0.5 shrink-0 text-[#021f87]" />
                  <span>
                    <span className="block text-sm font-semibold text-[var(--text)]">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{item.desc}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </PremiumPanel>
      </div>
    </div>
  );
}
