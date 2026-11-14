import Link from 'next/link';

type Alert = { title: string; href: string; action: string; tone: string };

type AttentionPanelProps = {
  alerts: Alert[];
  totalCustomers: number;
  totalProducts: number;
  draftCount: number;
};

const toneStyles: Record<string, string> = {
  danger: 'bg-red-50 border-red-200',
  warning: 'bg-amber-50 border-amber-200',
  neutral: 'bg-slate-50 border-slate-200',
};
const toneIcon: Record<string, string> = {
  danger: 'text-red-600',
  warning: 'text-amber-700',
  neutral: 'text-slate-500',
};
const toneText: Record<string, string> = {
  danger: 'text-red-900',
  warning: 'text-amber-900',
  neutral: 'text-slate-800',
};

export function AttentionPanel({ alerts, totalCustomers, totalProducts, draftCount }: AttentionPanelProps) {
  const healthy = alerts.length === 0;
  const hasData = totalCustomers + totalProducts + draftCount > 0;
  const status = healthy && hasData ? 'success' : alerts.length ? 'warning' : 'insufficient';
  const countLabel = alerts.length === 1 ? '1 situação a exigir atenção' : `${alerts.length} situações a exigir atenção`;

  return (
    <section
      aria-labelledby="attention-heading"
      aria-live="polite"
      className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)]"
    >
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Acompanhamento</p>
        <h2 id="attention-heading" className="mt-1 text-xl font-bold text-[var(--text)]">Atenção necessária</h2>
      </header>

      {status === 'success' && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3" role="status">
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-emerald-600"><path d="M5 12l5 5L19 7"/></svg>
          <p className="text-sm font-medium text-emerald-800">Tudo certo — sem situações a exigir atenção.</p>
        </div>
      )}

      {status === 'warning' && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--text)]">{countLabel}</p>
          {alerts.map((alert) => (
            <div key={alert.title} className={`flex items-start gap-3 rounded-xl border p-4 ${toneStyles[alert.tone] ?? toneStyles.neutral}`}>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`mt-0.5 shrink-0 ${toneIcon[alert.tone] ?? toneIcon.neutral}`}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${toneText[alert.tone] ?? toneText.neutral}`}>{alert.title}</p>
                <Link href={alert.href} className={`mt-1.5 inline-flex items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline ${toneText[alert.tone] ?? toneText.neutral}`}>{alert.action} →</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {status === 'insufficient' && (
        <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-4 py-5 text-center" role="status">
          <p className="text-sm font-semibold text-[var(--text)]">Ainda não existem dados suficientes para o acompanhamento.</p>
          <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Registe o primeiro cliente e artigo para que o painel possa acompanhar a sua actividade.</p>
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] text-center">
        <Link href="/customers" className="px-3 py-4 outline-offset-2 transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)]">
          <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Clientes</span>
          <span className="mt-1 block tabular-nums text-2xl font-extrabold text-[var(--text)] sm:text-[26px]">{totalCustomers}</span>
        </Link>
        <Link href="/produtos" className="px-3 py-4 outline-offset-2 transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)]">
          <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Artigos</span>
          <span className="mt-1 block tabular-nums text-2xl font-extrabold text-[var(--text)] sm:text-[26px]">{totalProducts}</span>
        </Link>
        <Link href="/invoices?tab=drafts" className="px-3 py-4 outline-offset-2 transition hover:bg-[var(--surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)]">
          <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-[var(--text-muted)]">Rascunhos</span>
          <span className="mt-1 block tabular-nums text-2xl font-extrabold text-[var(--text)] sm:text-[26px]">{draftCount}</span>
        </Link>
      </div>
    </section>
  );
}
