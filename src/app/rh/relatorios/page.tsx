import Link from 'next/link';
import type { ReactNode } from 'react';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { EmptyState } from '@/components/ui/data-table';
import { parseReportPeriod } from '@/lib/report-period';
import { IconUsers, IconClock, IconCoffee, IconWallet, IconCurrency, IconFileText, IconCheckSquare } from '@/components/rh/icons';
import { getRhReportDataset, isRhReportKind, RH_REPORT_KINDS, type RhReportKind } from '@/lib/rh-reports';

type Props = { searchParams: Promise<{ kind?: string; period?: string; from?: string; to?: string; departmentId?: string; employeeId?: string; status?: string }> };

const KIND_META: Record<RhReportKind, { label: string; description: string; icon: (className?: string) => ReactNode; color: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'indigo' }> = {
  employees:   { label: 'Funcionários',  description: 'Cadastro, salários e estado',        icon: (c) => <IconUsers className={c} aria-hidden />,     color: 'blue' },
  attendance:  { label: 'Assiduidade',   description: 'Entradas, saídas e dias presenciais', icon: (c) => <IconClock className={c} aria-hidden />,     color: 'emerald' },
  leaves:      { label: 'Férias',        description: 'Aprovadas, pendentes e rejeitadas',   icon: (c) => <IconCoffee className={c} aria-hidden />,    color: 'amber' },
  payroll:     { label: 'Processamento', description: 'Bruto, líquido, INSS e IRT',          icon: (c) => <IconWallet className={c} aria-hidden />,    color: 'purple' },
  deductions:  { label: 'Descontos',     description: 'Activos e concluídos por funcionário', icon: (c) => <IconCurrency className={c} aria-hidden />,  color: 'rose' },
  contracts:   { label: 'Contratos',     description: 'Vigentes, a vencer e vencidos',       icon: (c) => <IconFileText className={c} aria-hidden />,  color: 'indigo' },
};

const COLOR: Record<string, { icon: string }> = {
  blue:    { icon: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  emerald: { icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' },
  amber:   { icon: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  purple:  { icon: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' },
  rose:    { icon: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
  indigo:  { icon: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' },
};

function fmtCell(cell: string | number | null): string {
  if (cell === null) return '—';
  if (typeof cell === 'number') return cell.toLocaleString('pt-AO');
  return String(cell);
}

function statusPill(cell: string | number | null): ReactNode | null {
  const value = typeof cell === 'string' ? cell : '';
  const map: Record<string, string> = {
    ACTIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    APROVADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    RENOVADO: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    SUSPENSO: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    VENCIDO: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    REJEITADO: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    CONCLUIDO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    CANCELADO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    INACTIVO: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  const classes = map[value];
  if (!classes) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${classes}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
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
      {/* Cabeçalho — compacto; exportação unificada à direita */}
      <header className="flex flex-wrap items-end justify-between gap-y-4 gap-x-8 border-b border-[var(--line)] pb-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--blue)]">Machine RH · Relatórios</p>
          <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-[-.02em] text-[var(--text)] md:text-[30px]">Relatórios de gestão</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Gerados a partir dos seus dados reais · {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Exportar relatório">
          {(['pdf', 'xlsx', 'csv'] as const).map((format) => (
            <a
              key={format}
              href={exportHref(format)}
              className="inline-flex min-h-10 items-center gap-2.5 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-4 text-xs font-bold uppercase tracking-[.05em] text-[var(--text)] transition hover:border-[var(--blue)] hover:text-[var(--blue)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] shadow-[var(--shadow-card)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-current opacity-80" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
              </svg>
              {format === 'pdf' ? 'PDF' : format === 'xlsx' ? 'Excel' : 'CSV'}
            </a>
          ))}
        </div>
      </header>

      {/* Seis cartões — cores distintas, estado seleccionado claro e legível */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {RH_REPORT_KINDS.map((k) => {
          const meta = KIND_META[k];
          const active = k === kind;
          const tone = COLOR[meta.color].icon;
          return (
            <Link
              key={k}
              href={forKind(k)}
              aria-current={active ? 'page' : undefined}
              className={`group flex min-h-[128px] flex-col rounded-2xl border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)] ${active ? 'border-[var(--blue)] bg-[var(--surface-raised)] ring-2 ring-[var(--blue)]/15' : 'border-[var(--line)] bg-[var(--surface)] hover:-translate-y-0.5 hover:border-[var(--blue)] hover:shadow-[var(--shadow-card)]'}`}
            >
              <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}>
                {meta.icon('h-5 w-5')}
              </span>
              <span className="mt-3 text-[13px] font-bold leading-snug text-[var(--text)]">{meta.label}</span>
              <span className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">{meta.description}</span>
              {active && (
                <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--blue)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-white">
                  <IconCheckSquare className="h-3 w-3" aria-hidden />
                  Selecionado
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Filtros — secção compacta, alinhada e identificada */}
      <form
        action="/rh/relatorios"
        method="get"
        className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5"
        aria-label="Filtros do relatório"
      >
        <input type="hidden" name="kind" value={kind} />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
          <h2 className="text-sm font-bold text-[var(--text)]">Filtrar relatório</h2>
          <p className="text-[11px] text-[var(--text-muted)]">{periodLabel}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
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
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-end gap-3">
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
          </div>
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#021f87] px-5 text-sm font-semibold text-white transition hover:bg-[#011566] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"><IconFileText className="h-4 w-4" aria-hidden />Aplicar filtros</button>
        </div>
      </form>

      {/* Tabela — tipografia, alinhamento e chips de estado */}
      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]" aria-label="Resultado do relatório">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3.5 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-[-.01em] text-[var(--text)]">{dataset.title}</h2>
            <p className="mt-0.5 text-[11px] font-medium text-[var(--text-muted)]"><span className="tabular-nums">{dataset.rows.length}</span> {dataset.rows.length === 1 ? 'registo' : 'registos'} · {periodLabel}</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--text-muted)] sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />Dados reais</span>
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
                    <th key={header} scope="col" className="border-b border-[var(--line)] px-5 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {dataset.rows.map((row, index) => (
                  <tr key={index} className="align-middle transition hover:bg-[var(--surface-raised)]">
                    {row.map((cell, columnIndex) => (
                      <td key={columnIndex} className="px-5 py-3 text-[var(--text)]">{maybePill(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--line)] bg-[var(--surface-raised)]">
                  {dataset.totals.map((cell, index) => (
                    <td key={index} className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-[.05em] text-[var(--text)]">{fmtCell(cell)}</td>
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
