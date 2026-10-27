'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const THEME_KEY = 'machine-facturas-theme';

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === 'dark' || current === 'light') setTheme(current);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { window.localStorage.setItem(THEME_KEY, next); } catch { /* A sessão continua a funcionar sem armazenamento local. */ }
    setTheme(next);
  }

  const activate = theme === 'dark' ? 'Activar tema claro' : 'Activar tema escuro';
  return <button
    type="button"
    onClick={toggleTheme}
    aria-label={`${activate}. Tema actual: ${theme === 'dark' ? 'escuro' : 'claro'}.`}
    aria-pressed={theme === 'dark'}
    title={activate}
    className={`theme-toggle inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2.5 text-[var(--text)] transition-colors hover:bg-[var(--surface-raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${compact ? 'h-10 w-10 p-0' : ''}`}
  >
    {theme === 'dark'
      ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>
      : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-[18px] w-[18px]"><path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/></svg>}
    {!compact && <span className="hidden text-xs font-semibold sm:inline">{theme === 'dark' ? 'Claro' : 'Escuro'}</span>}
  </button>;
}
