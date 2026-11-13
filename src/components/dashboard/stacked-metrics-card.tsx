import Link from 'next/link';

type StackedMetricsProps = {
  received: number;
  pendingYetDue: number;
  overdue: number;
};

const money = (value: number) =>
  new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(value || 0);
const isZero = (value: number) => Math.abs(value) < 0.005;

type Row = {
  key: 'received' | 'pendingYetDue' | 'overdue';
  label: string;
  description: string;
  value: number;
  accent: string;
  neutral: string;
  icon: React.ReactNode;
};

export function StackedMetricsCard({ received, pendingYetDue, overdue }: StackedMetricsProps) {
  const rows: Row[] = [
    {
      key: 'received',
      label: 'Recebido',
      description: 'Pagamentos confirmados no período',
      value: received,
      accent: 'var(--success)',
      neutral: 'var(--text)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L19 7"/></svg>
      ),
    },
    {
      key: 'pendingYetDue',
      label: 'Por receber',
      description: 'Saldo pendente de pagamento',
      value: pendingYetDue,
      accent: '#946000',
      neutral: 'var(--text)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      ),
    },
    {
      key: 'overdue',
      label: 'Em atraso',
      description: 'Facturas com vencimento ultrapassado',
      value: overdue,
      accent: 'var(--danger)',
      neutral: 'var(--text)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
      ),
    },
  ];

  return (
    <section aria-label="Leitura vertical dos estados de cobrança" className="flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      <header className="flex items-end justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Estados de cobrança</h2>
        <Link href="/reports" className="text-[11px] font-semibold text-[var(--blue)] hover:underline">Ver relatórios →</Link>
      </header>

      <ol className="mt-3 flex-1 divide-y divide-[var(--line)]">
        {rows.map((row, index) => {
          const valueIsZero = isZero(row.value);
          const color = valueIsZero ? 'var(--text-muted)' : row.accent;
          return (
            <li key={row.key} className={`flex items-center gap-4 py-4 ${index === 0 ? 'pt-2' : ''} ${index === rows.length - 1 ? 'pb-0' : ''}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] ring-1" style={{ color, background: valueIsZero ? 'var(--surface-raised)' : `color-mix(in srgb, ${row.accent} 10%, var(--surface-raised))`, borderColor: valueIsZero ? 'var(--line)' : `color-mix(in srgb, ${row.accent} 25%, var(--line))` }}>{row.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--text-muted)]">{row.label}</p>
                <p className="mt-0.5 truncate text-[12px] leading-[1.2] text-[var(--text-muted)]">{row.description}</p>
              </div>
              <p className="tabular-nums shrink-0 font-extrabold tracking-tight" style={{ fontSize: row.value >= 100_000_000 ? 20 : row.value >= 10_000_000 ? 22 : row.value >= 1_000_000 ? 24 : 28, color, lineHeight: 1.1 }}>{money(row.value)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
