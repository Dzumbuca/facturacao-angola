'use client';

import { useEffect, useState } from 'react';
import type { DesktopStatus } from '../../electron/ipc-contract';

export function DesktopOfflineBootstrap() {
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const desktop = window.machineFacturasDesktop;
    if (!desktop) return;
    let active = true;
    const refresh = async (provision = false) => {
      try {
        const current = await desktop.getStatus();
        if (current.online && !busy) {
          if (provision || !current.configured) await desktop.refreshOfflineCache();
          if (provision || current.pendingCount > 0) await desktop.syncPendingDrafts();
        }
        const updated = await desktop.getStatus();
        if (active) setStatus(updated);
      } catch { /* Desktop bridge failures do not interfere with the web application. */ }
    };
    void refresh(true);
    const timer = window.setInterval(() => { void refresh(); }, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [busy]);

  if (!status || (status.online && status.pendingCount === 0)) return null;
  return <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" role="status" aria-live="polite">
    <span>{status.online ? `${status.pendingCount} rascunho(s) pendente(s) de sincronização.` : 'Sem ligação. Os rascunhos offline continuam guardados neste dispositivo.'}</span>
    {status.online && status.pendingCount > 0 && <button type="button" className="font-semibold text-emerald-700 underline underline-offset-2 disabled:opacity-50" disabled={busy} onClick={async () => { setBusy(true); try { await window.machineFacturasDesktop?.syncPendingDrafts(); } finally { setBusy(false); } }}>{busy ? 'A sincronizar…' : 'Sincronizar agora'}</button>}
  </div>;
}
