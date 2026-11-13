import Link from 'next/link';

type Alert = { title: string; href: string; action: string; tone: string };

type AttentionPanelProps = {
  alerts: Alert[];
  totalCustomers: number;
  totalProducts: number;
  draftCount: number;
};

const toneBg: Record<string, string> = {
  danger: '#ad4444',
  warning: '#bd7b24',
  neutral: '#9aa6b5',
};

export function AttentionPanel({ alerts, totalCustomers, totalProducts, draftCount }: AttentionPanelProps) {
  const healthy = alerts.length === 0;
  const hasData = totalCustomers + totalProducts + draftCount > 0;
  const status = healthy && hasData ? 'success' : alerts.length ? 'warning' : 'insufficient';

  return (
    <section
      aria-labelledby="attention-heading"
      aria-live="polite"
      className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <header className="flex items-end justify-between gap-3">
        <div>
          <p id="attention-heading" className="text-[11px] font-semibold uppercase tracking-[.14em] text-[var(--text-muted)]">Acompanhamento</p>
          <h2 className="mt-1 text-[var(--text)] text-[20px] font-extrabold tracking-tight">Atenção necessária</h2>
        </div>
      </header>

      <div className="mt-4">
        {status === 'success' && (
          <div className="flex items-start gap-3 rounded-[14px] border border-[#c7e5d1] bg-[#eff9f4] px-4 py-3 text-[#1e5e38] dark:border-[#1f3a2a] dark:bg-[#0e241b] dark:text-[#34d399]" role="status">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0"><path d="M5 12l5 5L19 7"/></svg>
            <p className="text-sm font-semibold leading-snug">Tudo certo — sem situações a exigir atenção.</p>
          </div>
        )}
        {status === 'warning' && (
          <div className="rounded-[14px] border border-[#f0e0b8] bg-[#fdf6e9] px-4 py-3 dark:border-[#3a2f10] dark:bg-[#2b2110]">
            <div className="flex items-start gap-3">
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-[#946000] dark:text-[#fbbf24]"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              <p className="text-sm font-bold text-[#946000] dark:text-[#fbbf24]">Existem {alerts.length} {alerts.length === 1 ? 'situação que exige' : 'situações que exigem atenção'}.</p>
            </div>
            <ul className="mt-3 divide-y divide-[#f0e0b8] dark:divide-[#3a2f10]">
              {alerts.map((alert) => (
                <li key={alert.title} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: toneBg[alert.tone] ?? '#9aa6b5' }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-5 text-[var(--text)]">{alert.title}</p>
                    <Link href={alert.href} className="mt-1 inline-block text-xs font-semibold text-[var(--blue)] hover:underline">{alert.action}</Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {status === 'insufficient' && (
          <div className="rounded-[14px] border border-dashed border-[var(--line)] bg-[var(--surface-raised)] px-4 py-5 text-center" role="status">
            <p className="text-sm font-semibold text-[var(--text)]">Ainda não existem dados suficientes para o acompanhamento.</p>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">Registe o primeiro cliente e artigo para que o painel possa acompanhar a sua actividade.</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--line)] overflow-hidden rounded-[14px] border border-[var(--line)] bg-[var(--surface-raised)] text-center">
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
