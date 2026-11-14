import Link from 'next/link';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { EmptyState } from '@/components/ui/data-table';
import { parseReportPeriod } from '@/lib/report-period';
import { getRhReportDataset, isRhReportKind, RH_REPORT_KINDS, type RhReportKind } from '@/lib/rh-reports';

const KIND_META: Record<RhReportKind, { label: string; description: string; icon: string; accent: string }> = {
  employees: { label: 'Funcionários', description: 'Cadastro, salários e estado', icon: '👥', accent: '#021f87' },
  attendance: { label: 'Assiduidade', description: 'Entradas, saídas e presenças por dia', icon: '⏱️', accent: '#0f766e' },
  leaves: { label: 'Férias e licenças', description: 'Pendentes, aprovados e rejeitados', icon: '🌴', accent: '#7c3aed' },
  payroll: { label: 'Processamento salarial', description: 'Bruto, líquido, INSS e IRT por período', icon: '💰', accent: '#b45309' },
  deductions: { label: 'Descontos', description: 'Activos e concluídos por funcionário', icon: '🧾', accent: '#b91c1c' },
  contracts: { label: 'Contratos', description: 'Vigentes, a vencer e vencidos', icon: '📄', accent: '#0369a1' },
};

type Props = { searchParams: Promise<{ kind?: string; period?: string; from?: string; to?: string; departmentId?: string; employeeId?: string; status?: string }> };

