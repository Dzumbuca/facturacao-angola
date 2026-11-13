import Link from 'next/link';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { rhFullName } from '@/lib/rh-service';
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

  const kpis = [
    { label: 'Funcionários', value: data.total, hint: `${data.active} activos` },
    { label: 'Departamentos', value: data.departments, hint: 'estrutura actual' },
    { label: 'Contratos a vencer', value: data.contractsExpiring, hint: 'próximos 30 dias' },
    { label: 'Custo mensal base', value: money(data.monthly), hint: 'salários activos' },
  ];

  return (
    <div className="space-y-6">
      <PremiumHero>
        <div className="max-w-2xl">
          <div className="flex items-center gap-3">
            <span className="kpi-pill">MACHINE RH</span>
            <span className="kpi-pill">Equipa activa</span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-[1.05] tracking-[-.04em] text-white sm:text-4xl">Bom dia — aqui está a saúde da sua equipa.</h1>
          <p className="mt-3 text-sm leading-6 text-[#a9c4ff]">Pessoas, contratos, assiduidade e custos com pessoal. Tudo num só sítio, actualizado a partir dos vossos dados.</p>
        </div>
      </PremiumHero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {kpis.map((kpi) => {
          const tone = kpi.label === 'Custo mensal base' ? 'primary' : kpi.label === 'Contratos a vencer' ? 'warning' : 'neutral';
          return <PremiumKpi key={kpi.label} label={kpi.label} value={typeof kpi.value === 'number' ? kpi.value.toLocaleString('pt-AO') : String(kpi.value)} detail={kpi.hint} tone={tone} />;
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <PremiumPanel title="Evolução de admissões" kicker="Este ano">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[#8494a9]">Funcionários contratados por mês</p>
              <p className="mt-0.5 text-lg font-extrabold text-[#1c2d3f]">{(data.admissionsByMonth as MonthAdmission[]).reduce((sum, m) => sum + m.count, 0)} admissões este ano</p>
            </div>
            <span className="kpi-pill !bg-[#eef2ff] !text-[#021f87] !border-[#dbe2ff]">REAL</span>
          </div>
          <div className="mt-4">
            <MonthlyAdmissionsChart months={data.admissionsByMonth as MonthAdmission[]} />
          </div>
        </PremiumPanel>

        <PremiumPanel title="Admissões recentes" kicker="Últimas 5">
          <div className="flex items-center justify-between">
            <span />
            <Link href="/rh/funcionarios" className="text-xs font-semibold text-[#021f87] underline-offset-4 hover:underline">Ver todos →</Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="mt-4"><EmptyState title="Sem admissões" description="Ainda não há funcionários registados. A criação do primeiro equipa é simples." action={<Link href="/rh/funcionarios" className="inline-flex min-h-9 items-center rounded-lg bg-[#021f87] px-3 text-xs font-semibold text-white">Criar funcionário</Link>} /></div>
          ) : (
            <ul className="mt-3 divide-y divide-[#eef2f6]">
              {(data.recent as any[]).map((employee) => (
                <li key={employee.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#1c2d3f]">{rhFullName(employee.firstName, employee.lastName)}</p>
                    <p className="truncate text-xs text-[#708195]">{employee.position?.title ?? 'Sem cargo'} · {employee.department?.name ?? 'Sem departamento'}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#eef4ff] px-2 py-0.5 text-[10px] font-semibold text-[#021f87]">{employee.employeeNumber}</span>
                </li>
              ))}
            </ul>
          )}
        </PremiumPanel>

        <PremiumPanel title="Módulos implementados" kicker="Disponível agora">
          <ul className="mt-3 space-y-2 text-sm text-[#607286]">
            <li className="flex justify-between"><span>Funcionários e organização</span><span className="text-[10px] font-semibold uppercase text-[#267256]">Activo</span></li>
            <li className="flex justify-between"><span>Contratos e vencimentos</span><span className="text-[10px] font-semibold uppercase text-[#267256]">Activo</span></li>
            <li className="flex justify-between"><span>Assiduidade (Machine Point)</span><span className="text-[10px] font-semibold uppercase text-[#267256]">Activo</span></li>
            <li className="flex justify-between"><span>Documentos oficiais com IA</span><span className="text-[10px] font-semibold uppercase text-[#267256]">Activo</span></li>
            <li className="flex justify-between"><span>Férias e licenças</span><span className="text-[10px] font-semibold uppercase text-[#267256]">Activo</span></li>
          </ul>
          <p className="mt-4 rounded-lg bg-[#f5f8fc] p-3 text-xs text-[#607286]">
            Use o menu RH para navegar entre Funcionários, Contratos, Assiduidade, Documentos e Processamento Salarial.
          </p>
        </PremiumPanel>
      </div>
    </div>
  );
}
