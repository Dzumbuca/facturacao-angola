'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Converte tabelas em cartões no mobile sem duplicar markup:
 * lê os cabeçalhos e escreve `data-label` em cada célula; o CSS faz o resto.
 * Reanota quando o conteúdo muda (paginação, filtros, carregamentos).
 */
function annotateTables() {
  document.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (table.closest('[data-responsive-skip]')) return;
    const headerCells = Array.from(table.querySelectorAll('thead th'));
    if (headerCells.length === 0) return;
    const labels = headerCells.map((cell) => (cell.textContent || '').replace(/\s+/g, ' ').trim());
    if (!labels.some(Boolean)) return;

    table.classList.add('responsive-table');
    table.querySelectorAll('tbody tr').forEach((row) => {
      Array.from(row.children).forEach((cell, index) => {
        if (!(cell instanceof HTMLTableCellElement) || cell.tagName !== 'TD') return;
        if (cell.hasAttribute('data-label')) return;
        const label = labels[index] ?? '';
        if (label) cell.setAttribute('data-label', label);
      });
    });
  });
}

export function ResponsiveTables() {
  const pathname = usePathname();

  useEffect(() => {
    // Depois da hidratação: evita diferenças de DOM durante o primeiro render.
    let cancelled = false;
    const run = () => { if (!cancelled) annotateTables(); };
    const frame = requestAnimationFrame(run);
    const initial = window.setTimeout(run, 300);
    let scheduled = 0;
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(run);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scheduled);
      window.clearTimeout(initial);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
