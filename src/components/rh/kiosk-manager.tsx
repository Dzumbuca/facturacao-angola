'use client';

import { useEffect, useState } from 'react';

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
  const [saving, setSaving] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
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
        body: JSON.stringify({ token: token.trim(), type }),
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

      <div className="rounded-xl border border-[#e1e8f0] bg-white p-5">
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
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-[#a83939]">{error}</p>}
      </div>

      <p className="text-center text-xs text-[#8a99ab]">
        O QR expira em 5 minutos. Gere um novo em Funcionários → Editar → QR do ponto.
      </p>
    </div>
  );
}
