"use client";

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function ReconciliationRunButton() {
  const router = useRouter();
  const [isPending, start] = useTransition();

  const onRun = () => {
    start(async () => {
      try {
        const res = await fetch('/api/contabilidade/reconciliar', { method: 'POST' });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          alert(d?.error ?? 'Falha ao executar reconciliação.');
          return;
        }
        router.refresh();
      } catch (e: any) {
        alert(e?.message ?? 'Erro.');
      }
    });
  };

  return (
    <button onClick={onRun} disabled={isPending} className="h-11 rounded-xl bg-[#021f87] px-5 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(2,31,135,.28)] hover:bg-[#011566] disabled:opacity-60">
      {isPending ? 'A reconciliar…' : 'Executar reconciliação'}
    </button>
  );
}
