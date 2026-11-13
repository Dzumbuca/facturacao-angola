'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

type Badge = { overdue: number; drafts: number; expiringContracts: number };

export function NotificationsBell() {
  const [badge, setBadge] = useState<Badge | null>(null);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/notifications/badge', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setBadge(data && typeof data === 'object' ? data as Badge : null))
      .catch(() => setBadge(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => { if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const count = (badge?.overdue ?? 0) + (badge?.drafts ?? 0) + (badge?.expiringContracts ?? 0);
  return (
    <div ref={wrapper} className="relative">
      <button type="button" aria-label={count ? `${count} notificações` : 'Notificações'} onClick={() => setOpen((v) => !v)} className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#e1e8f0] bg-white text-[#4a5d70] transition hover:border-[#c7d4e3] hover:bg-[#f4f7fb] hover:text-[#021f87]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        {count > 0 && <span aria-hidden className="absolute right-2 top-2 grid min-w-4 place-items-center rounded-full border border-white bg-[#e11d48] px-1 text-[9px] font-bold text-white shadow">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notificações" className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-[#e1e8f0] bg-white shadow-[var(--shadow-card)]">
          <p className="border-b border-[#eef2f6] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#708195]">Notificações</p>
          <ul className="max-h-80 divide-y divide-[#eef2f6] overflow-y-auto">
            {badge?.overdue ? <li className="px-4 py-3"><Link href="/invoices?state=OVERDUE" onClick={() => setOpen(false)} className="flex items-start gap-3 text-sm font-semibold text-[#a83939]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fef2f2] text-[#a83939]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 8v4m0 4h.01"/></svg></span><span><span className="block">{badge.overdue} factura(s) vencidas</span><span className="mt-0.5 block text-[11px] font-normal text-[#708195]">Reveja cobranças em atraso.</span></span></Link></li> : null}
            {badge?.drafts ? <li className="px-4 py-3"><Link href="/invoices?tab=drafts" onClick={() => setOpen(false)} className="flex items-start gap-3 text-sm font-semibold text-[#b45309]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fff8eb] text-[#b45309]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M9 12h6M9 16h6M9 8h6"/></svg></span><span><span className="block">{badge.drafts} rascunho(s) por concluir</span><span className="mt-0.5 block text-[11px] font-normal text-[#708195]">Complete a emissão.</span></span></Link></li> : null}
            {badge?.expiringContracts ? <li className="px-4 py-3"><Link href="/rh/contratos" onClick={() => setOpen(false)} className="flex items-start gap-3 text-sm font-semibold text-[#1d4ed8]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef4ff] text-[#1d4ed8]"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg></span><span><span className="block">{badge.expiringContracts} contrato(s) a vencer</span><span className="mt-0.5 block text-[11px] font-normal text-[#708195]">Próximos 30 dias.</span></span></Link></li> : null}
            {(!badge?.overdue && !badge?.drafts && !badge?.expiringContracts) ? <li className="px-4 py-6 text-center text-sm text-[#607286]">Sem notificações pendentes.</li> : null}
          </ul>
          <p className="border-t border-[#eef2f6] px-4 py-2 text-[10px] uppercase tracking-[.14em] text-[#aab8cc]">Actualizado agora</p>
        </div>
      )}
    </div>
  );
}
