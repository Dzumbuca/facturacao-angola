'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { FormSection, FormField, FormActions, FormError } from '@/components/rh/form-kit';
type Device = { id: string; name: string; isActive: boolean; lastSeenAt: string | null; createdAt: string };

function date(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-AO') : '—';
}

export function DevicesManager({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [issued, setIssued] = useState<{ name: string; token: string } | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(''); setIssued(null);
    try {
      const response = await fetch('/api/rh/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível registar.');
      setIssued({ name: data.name, token: data.token });
      setName('');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    setError('');
    try {
      const response = await fetch(`/api/rh/devices/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error('Não foi possível actualizar.');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-[var(--text-muted)]">Machine Point</p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text)]">Dispositivos</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Terminais autorizados a registar ponto por QR.</p>
      </div>

      <form onSubmit={create} className="rounded-xl border border-[var(--line)] bg-white p-4">
        <FormSection title="Registar dispositivo">
          <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FormField label="Nome do terminal" name="device-name" required hint="Um terminal por quiosque registado">
                <input id="device-name" className="ds-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Recepção, Loja 1…" required />
              </FormField>
            </div>
            <FormActions saving={saving} onCancel={() => {}} saveLabel={saving ? 'A registar…' : 'Registar dispositivo'} />
          </div>
        </FormSection>
        <FormError>{error}</FormError>
      </form>

      {issued && (
        <div className="rounded-xl border border-[#f0e0b8] bg-[#fffbef] p-4">
          <p className="text-sm font-semibold text-[#8a5a00]">Token do terminal “{issued.name}” (mostrado uma única vez)</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-3 text-xs">{issued.token}</code>
          <p className="mt-2 text-xs text-[#8a5a00]">Guarde-o no quiosque em /rh/ponto. Se perder, registe outro dispositivo.</p>
          <button type="button" onClick={() => navigator.clipboard?.writeText(issued.token)} className="mt-2 min-h-9 rounded-lg border border-[#e6d29a] px-3 text-xs font-semibold text-[#8a5a00]">Copiar token</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-white">
        <table className="data-table min-w-[560px]">
          <thead><tr><th>Dispositivo</th><th>Estado</th><th>Último uso</th><th>Criado</th><th>Acções</th></tr></thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td data-mobile-primary className="font-semibold text-[var(--text)]">{device.name}</td>
                <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${device.isActive ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#fdf3f3] text-[#a83939]'}`}>{device.isActive ? 'Activo' : 'Desactivado'}</span></td>
                <td className="tabular-nums text-xs">{date(device.lastSeenAt)}</td>
                <td className="tabular-nums text-xs">{date(device.createdAt)}</td>
                <td data-mobile-actions>
                  <button type="button" onClick={() => toggle(device.id, !device.isActive)} className="min-h-9 rounded-lg border border-[var(--line)] px-3 text-xs font-semibold text-[var(--blue)]">{device.isActive ? 'Desactivar' : 'Activar'}</button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-[#7094aa]">Ainda não há dispositivos. Registe o primeiro.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
