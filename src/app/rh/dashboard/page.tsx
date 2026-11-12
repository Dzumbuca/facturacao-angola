import Link from 'next/link';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { rhFullName } from '@/lib/rh-service';
import { CountUp } from '@/components/rh/count-up';
import { Reveal } from '@/components/rh/reveal';

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
    return { total, active, departments, contractsExpiring, monthly: Number(salaryAgg._sum.baseSalary ?? 0), recent };
  }, { userId: access.userId });

  const kpis = [
    { label: 'Funcionários', value: data.total, hint: `${data.active} activos` },
    { label: 'Departamentos', value: data.departments, hint: 'estrutura actual' },
    { label: 'Contratos a vencer', value: data.contractsExpiring, hint: 'próximos 30 dias' },
    { label: 'Custo mensal base', value: money(data.monthly), hint: 'salários activos' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[#708195]">Recursos Humanos</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#1c2d3f]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#607286]">Visão geral da equipa, contratos e custos com pessoal.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi, index) => (
          <Reveal key={kpi.label}>
            <div className="rounded-xl border border-[#1a3aa8]/20 bg-[#071e54] p-4 text-white shadow-[0_10px_30px_rgba(7,30,84,.28)]">
              <p className="text-xs font-medium text-blue-100/80">{kpi.label}</p>
              <p className="mt-1 break-words text-xl font-bold tabular-nums text-white">{typeof kpi.value === 'number' ? <CountUp value={kpi.value} durationMs={800 + index * 120} /> : kpi.value}</p>
              <p className="mt-0.5 text-[11px] text-blue-100/60">{kpi.hint}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-xl border border-[#e1e8f0] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1c2d3f]">Admissões recentes</h2>
            <Link href="/rh/funcionarios" className="text-xs font-semibold text-[#021f87]">Ver todos →</Link>
          </div>
          {data.recent.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-[#dfe7f0] p-6 text-center">
              <p className="text-sm font-semibold text-[#4a5d70]">Ainda não há funcionários.</p>
              <Link href="/rh/funcionarios" className="mt-2 inline-flex text-xs font-semibold text-[#021f87]">Registar o primeiro →</Link>
            </div>
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
        </section>

        <section className="rounded-xl border border-[#e1e8f0] bg-white p-5">
          <h2 className="text-sm font-bold text-[#1c2d3f]">Próximos módulos</h2>
          <ul className="mt-3 space-y-2 text-sm text-[#607286]">
            <li className="flex justify-between"><span>Assiduidade (Machine Point)</span><span className="text-[10px] font-semibold uppercase text-[#8a99ab]">Breve</span></li>
            <li className="flex justify-between"><span>Férias e licenças</span><span className="text-[10px] font-semibold uppercase text-[#8a99ab]">Breve</span></li>
            <li className="flex justify-between"><span>Processamento salarial</span><span className="text-[10px] font-semibold uppercase text-[#8a99ab]">Breve</span></li>
            <li className="flex justify-between"><span>Documentos e contratos PDF</span><span className="text-[10px] font-semibold uppercase text-[#8a99ab]">Breve</span></li>
            <li className="flex justify-between"><span>Payroll Connect</span><span className="text-[10px] font-semibold uppercase text-[#8a99ab]">Breve</span></li>
          </ul>
          <p className="mt-4 rounded-lg bg-[#f5f8fc] p-3 text-xs text-[#607286]">
            O núcleo de funcionários, organização e contratos já está operacional.
          </p>
        </section>
      </div>
    </div>
  );
}
