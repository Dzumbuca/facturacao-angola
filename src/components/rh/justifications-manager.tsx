'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { FormError } from '@/components/rh/form-kit';
type Justification = {
  id: string;
  date: string;
  type: string;
  reason: string;
  status: string;
  decisionNote: string | null;
  employee: { id: string; firstName: string; lastName: string; employeeNumber: string };
};

const STATUS: Record<string, string> = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Rejeitado' };
const TONE: Record<string, string> = {
  PENDENTE: 'bg-[#fff7e6] text-[#8a5a00]', APROVADO: 'bg-[#eff9f4] text-[#267256]', REJEITADO: 'bg-[#fdf3f3] text-[#a83939]',
};
const TYPE_LABEL: Record<string, string> = { FALTA: 'Falta', ATRASO: 'Atraso', SAIDA_ANTECIPADA: 'Saída antecipada', OUTRO: 'Outro' };

function day(value: string) {
  return new Date(value).toLocaleDateString('pt-AO');
}

export function JustificationsManager({ items }: { items: Justification[] }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function decide(id: string, status: 'APROVADO' | 'REJEITADO') {
    setBusy(id + status);
    setError('');
    try {
      const response = await fetch(`/api/rh/justifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível decidir.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[var(--text-muted)]">Assiduidade</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Justificações</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Faltas, atrasos e saídas antecipadas submetidas pelos funcionários.</p>
      </div>

      <FormError>{error}</FormError>

      <div className="form-card-light overflow-x-auto rounded-xl border border-[#e6eaf0]">
        <table className="data-table min-w-[760px]">
          <thead><tr><th>Data</th><th>Funcionário</th><th>Tipo</th><th>Motivo</th><th>Estado</th><th>Acções</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td data-mobile-primary className="tabular-nums">{day(item.date)}</td>
                <td>{item.employee.firstName} {item.employee.lastName} <span className="text-xs text-[var(--text-muted)]">{item.employee.employeeNumber}</span></td>
                <td>{TYPE_LABEL[item.type] ?? item.type}</td>
                <td className="max-w-[280px] text-xs text-[#52667a]">{item.reason}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[item.status] ?? ''}`}>{STATUS[item.status] ?? item.status}</span>
                  {item.decisionNote && <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{item.decisionNote}</span>}
                </td>
                <td data-mobile-actions>
                  {item.status === 'PENDENTE' ? (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => decide(item.id, 'APROVADO')} disabled={Boolean(busy)} className="min-h-9 rounded-lg border border-[#cbe8dc] px-3 text-xs font-semibold text-[#267256] disabled:opacity-50">Aprovar</button>
                      <button type="button" onClick={() => decide(item.id, 'REJEITADO')} disabled={Boolean(busy)} className="min-h-9 rounded-lg border border-[#f0d3d3] px-3 text-xs font-semibold text-[#a83939] disabled:opacity-50">Rejeitar</button>
                    </div>
                  ) : <span className="text-xs text-[#8a99ab]">—</span>}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-[#7094aa]">Sem justificações. Processe o primeiro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}