export default async function RhRelatoriosPage({ searchParams }: Props) {
  const access = await requireRhPage();
  const query = await searchParams;
  const kind = (isRhReportKind(query.kind ?? '') ? query.kind! : 'employees') as RhReportKind;

  let period = parseReportPeriod({ period: query.period ?? 'thisMonth', from: query.from, to: query.to });
  if (!period) period = parseReportPeriod({ period: 'thisMonth' });

  const exportQuery = new URLSearchParams({ kind });
  if (query.period) exportQuery.set('period', query.period);
  if (query.from) exportQuery.set('from', query.from);
  if (query.to) exportQuery.set('to', query.to);
  if (query.departmentId) exportQuery.set('departmentId', query.departmentId);
  if (query.employeeId) exportQuery.set('employeeId', query.employeeId);
  if (query.status) exportQuery.set('status', query.status);

  const [dataset, filters] = await runWithTenant(access.tenantId, async (tx) => {
    const [departments, employees] = await Promise.all([
      tx.rhDepartment.findMany({ where: { tenantId: access.tenantId, isActive: true }, orderBy: [{ name: 'asc' }], select: { id: true, name: true } }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId }, orderBy: [{ firstName: 'asc' }], take: 200, select: { id: true, firstName: true, lastName: true } }),
    ]);
    const filterStatus = query.status ?? null;
    const result = await getRhReportDataset(access.tenantId, period, kind, query.departmentId || null, query.employeeId || null, filterStatus);
    return [result, { departments, employees }];
  });

  const periodLabel = `${period.start.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })} — ${new Date(period.endExclusive.getTime() - 1).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}`;

  const exportHref = (format: string) => `/api/rh/relatorios/export?format=${format}&${exportQuery.toString()}`;

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col justify-between gap-4 border-b border-[#dce2e9] pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#67768a]">Relatórios RH</p>
          <h2 className="mt-1 text-[28px] font-semibold tracking-[-.035em] text-[#152236] md:text-[36px]">Relatórios do módulo RH</h2>
          <p className="mt-1 text-sm text-[#65758a]">Dados reais, isolados por empresa · {periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['pdf', 'xlsx', 'csv'] as const).map((format) => {
            const label = format === 'pdf' ? 'PDF' : format === 'xlsx' ? 'XLSX' : 'CSV';
            return <a key={format} href={exportHref(format)} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]">Descarregar {label}</a>;
          })}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {RH_REPORT_KINDS.map((k) => {
          const meta = KIND_META[k];
          const active = k === kind;
          return (
            <Link key={k} href={`/rh/relatorios?kind=${k}${exportQuery.toString() ? '&' + exportQuery.toString().replace(/kind=[^&]*?&?/, '') : ''}`} className={`rounded-2xl border p-3 transition ${active ? 'border-[var(--blue)] bg-[var(--surface-raised)] shadow-[var(--shadow-soft)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--blue)]'}`}>
              <p className="text-xl leading-none" aria-hidden="true">{meta.icon}</p>
              <p className="mt-2 text-sm font-bold text-[var(--text)]">{meta.label}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{meta.description}</p>
            </Link>
          );
        })}
      </div>

      <form action="/rh/relatorios" method="get" className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <input type="hidden" name="kind" value={kind} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1"><label htmlFor="report-period" className="app-label">Período</label><select id="report-period" name="period" defaultValue={query.period ?? 'thisMonth'} className="ds-input"><option value="today">Hoje</option><option value="last7days">Últimos 7 dias</option><option value="last30days">Últimos 30 dias</option><option value="thisMonth">Este mês</option><option value="lastMonth">Mês anterior</option><option value="thisQuarter">Trimestre actual</option><option value="thisYear">Ano actual</option><option value="custom">Personalizado</option></select></div>
          <div className="w-40"><label htmlFor="report-from" className="app-label">De</label><input id="report-from" name="from" type="date" defaultValue={query.from} className="ds-input" /></div>
          <div className="w-40"><label htmlFor="report-to" className="app-label">Até</label><input id="report-to" name="to" type="date" defaultValue={query.to} className="ds-input" /></div>
          <div className="min-w-[170px] flex-1"><label htmlFor="report-department" className="app-label">Departamento</label><select id="report-department" name="departmentId" defaultValue={query.departmentId ?? ''} className="ds-input"><option value="">Todos</option>{filters.departments.map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>
          <div className="min-w-[220px] flex-[2]"><label htmlFor="report-employee" className="app-label">Funcionário</label><select id="report-employee" name="employeeId" defaultValue={query.employeeId ?? ''} className="ds-input"><option value="">Todos</option>{filters.employees.map((employee: any) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}</select></div>
          {kind !== 'attendance' && kind !== 'payroll' && (
            <div className="min-w-[160px] flex-1"><label htmlFor="report-status" className="app-label">{kind === 'leaves' ? 'Estado' : kind === 'employees' ? 'Estado' : 'Situação'}</label><select id="report-status" name="status" defaultValue={query.status ?? ''} className="ds-input"><option value="">Todos</option>{kind === 'employees' && <><option value="ACTIVO">Activo</option><option value="SUSPENSO">Suspenso</option><option value="FERIAS">Férias</option><option value="CESSAO">Cessão</option><option value="INACTIVO">Inactivo</option></>}{kind === 'leaves' && <><option value="PENDENTE">Pendente</option><option value="APROVADO">Aprovado</option><option value="REJEITADO">Rejeitado</option><option value="CANCELADO">Cancelado</option></>}{kind === 'deductions' && <><option value="true">Activo</option><option value="false">Concluído</option></>}{kind === 'contracts' && <><option value="ACTIVO">Activo</option><option value="RENOVADO">Renovado</option><option value="VENCIDO">Vencido</option><option value="SUSPENSO">Suspenso</option><option value="TERMINADO">Terminado</option></>}</select></div>
          )}
          <button type="submit" className="inline-flex min-h-11 items-center rounded-[10px] bg-[#021f87] px-5 text-sm font-semibold text-white transition hover:bg-[#011566]">Aplicar</button>
        </div>
      </form>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
          <h3 className="text-lg font-bold text-[var(--text)]">{dataset.title}</h3>
          <p className="text-xs font-semibold text-[var(--text-muted)]">{dataset.rows.length} {dataset.rows.length === 1 ? 'registo' : 'registos'} · {periodLabel}</p>
        </div>
        {dataset.rows.length === 0 ? (
          <div className="py-8"><EmptyState title="Sem dados no período" description="Crie funcionários, processamentos ou registos de assiduidade para ver relatórios — os totais aparecerão automaticamente." action={<Link href="/rh/funcionarios" className="inline-flex min-h-10 items-center rounded-lg bg-[#021f87] px-4 text-xs font-semibold text-white">Criar funcionário</Link>} /></div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs" role="table">
              <thead>
                <tr className="text-[10px] uppercase tracking-[.12em] text-[var(--text-muted)]">{dataset.headers.map((header) => <th key={header} scope="col" className="border-b border-[var(--line)] pb-2 font-bold">{header}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {dataset.rows.map((row, index) => (
                  <tr key={index} className="align-top hover:bg-[var(--surface-raised)]">
                    {row.map((cell, columnIndex) => <td key={columnIndex} className="py-2 pr-3 text-[var(--text)] tabular-nums">{cell === null ? '—' : typeof cell === 'number' ? cell.toLocaleString('pt-AO') : String(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold text-[var(--text)]">
                  {dataset.totals.map((cell, index) => <td key={index} className="border-t border-[var(--line)] pt-2 pr-3">{cell === null ? '' : typeof cell === 'number' ? cell.toLocaleString('pt-AO') : String(cell)}</td>)}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
