import Link from 'next/link';
import type { ReactNode } from 'react';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { EmptyState } from '@/components/ui/data-table';
import { parseReportPeriod } from '@/lib/report-period';
import { IconUsers, IconClock, IconCoffee, IconCurrency, IconBanknote, IconFileText } from '@/components/rh/icons';
import { getRhReportDataset, isRhReportKind, RH_REPORT_KINDS, type RhReportKind } from '@/lib/rh-reports';

type Props = { searchParams: Promise<{ kind?: string; period?: string; from?: string; to?: string; departmentId?: string; employeeId?: string; status?: string }> };

const KIND_META: Record<RhReportKind, { label: string; description: string; icon: (className?: string) => ReactNode }> = {
  employees: { label: 'Funcionários', description: 'Cadastro, salários e estado', icon: (c) => <IconUsers className={c} aria-hidden /> },
  attendance: { label: 'Assiduidade', description: 'Entradas, saídas e dias presenciais', icon: (c) => <IconClock className={c} aria-hidden /> },
  leaves: { label: 'Férias', description: 'Pedidos aprovados, pendentes e rejeitados', icon: (c) => <IconCoffee className={c} aria-hidden /> },
  payroll: { label: 'Processamento', description: 'Bruto, líquido, INSS e IRT', icon: (c) => <IconCurrency className={c} aria-hidden /> },
  deductions: { label: 'Descontos', description: 'Activos e concluídos por funcionário', icon: (c) => <IconBanknote className={c} aria-hidden /> },
  contracts: { label: 'Contratos', description: 'Vigentes, a vencer e vencidos', icon: (c) => <IconFileText className={c} aria-hidden /> },
};

function fmtCell(cell: string | number | null): string {
  if (cell === null) return '—';
  if (typeof cell === 'number') return cell.toLocaleString('pt-AO');
  return String(cell);
}

function statusPill(cell: string | number | null): ReactNode | null {
  const value = typeof cell === 'string' ? cell : '';
  const map: Record<string, string> = {
    ACTIVO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    APROVADO: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
    PENDENTE: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    RENOVADO: 'bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    SUSPENSO: 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    VENCIDO: 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    REJEITADO: 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300',
    CONCLUIDO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    CANCELADO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    INACTIVO: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  const classes = map[value];
  if (!classes) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[.05em] ${classes}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {value}
    </span>
  );
}

