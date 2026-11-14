import Link from 'next/link';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { rhFullName } from '@/lib/rh-service';
import { IconUsers, IconWallet, IconCoffee, IconCheckSquare, IconFileText } from '@/components/rh/icons';
import { PremiumHero, PremiumKpi, PremiumPanel } from '@/components/dashboard/premium-kit';
import { MonthlyAdmissionsChart, type MonthAdmission } from '@/components/rh/monthly-admissions-chart';
import { EmptyState } from '@/components/ui/data-table';

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(value || 0);
}

export default async function RhDashboardPage() {
  const access = await requireRhPage();
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [total, active, leavesActive, entriesTodayCount, entriesTodayEmployees, latestPayroll, salaryAgg, contractsExpiring, recent] = await Promise.all([
      tx.rhEmployee.count({ where: { tenantId: access.tenantId } }),
      tx.rhEmployee.count({ where: { tenantId: access.tenantId, status: 'ACTIVO' } }),
      tx.rhLeaveRequest.count({ where: { tenantId: access.tenantId, status: 'APROVADO', endDate: { gte: todayStart }, startDate: { lte: todayEnd } } }),
      tx.rhTimeEntry.count({ where: { tenantId: access.tenantId, type: 'ENTRADA', occurredAt: { gte: todayStart, lte: todayEnd } } }),
      tx.rhTimeEntry.findMany({ where: { tenantId: access.tenantId, type: 'ENTRADA', occurredAt: { gte: todayStart, lte: todayEnd } }, select: { employee: { select: { id: true } } } }),
      tx.rhPayrollRun.findFirst({ where: { tenantId: access.tenantId, period: monthKey }, orderBy: { updatedAt: 'desc' }, select: { id: true, totalGross: true, totalNet: true, status: true, period: true } }),
      tx.rhEmployee.aggregate({ where: { tenantId: access.tenantId, status: 'ACTIVO' }, _sum: { baseSalary: true } }),
      tx.rhContract.count({ where: { tenantId: access.tenantId, status: { in: ['ACTIVO', 'RENOVADO'] }, endDate: { gte: now, lte: in30 } } }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId }, orderBy: { createdAt: 'desc' }, take: 5, include: { department: { select: { name: true } }, position: { select: { title: true } } } }),
    ]);
    const year = now.getFullYear();
    const admissionsByMonth: MonthAdmission[] = Array.from({ length: 12 }, (_, month) => ({
      month: month + 1 > 9 ? `${month + 1}` : `0${month + 1}`,
      fullDate: `${year}-${String(month + 1).padStart(2, '0')}-01`,
      count: 0,
    }));
    const employeesForYear = await tx.rhEmployee.findMany({
      where: { tenantId: access.tenantId, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } },
      select: { createdAt: true },
    });
    for (const employee of employeesForYear as any[]) {
      const month = employee.createdAt.getMonth();
      admissionsByMonth[month].count += 1;
    }
    const uniquePresenceToday = new Set((entriesTodayEmployees as any[]).map((entry) => entry.employee.id)).size;
    return { total, active, leavesActive, entriesTodayCount, uniquePresenceToday, latestPayroll, monthly: Number(salaryAgg._sum.baseSalary ?? 0), contractsExpiring, recent, admissionsByMonth, monthKey };
  }, { userId: access.userId });

  const activeLabel = data.active === 1 ? 'activo' : 'activos';
  const kpis = [
    { label: 'Funcionários activos', value: data.active, hint: `${data.total} no total`, tone: 'neutral' as const, icon: <IconUsers width={18} height={18} /> },
    { label: 'Presença hoje', value: data.uniquePresenceToday, hint: `de ${data.active} ${activeLabel}`, tone: 'primary' as const, icon: <IconCheckSquare width={18} height={18} /> },
    { label: 'Férias activas', value: data.leavesActive, hint: 'aprovadas em vigor hoje', tone: 'success' as const, icon: <IconCoffee width={18} height={18} /> },
    {
      label: 'Folha salarial do mês',
      value: data.latestPayroll ? money(Number(data.latestPayroll.totalNet)) : '—',
      hint: data.latestPayroll ? `bruto ${money(Number(data.latestPayroll.totalGross))} · líquido` : 'Sem processamento neste mês',
      tone: (data.latestPayroll ? 'primary' : 'warning') as 'primary' | 'warning',
      icon: <IconWallet width={20} height={20} />,
    },
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
          <p className="mt-3 text-sm leading-6 text-[#a9c4ff]">Pessoas, contratos, assiduidade e salários — actualizado a partir dos seus dados.</p>
          <Link href="/rh/funcionarios" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[14px] bg-white px-5 text-sm font-bold text-[#041f52] transition hover:bg-[#eef2ff]"><span aria-hidden="true">+</span>Registar funcionário</Link>
        </div>
      </PremiumHero>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <PremiumKpi key={kpi.label} label={kpi.label} value={typeof kpi.value === 'number' ? kpi.value.toLocaleString('pt-AO') : String(kpi.value)} detail={kpi.hint} tone={kpi.tone} icon={kpi.icon} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Custo mensal base</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[var(--text)]">{money(data.monthly)}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Salários activos, sem descontos</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Contratos a vencer</p>
          <p className="mt-1 tabular-nums text-xl font-extrabold text-[var(--text)]">{data.contractsExpiring.toLocaleString('pt-AO')}</p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">Próximos 30 dias · <Link href="/rh/contratos" className="font-semibold text-[#021f87]">Ver contratos →</Link></p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:col-span-2">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">Resumo do dia</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--text)]">
            <span><strong className="tabular-nums">{data.uniquePresenceToday}</strong> presentes · <strong className="tabular-nums">{data.entriesTodayCount}</strong> marcações</span>
            <span><strong className="tabular-nums">{data.leavesActive}</strong> em férias</span>
            <span>{data.latestPayroll ? <>Folha <strong>{data.latestPayroll.status}</strong> · {data.monthKey}</> : <>Folha <strong>não iniciada</strong></>}</span>
          </div>
        </div>
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
      </div>

      <div className="grid gap-4">
        <PremiumPanel title="Próximos passos" kicker="Acesso rápido">
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { href: '/rh/funcionarios', label: 'Registar funcionário', desc: 'Criar colaborador com contrato e departamento' },
              { href: '/rh/contratos', label: 'Criar contrato', desc: 'Vínculo, vencimento e salário base' },
              { href: '/rh/assiduidade', label: 'Ver assiduidade', desc: 'Presença e entradas dos funcionários' },
              { href: '/rh/processamento-salarial', label: 'Processamento', desc: 'Folha salarial do mês, INSS e IRT' },
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
