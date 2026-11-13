'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError, CalendarField } from '@/components/rh/form-kit';
import { RhModuleHero } from '@/components/rh/premium-kit';
type Announcement = { id: string; title: string; body: string; priority: string; publishedAt: string; expiresAt: string | null };

const PRIORITY: Record<string, string> = { BAIXA: 'Baixa', NORMAL: 'Normal', ALTA: 'Alta' };
const TONE: Record<string, string> = { BAIXA: 'bg-[#f0f3f7] text-[#52667a]', NORMAL: 'bg-[#eef2ff] text-[#37379e]', ALTA: 'bg-[#fdf3f3] text-[#a83939]' };

export function AnnouncementsManager({ items }: { items: Announcement[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expiresIso, setExpiresIso] = useState('');

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
      <RhModuleHero
        eyebrow="Comunicação interna"
        title="Comunicados"
        description="Avisos visíveis para todos os funcionários em Meu RH. Comunica uma vez, todos recebem."
        icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5-5 18-3-8-8-3z"/><path d="M13 15l6-6"/></svg>}
      />

      <FormError>{error}</FormError>

      <form onSubmit={submit} className="rounded-xl border border-[#dfe7f0] bg-white p-4">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Novo comunicado</h2>
        <FormSection title="Detalhes do comunicado">
          <div className="sm:col-span-2">
            <FormField label="Título" name="an-title" required><input id="an-title" name="title" className="app-input" required maxLength={200} /></FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label="Conteúdo" name="an-body" required><textarea id="an-body" name="body" className="app-input min-h-24" required maxLength={4000} /></FormField>
          </div>
          <div>
            <FormField label="Prioridade" name="an-priority">
              <select id="an-priority" name="priority" className="app-input" defaultValue="NORMAL"><option value="BAIXA">Baixa</option><option value="NORMAL">Normal</option><option value="ALTA">Alta</option></select>
            </FormField>
          </div>
          <div>
            <FormField label="Válido até" name="an-expires" hint="Opcional"><CalendarField id="an-expires" name="expiresAt" value={expiresIso} onChange={setExpiresIso} /></FormField>
          </div>
          <div className="sm:col-span-2">
            <FormActions saving={busy} onCancel={() => {}} saveLabel={busy ? 'A publicar…' : 'Publicar'} />
          </div>
        </FormSection>
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