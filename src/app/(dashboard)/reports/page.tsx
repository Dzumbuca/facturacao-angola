import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { parseReportPeriod } from '@/lib/report-period';
import { getReportDataset, parseReportKind } from '@/lib/report-service';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { isStockReportKind } from '@/lib/report-data';
import { ReportBreakdownChart } from '@/components/report-breakdown-chart';
import { SaftExport } from '@/components/saft-export';
import { EmptyState } from '@/components/ui/data-table';

type Props = { searchParams: Promise<{ period?: string; from?: string; to?: string; kind?: string; customerId?: string; state?: string; warehouseId?: string; productId?: string }> };

export default async function ReportsPage({ searchParams }: Props) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const query = await searchParams;
  const requestedKind = parseReportKind(query.kind);
  const wmsEnabled = await isApplicationEnabled(tenantId, 'wms');
  const stockReportBlocked = isStockReportKind(requestedKind) && !wmsEnabled;
  const kind = stockReportBlocked ? 'invoices' : requestedKind;
  const stockKind = isStockReportKind(kind);
  let period;
  try { period = parseReportPeriod({ period: query.period ?? 'thisMonth', from: query.from, to: query.to }); }
  catch { period = parseReportPeriod({ period: 'thisMonth' }); }
  const [customers, warehouses, products, dataset] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    wmsEnabled ? prisma.warehouse.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }) : Promise.resolve([]),
    wmsEnabled ? prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, take: 500, select: { id: true, name: true, codigo: true } }) : Promise.resolve([]),
    getReportDataset(tenantId, period, kind, query.customerId || null, query.state || null, query.warehouseId || null, query.productId || null),
  ]);
  const params = new URLSearchParams();
  params.set('kind', kind); params.set('period', query.period ?? 'thisMonth');
  if (query.from) params.set('from', query.from); if (query.to) params.set('to', query.to); if (query.customerId) params.set('customerId', query.customerId);
  if (query.state) params.set('state', query.state);
  if (query.warehouseId) params.set('warehouseId', query.warehouseId);
  if (query.productId) params.set('productId', query.productId);
  const exportHref = (format: string) => `/api/reports/export?${new URLSearchParams([...params.entries(), ['format', format]]).toString()}`;
  const financialIndex = dataset.headers.findIndex((header) => /\(Kz\)/i.test(header) && /total|saldo|valor|facturado|recebido/i.test(header));
  const reportTotal = financialIndex >= 0 ? dataset.rows.reduce((sum, row) => sum + (typeof row[financialIndex] === 'number' ? row[financialIndex] as number : 0), 0) : null;
  const periodLabel = `${period.start.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })} — ${new Date(period.endExclusive.getTime() - 1).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}`;

  return <div className="space-y-8 pb-8">
    <header className="flex flex-col justify-between gap-5 border-b border-[#dce2e9] pb-6 lg:flex-row lg:items-end">
      <div><p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#67768a]">{stockKind ? 'Análise de armazém' : 'Análise financeira'}</p><h2 className="mt-2 text-[30px] font-semibold tracking-[-.035em] text-[#152236] md:text-[36px]">Relatórios</h2><p className="mt-2 text-sm text-[#65758a]">{dataset.title} · {periodLabel}</p></div>
      <div className="flex flex-wrap gap-2">{(['pdf', 'xlsx', 'csv'] as const).map((format) => {
        const Icon = format === 'pdf'
          ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
          : format === 'xlsx'
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M3 12h18M3 19h12"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18M3 12h18M3 19h12"/></svg>;
        const label = format === 'pdf' ? 'PDF' : format === 'xlsx' ? 'XLSX' : 'CSV';
        return <a key={format} href={exportHref(format)} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] transition hover:border-[var(--blue)] hover:text-[var(--blue)]">{Icon}Descarregar {label}</a>;
      })}</div>
    </header>

    {stockReportBlocked && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">Os relatórios de armazém exigem o módulo WMS activo. A mostrar o relatório de facturação.</div>}

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 md:p-6" aria-label="Exportação SAFT-AO">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-md">
          <h3 className="font-bold text-[#1c2d3f]">Exportação SAFT-AO</h3>
          <p className="mt-1 text-sm leading-6 text-[#5b6f85]">Ficheiro XML oficial (Standard Audit File) com as facturas do mês escolhido — pronto para o contabilista ou para a AGT.</p>
        </div>
        <SaftExport />
      </div>
    </section>

    <section className="grid gap-5 border-b border-[#dce2e9] pb-6 sm:grid-cols-[1fr_auto] sm:items-end" aria-label="Resumo do relatório filtrado">
      <div><p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#6f7e91]">{financialIndex >= 0 ? dataset.headers[financialIndex] : 'Registos encontrados'}</p><p className="mt-2 tabular-nums text-3xl font-semibold tracking-[-.035em] text-[#18273c]">{reportTotal === null ? dataset.rows.length : new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'Kz', maximumFractionDigits: 0 }).format(reportTotal)}</p></div>
      <p className="text-sm text-[#65758a]">{dataset.rows.length} {dataset.rows.length === 1 ? 'registo' : 'registos'} · filtros aplicados à tabela e aos ficheiros</p>
    </section>

    <form action="/reports" method="get" className="grid gap-3 border-y border-[#dce2e9] bg-white/60 py-5 sm:grid-cols-2 lg:grid-cols-6">
      <div><label htmlFor="report-kind" className="app-label">Relatório</label><select id="report-kind" name="kind" defaultValue={kind} className="app-input"><option value="invoices">Facturação</option><option value="receipts">Recebimentos</option><option value="debt">Dívida e antiguidade</option><option value="customers">Clientes</option><option value="products">Artigos facturados</option>{wmsEnabled && <optgroup label="Armazém e stock"><option value="stock_balances">Posição de stock</option><option value="stock_movements">Movimentos de stock</option><option value="stock_low">Abaixo do stock mínimo</option><option value="stock_transfers">Transferências</option><option value="stock_valuation">Valorização do inventário</option></optgroup>}</select></div>
      <div><label htmlFor="report-period" className="app-label">Período</label><select id="report-period" name="period" defaultValue={query.period ?? 'thisMonth'} className="app-input"><option value="today">Hoje</option><option value="last7days">Últimos 7 dias</option><option value="last30days">Últimos 30 dias</option><option value="thisMonth">Este mês</option><option value="lastMonth">Mês anterior</option><option value="thisQuarter">Trimestre actual</option><option value="thisYear">Ano actual</option><option value="custom">Personalizado</option></select></div>
      <div><label htmlFor="report-from" className="app-label">De</label><input id="report-from" name="from" type="date" defaultValue={query.from} className="app-input" /></div>
      <div><label htmlFor="report-to" className="app-label">Até</label><input id="report-to" name="to" type="date" defaultValue={query.to} className="app-input" /></div>
      {!stockKind && <div><label htmlFor="report-customer" className="app-label">Cliente</label><select id="report-customer" name="customerId" defaultValue={query.customerId ?? ''} className="app-input"><option value="">Todos</option>{customers.map((customer: { id: string; name: string }) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></div>}
      {!stockKind && <div><label htmlFor="report-state" className="app-label">Estado</label><select id="report-state" name="state" defaultValue={query.state ?? ''} className="app-input"><option value="">Todos</option>{(kind === 'receipts' ? [['PENDING', 'Pendente'], ['CONFIRMED', 'Confirmado'], ['CANCELLED', 'Cancelado'], ['REVERSED', 'Estornado']] : [['ISSUED', 'Emitida'], ['PARTIALLY_PAID', 'Parcialmente paga'], ['PAID', 'Paga'], ['OVERDUE', 'Vencida']]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>}
      {stockKind && <div><label htmlFor="report-warehouse" className="app-label">Armazém</label><select id="report-warehouse" name="warehouseId" defaultValue={query.warehouseId ?? ''} className="app-input"><option value="">Todos</option>{warehouses.map((warehouse: { id: string; name: string }) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>}
      {stockKind && <div><label htmlFor="report-product" className="app-label">Produto</label><select id="report-product" name="productId" defaultValue={query.productId ?? ''} className="app-input"><option value="">Todos</option>{products.map((product: { id: string; name: string; codigo: string | null }) => <option key={product.id} value={product.id}>{product.codigo ? `${product.codigo} · ${product.name}` : product.name}</option>)}</select></div>}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-6"><button className="min-h-10 rounded-md bg-[#021F87] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#061965]">Aplicar filtros</button><span className="text-xs text-[#708195]">Datas no fuso Africa/Luanda · valores em Kz</span></div>
    </form>

    {!stockKind && <ReportBreakdownChart kind={dataset.kind as any} headers={dataset.headers} rows={dataset.rows} />}

    <section className="min-w-0 border-t border-[#dce2e9] pt-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718095]">Detalhe</p><h3 className="mt-1 text-base font-semibold text-[#1d2b40]">{dataset.title}</h3></div><p className="text-xs text-[#7a8796]">{dataset.company.name}{dataset.company.nif ? ` · NIF ${dataset.company.nif}` : ''}</p></div>
      <div className="overflow-x-auto rounded-[16px] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <table className="w-full border-separate border-spacing-0 text-left text-sm">
          <caption className="sr-only">Relatório filtrado, totais incluídos.</caption>
          <thead><tr>{dataset.headers.map((headerRaw) => { const header = headerRaw.replace(/\(AOA\)/gi, '(Kz)'); return <th key={header} className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--surface-raised)] px-4 py-3 text-[11px] font-bold uppercase tracking-[.1em] text-[var(--text-muted)]">{header}</th>; })}</tr></thead>
          <tbody className="divide-y divide-[var(--line)]">{dataset.rows.map((row, rowIndex) => <tr key={rowIndex} className="transition-colors hover:bg-[var(--surface-raised)]">{row.map((cell, columnIndex) => <td key={columnIndex} className={`tabular-nums whitespace-nowrap px-4 py-3 ${typeof cell === 'number' ? 'text-right font-medium text-[var(--text)]' : 'text-[var(--text)]'}`}>{typeof cell === 'number' ? cell.toLocaleString('pt-AO', { maximumFractionDigits: 2 }) : (typeof cell === 'string' && /^ISSUED$/i.test(cell) ? 'Emitida' : (cell ?? '—'))}</td>)}</tr>)}</tbody>
          {dataset.rows.length > 0 && <tfoot className="border-t-2 border-[var(--line)] font-extrabold text-[var(--text)]"><tr>{dataset.totals.map((cell, index) => <td key={index} className="tabular-nums whitespace-nowrap px-4 py-3 text-right">{typeof cell === 'number' ? cell.toLocaleString('pt-AO', { maximumFractionDigits: 2 }) : cell ?? '—'}</td>)}</tr></tfoot>}
        </table>
      </div>
      {dataset.rows.length === 0 && <EmptyState title="Sem dados" description="Os filtros seleccionados não devolvem registos. Ajuste o período ou o tipo de relatório." />}
    </section>
    <p className="text-xs text-[#708195]">Os recebimentos pendentes estão identificados e não contam como valores recebidos. Não há conversão de moeda nem cálculo de lucro.</p>
  </div>;
}
