'use client';

type Kind = 'invoices' | 'receipts' | 'debt' | 'customers' | 'products';
type Row = (string | number | null)[];
const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(value);
const states: Record<string, string> = { ISSUED: 'Emitida', PARTIALLY_PAID: 'Parcialmente paga', PAID: 'Paga', OVERDUE: 'Vencida', PENDING: 'Pendente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', REVERSED: 'Estornado' };

export function ReportBreakdownChart({ kind, headers, rows }: { kind: Kind; headers: string[]; rows: Row[] }) {
  if (!rows.length) return <div className="flex min-h-40 items-center border-y border-[#e2e7ed] px-5 text-sm text-[#748194]">Sem dados para representar com os filtros seleccionados.</div>;
  const amountIndex = kind === 'invoices' ? 4 : kind === 'receipts' ? 5 : kind === 'debt' ? 4 : kind === 'customers' ? 2 : 2;
  const categoryIndex = kind === 'invoices' ? 7 : kind === 'receipts' ? 3 : kind === 'debt' ? 3 : 0;
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const category = String(row[categoryIndex] ?? 'Sem classificação');
    const key = kind === 'receipts' ? `${category} · ${states[String(row[4])] ?? String(row[4])}` : states[category] ?? category;
    const amount = typeof row[amountIndex] === 'number' ? row[amountIndex] as number : 0;
    grouped.set(key, (grouped.get(key) ?? 0) + amount);
  }
  const categories = [...grouped].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, kind === 'customers' || kind === 'products' ? 6 : 8);
  const max = Math.max(...categories.map((category) => category.value), 1);
  const valueLabel = headers[amountIndex] ?? 'Valor (AOA)';
  const heading = kind === 'invoices' ? 'Facturação por estado' : kind === 'receipts' ? 'Registos por método e estado' : kind === 'debt' ? 'Saldo por antiguidade' : kind === 'customers' ? 'Facturação por cliente' : 'Artigos com maior facturação';

  return <section aria-labelledby="report-chart-title" className="border-y border-[#dce2e9] py-5">
    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#718095]">Distribuição</p><h3 id="report-chart-title" className="mt-1 text-base font-semibold text-[#1d2b40]">{heading}</h3></div><span className="text-[11px] text-[#7c8999]">{valueLabel} · valores reais do relatório</span></div>
    <div className="space-y-3.5">{categories.map(({ label, value }) => <div key={label} className="grid grid-cols-[minmax(110px,190px)_minmax(60px,1fr)_auto] items-center gap-3 text-xs">
      <span className="truncate text-[#4a596d]" title={label}>{label}</span><div className="h-2 overflow-hidden rounded-sm bg-[#e9edf2]"><div className={`h-full rounded-sm ${kind === 'receipts' && label.includes('Confirmado') ? 'bg-[#248468]' : kind === 'debt' ? 'bg-[#bc7c2b]' : 'bg-[#021F87]'}`} style={{ width: `${value > 0 ? Math.max(value / max * 100, 1.5) : 0}%` }} /></div><span className="min-w-24 text-right tabular-nums font-semibold text-[#344358]">{money(value)}</span>
    </div>)}</div>
    <details className="mt-4 text-xs text-[#667589]"><summary className="w-fit cursor-pointer underline decoration-[#aeb8c5] underline-offset-4">Ver valores em tabela</summary><div className="mt-2 space-y-1">{categories.map((category) => <p key={category.label} className="flex justify-between gap-3"><span>{category.label}</span><span className="tabular-nums">{money(category.value)}</span></p>)}</div></details>
  </section>;
}
