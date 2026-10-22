'use client';

import { useState, type FormEvent } from 'react';
import { checkSmtpAction, sendTestEmailAction } from './actions';

export function SmtpCheck() {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function check() { setBusy(true); setResult(null); try { setResult(await checkSmtpAction()); } finally { setBusy(false); } }
  async function sendTest(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setResult(null); try { setResult(await sendTestEmailAction(String(form.get('recipient') ?? ''))); } finally { setBusy(false); } }
  return <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Configuração SMTP</h2><p className="mt-2 text-sm text-slate-600">Credenciais carregadas exclusivamente do ambiente. O diagnóstico verifica a ligação e autenticação, sem enviar email.</p><button type="button" onClick={check} disabled={busy} className="mt-4 rounded-lg bg-[#021f87] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{busy ? 'A verificar…' : 'Verificar ligação SMTP'}</button><form onSubmit={sendTest} className="mt-5 border-t pt-4"><label className="app-label" htmlFor="smtp-test-recipient">Destinatário para teste real</label><input id="smtp-test-recipient" name="recipient" type="email" required maxLength={254} className="app-input mt-1"/><button disabled={busy} className="mt-3 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? 'A processar…' : 'Enviar email de teste'}</button></form>{result && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${result.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{result.message}</p>}</section>;
}
