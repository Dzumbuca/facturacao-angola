'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/rh/form-kit';
type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };

export function NotificationsManager({ items, unread }: { items: Notification[]; unread: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function markAll() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/rh/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Não foi possível marcar como lidas.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">Machine RH</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Notificações</h1>
          <p className="mt-1 text-sm text-[#607286]">{unread} não lida(s) de {items.length} recente(s).</p>
        </div>
        <button type="button" onClick={markAll} disabled={busy || unread === 0} className="min-h-10 rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#021f87] disabled:opacity-50">
          {busy ? 'A marcar…' : 'Marcar todas como lidas'}
        </button>
      </div>

      <FormError>{error}</FormError>

      <ul className="divide-y divide-[#eef2f6] overflow-hidden rounded-xl border border-[#e1e8f0] bg-white">
        {items.map((item) => (
          <li key={item.id} className={`flex items-start gap-3 px-4 py-3 ${item.readAt ? '' : 'bg-[#f7faff]'}`}>
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-[#021f87]'}`} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1c2d3f]">{item.title}</p>
              <p className="mt-0.5 text-xs text-[#52667a]">{item.body}</p>
              <p className="mt-1 text-[11px] text-[#8a99ab]">{new Date(item.createdAt).toLocaleString('pt-AO')} · {item.readAt ? 'lida' : 'não lida'}</p>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-[#708195]">Sem notificações.</li>}
      </ul>
    </div>
  );
}