function maybePill(cell: string | number | null): ReactNode {
  const pill = statusPill(cell);
  return pill ?? <span className="tabular-nums">{fmtCell(cell)}</span>;
}

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
  const forKind = (k: string) => {
    const q = new URLSearchParams(exportQuery);
    q.set('kind', k);
    return `/rh/relatorios?${q.toString()}`;
  };

  // Duas transacções independentes: listas numa, dataset na outra.
  const filterStatus = query.status ?? null;
  const [departments, employees] = await runWithTenant(access.tenantId, async (tx) => {
    return Promise.all([
      tx.rhDepartment.findMany({ where: { tenantId: access.tenantId }, orderBy: [{ name: 'asc' }], select: { id: true, name: true } }),
      tx.rhEmployee.findMany({ where: { tenantId: access.tenantId }, orderBy: [{ firstName: 'asc' }], take: 200, select: { id: true, firstName: true, lastName: true } }),
    ]);
  });
  const [dataset] = await Promise.all([
    getRhReportDataset(access.tenantId, period, kind, query.departmentId || null, query.employeeId || null, filterStatus),
  ]);
  const filters = { departments, employees };

  const periodLabel = `${period.start.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })} — ${new Date(period.endExclusive.getTime() - 1).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}`;
  const exportHref = (format: string) => `/api/rh/relatorios/export?format=${format}&${exportQuery.toString()}`;

  return (
    <div className="space-y-6 pb-8">
      {/* Cabeçalho — eyebrow → título → subtítulo + exportação unificada */}
      <header className="flex flex-wrap items-end justify-between gap-y-4 gap-x-8">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--blue)]">Machine RH · Relatórios</p>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-[-.03em] text-[var(--text)] md:text-[32px]">Relatórios de gestão</h1>
          <p className="mt-1.5 max-w-xl text-sm leading-6 text-[var(--text-muted)]">Dados reais da sua empresa, com isolamento por tenant e exportação em três formatos.</p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Exportar relatório">
          {(['pdf', 'xlsx', 'csv'] as const).map((format) => (
            <a
              key={format}
              href={exportHref(format)}
              className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-[var(--text-muted)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]"
            >
              <span className="grid h-5 w-5 place-items-center rounded-[5px] border border-[var(--line)] bg-[var(--surface-raised)] text-[9px] font-bold text-inherit" aria-hidden>
                {format === 'pdf' ? 'PDF' : format === 'xlsx' ? 'XL' : 'CS'}
              </span>
              {format === 'pdf' ? 'PDF' : format === 'xlsx' ? 'Excel' : 'CSV'}
            </a>
          ))}
        </div>
      </header>

      {/* Seis cartões — grelha consistente, ícones monocromáticos, sem emojis */}
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {RH_REPORT_KINDS.map((k) => {
          const meta = KIND_META[k];
          const active = k === kind;
          return (
            <Link
              key={k}
              href={forKind(k)}
              aria-current={active ? 'page' : undefined}
              className={`group flex min-h-[108px] flex-col rounded-[16px] border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] ${active ? 'border-[var(--blue)] bg-[#eef5ff] shadow-[0_4px_14px_rgb(2_31_135_/_.1)] dark:bg-[#0e1a33] dark:shadow-[0_4px_14px_rgb(0_0_0_/_.4)]' : 'border-[var(--line)] bg-[var(--surface)] hover:-translate-y-0.5 hover:border-[var(--blue)] hover:shadow-[var(--shadow-card)]'}`}
            >
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] border ${active ? 'border-[var(--blue)] bg-[#eef5ff] text-[var(--blue)] dark:bg-[#0e1a33] dark:text-blue-300' : 'border-[var(--line)] bg-[var(--surface-raised)] text-[#52667a] group-hover:border-[var(--blue)] group-hover:text-[var(--blue)]'}`}>
                {meta.icon('h-4 w-4')}
              </span>
              <span className="mt-3 text-[13px] font-bold leading-snug text-[var(--text)]">{meta.label}</span>
              <span className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{meta.description}</span>
              {active && <span className="mt-auto pt-2 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--blue)]">Seleccionado</span>}
            </Link>
          );
        })}
      </div>

      {/* Filtros — compactos, alinhados, intuitivos */}
      <form
        action="/rh/relatorios"
        method="get"
        className="rounded-[16px] border border-[var(--line)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] sm:p-4"
        aria-label="Filtros do relatório"
      >
        <input type="hidden" name="kind" value={kind} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="report-period" className="app-label">Período</label>
            <select id="report-period" name="period" defaultValue={query.period ?? 'thisMonth'} className="ds-input">
              <option value="today">Hoje</option>
              <option value="last7days">Últimos 7 dias</option>
              <option value="last30days">Últimos 30 dias</option>
              <option value="thisMonth">Este mês</option>
              <option value="lastMonth">Mês anterior</option>
              <option value="thisQuarter">Trimestre actual</option>
              <option value="thisYear">Ano actual</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>
          <div>
            <label htmlFor="report-from" className="app-label">De</label>
            <input id="report-from" name="from" type="date" defaultValue={query.from} className="ds-input" />
          </div>
          <div>
            <label htmlFor="report-to" className="app-label">Até</label>
            <input id="report-to" name="to" type="date" defaultValue={query.to} className="ds-input" />
          </div>
          <div>
            <label htmlFor="report-department" className="app-label">Departamento</label>
            <select id="report-department" name="departmentId" defaultValue={query.departmentId ?? ''} className="ds-input">
              <option value="">Todos</option>
              {filters.departments.map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-2 lg:col-span-1">
            <label htmlFor="report-employee" className="app-label">Funcionário</label>
            <select id="report-employee" name="employeeId" defaultValue={query.employeeId ?? ''} className="ds-input">
              <option value="">Todos</option>
              {filters.employees.map((employee: any) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex flex-wrap items-end gap-2">
            {kind !== 'attendance' && kind !== 'payroll' && (
              <div className="min-w-[160px]">
                <label htmlFor="report-status" className="app-label">{kind === 'leaves' ? 'Estado' : 'Situação'}</label>
                <select id="report-status" name="status" defaultValue={query.status ?? ''} className="ds-input">
                  <option value="">Todos</option>
                  {kind === 'employees' && <><option value="ACTIVO">Activo</option><option value="SUSPENSO">Suspenso</option><option value="FERIAS">Férias</option><option value="CESSAO">Cessão</option><option value="INACTIVO">Inactivo</option></>}
                  {kind === 'leaves' && <><option value="PENDENTE">Pendente</option><option value="APROVADO">Aprovado</option><option value="REJEITADO">Rejeitado</option><option value="CANCELADO">Cancelado</option></>}
                  {kind === 'deductions' && <><option value="true">Activo</option><option value="false">Concluído</option></>}
                  {kind === 'contracts' && <><option value="ACTIVO">Activo</option><option value="RENOVADO">Renovado</option><option value="VENCIDO">Vencido</option><option value="SUSPENSO">Suspenso</option><option value="TERMINADO">Terminado</option></>}
                </select>
              </div>
            )}
            <p className="text-[11px] text-[var(--text-muted)]">{periodLabel}</p>
          </div>
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#021f87] px-5 text-sm font-semibold text-white transition hover:bg-[#011566] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><IconFileText className="h-4 w-4" aria-hidden />Aplicar filtros</button>
        </div>
      </form>

      {/* Tabela — hierarquia tipográfica, alinhamento e chips de estado */}
      <section className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]" aria-label="Resultado do relatório">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold tracking-[-.01em] text-[var(--text)]">{dataset.title}</h2>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]"><span className="tabular-nums">{dataset.rows.length}</span> {dataset.rows.length === 1 ? 'registo' : 'registos'} · {periodLabel}</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--text-muted)] sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />Fonte: dados reais</span>
        </div>
        {dataset.rows.length === 0 ? (
          <div className="py-10">
            <EmptyState title="Sem dados no período" description="Não há registos para os filtros seleccionados. Ajuste o período ou crie o primeiro registo." action={<Link href="/rh/funcionarios" className="inline-flex min-h-10 items-center rounded-[10px] bg-[#021f87] px-4 text-xs font-semibold text-white">Criar funcionário</Link>} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]" role="table">
              <thead className="bg-[var(--surface-raised)]">
                <tr>
                  {dataset.headers.map((header) => (
                    <th key={header} scope="col" className="border-b border-[var(--line)] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {dataset.rows.map((row, index) => (
                  <tr key={index} className="align-middle transition hover:bg-[var(--surface-raised)]/60">
                    {row.map((cell, columnIndex) => (
                      <td key={columnIndex} className="px-4 py-2.5 text-[var(--text)]">{maybePill(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] bg-[var(--surface-raised)]">
                  {dataset.totals.map((cell, index) => (
                    <td key={index} className="px-4 py-3 text-[11px] font-bold uppercase tracking-[.05em] text-[var(--text)]">{fmtCell(cell)}</td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
