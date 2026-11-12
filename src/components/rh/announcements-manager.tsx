'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Announcement = { id: string; title: string; body: string; priority: string; publishedAt: string; expiresAt: string | null };

const PRIORITY: Record<string, string> = { BAIXA: 'Baixa', NORMAL: 'Normal', ALTA: 'Alta' };
const TONE: Record<string, string> = { BAIXA: 'bg-[#f0f3f7] text-[#52667a]', NORMAL: 'bg-[#eef2ff] text-[#37379e]', ALTA: 'bg-[#fdf3f3] text-[#a83939]' };

export function AnnouncementsManager({ items }: { items: Announcement[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/rh/announcements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: String(form.get('title') ?? ''),
          body: String(form.get('body') ?? ''),
          priority: String(form.get('priority') ?? 'NORMAL'),
          expiresAt: String(form.get('expiresAt') ?? '') || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível publicar.');
      event.currentTarget.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[#708195]">Comunicação interna</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Comunicados</h1>
        <p className="mt-1 text-sm text-[#607286]">Avisos visíveis para todos os funcionários em Meu RH.</p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#a83939]">{error}</p>}

      <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Novo comunicado</h2>
        <div className="mt-3 grid gap-3">
          <div><label htmlFor="an-title" className="app-label">Título *</label><input id="an-title" name="title" className="app-input" required maxLength={200} /></div>
          <div><label htmlFor="an-body" className="app-label">Conteúdo *</label><textarea id="an-body" name="body" className="app-input min-h-24" required maxLength={4000} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="an-priority" className="app-label">Prioridade</label><select id="an-priority" name="priority" className="app-input" defaultValue="NORMAL"><option value="BAIXA">Baixa</option><option value="NORMAL">Normal</option><option value="ALTA">Alta</option></select></div>
            <div><label htmlFor="an-expires" className="app-label">Válido até (opcional)</label><input id="an-expires" name="expiresAt" type="date" className="app-input" /></div>
          </div>
        </div>
        <div className="mt-3 flex justify-end"><button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'A publicar…' : 'Publicar'}</button></div>
      </form>

      <ul className="divide-y divide-[#eef2f6] overflow-hidden rounded-xl border border-[#e1e8f0] bg-white">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[item.priority] ?? ''}`}>{PRIORITY[item.priority] ?? item.priority}</span>
              <h2 className="text-sm font-bold text-[#1c2d3f]">{item.title}</h2>
              <span className="text-[11px] text-[#8a99ab]">{new Date(item.publishedAt).toLocaleDateString('pt-AO')}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3a4a5e]">{item.body}</p>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-[#708195]">Sem comunicados.</li>}
      </ul>
    </div>
  );
}