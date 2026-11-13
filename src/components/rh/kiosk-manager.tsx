'use client';

import { useEffect, useState } from 'react';

import { FormError } from '@/components/rh/form-kit';
const ACTIONS: { type: string; label: string; tone: string }[] = [
  { type: 'ENTRADA', label: 'Entrada', tone: 'bg-[#0f6b4f]' },
  { type: 'SAIDA_ALMOCO', label: 'Saída almoço', tone: 'bg-[#8a5a00]' },
  { type: 'REGRESSO_ALMOCO', label: 'Regresso', tone: 'bg-[#021f87]' },
  { type: 'SAIDA', label: 'Saída', tone: 'bg-[#7a2f2f]' },
];
const LABEL: Record<string, string> = { ENTRADA: 'Entrada', SAIDA_ALMOCO: 'Saída almoço', REGRESSO_ALMOCO: 'Regresso almoço', SAIDA: 'Saída' };

export function KioskManager() {
  const [now, setNow] = useState(new Date());
  const [token, setToken] = useState('');
  const [deviceToken, setDeviceToken] = useState('');
  const [deviceDraft, setDeviceDraft] = useState('');
  const [showDevice, setShowDevice] = useState(false);
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const stored = window.localStorage.getItem('rh_device_token') ?? '';
    setDeviceToken(stored);
    setDeviceDraft(stored);
    return () => window.clearInterval(timer);
  }, []);

  async function mark(type: string) {
    setError(''); setMessage('');
    if (!token.trim()) { setError('Digitaliza ou cola o QR do funcionário.'); return; }
    setSaving(type);
    try {
      const response = await fetch('/api/rh/attendance/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim(), type, deviceToken: deviceToken || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? 'Não foi possível registar.');
      const time = new Date(data.occurredAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' });
      setMessage(`${LABEL[type]} registada às ${time}.`);
      setToken('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving('');
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl bg-[#021f87] p-6 text-white">
        <p className="text-xs uppercase tracking-[.2em] text-blue-200">Terminal Machine Point</p>
        <p className="mt-2 text-5xl font-bold tabular-nums">{now.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
        <p className="mt-1 text-sm text-blue-100">{now.toLocaleDateString('pt-AO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-white p-5">
        <label htmlFor="kiosk-token" className="app-label">QR do funcionário</label>
        <textarea
          id="kiosk-token"
          className="app-input min-h-20 font-mono text-xs"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Digitaliza o QR com o leitor ou cola o conteúdo aqui"
          autoFocus
        />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ACTIONS.map((action) => (
            <button key={action.type} type="button" disabled={Boolean(saving)} onClick={() => mark(action.type)} className={`min-h-14 rounded-xl px-3 text-sm font-semibold text-white disabled:opacity-50 ${action.tone}`}>
              {saving === action.type ? 'A registar…' : action.label}
            </button>
          ))}
        </div>
        {message && <p role="status" className="mt-3 rounded-lg bg-[#eff9f4] px-3 py-2 text-sm font-medium text-[#267256]">{message}</p>}
        <FormError>{error}</FormError>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-white p-4">
        <button type="button" onClick={() => setShowDevice((value) => !value)} className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#52667a]">
          <span>Terminal {deviceToken ? 'configurado' : 'não configurado'}</span>
          <span aria-hidden="true">{showDevice ? '−' : '+'}</span>
        </button>
        {showDevice && (
          <div className="mt-3">
            <label htmlFor="kiosk-device" className="app-label">Token do dispositivo</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="kiosk-device" className="app-input font-mono text-xs" value={deviceDraft} onChange={(e) => setDeviceDraft(e.target.value)} placeholder="Colar token gerado em /rh/dispositivos" />
              <button type="button" onClick={() => { const value = deviceDraft.trim(); setDeviceToken(value); window.localStorage.setItem('rh_device_token', value); }} className="min-h-11 rounded-lg bg-[#021f87] px-4 text-sm font-semibold text-white">Guardar</button>
              <button type="button" onClick={() => { setDeviceDraft(''); setDeviceToken(''); window.localStorage.removeItem('rh_device_token'); }} className="min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[#52667a]">Limpar</button>
            </div>
            <p className="mt-2 text-xs text-[#8a99ab]">Sem token, o quiosque funciona com a sessão do gestor; com token, cada marcação fica associada ao terminal.</p>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-[#8a99ab]">
        O QR expira em 5 minutos. Gere um novo em Funcionários → Editar → QR do ponto.
      </p>
    </div>
  );
}
