'use client';
import { useActionState } from 'react';
import { updatePlatformConfig } from '@/lib/admin-actions';
type State = { ok: boolean; message: string };
const initial: State = { ok: false, message: '' };
export function AdminConfigForm({ config }: { config: { platformName: string; supportEmail: string | null; supportPhone: string | null; supportWebsite: string | null; platformDescription: string | null; responsibleEntity: string | null; adHtml: string | null } }) {
  const action = async (_: State, form: FormData) => updatePlatformConfig({ platformName: form.get('platformName'), supportEmail: form.get('supportEmail'), supportPhone: form.get('supportPhone'), supportWebsite: form.get('supportWebsite'), platformDescription: form.get('platformDescription'), responsibleEntity: form.get('responsibleEntity'), adHtml: form.get('adHtml') }, String(form.get('reason')));
  const [state, formAction, pending] = useActionState(action, initial);
  return <form action={formAction} onSubmit={(event) => { if (!window.confirm('Confirmas a actualização das definições públicas? A alteração ficará registada na auditoria.')) event.preventDefault(); }} className="mt-5 grid max-w-2xl gap-4 rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="text-lg font-bold">Identidade da plataforma</h2>
    <label><span className="app-label">Nome público</span><input className="app-input" name="platformName" defaultValue={config.platformName} minLength={2} maxLength={80} required/></label>
    <label><span className="app-label">Descrição institucional (opcional)</span><textarea className="app-input min-h-24" name="platformDescription" maxLength={500} defaultValue={config.platformDescription ?? ''}/></label>
    <label><span className="app-label">Entidade responsável (opcional)</span><input className="app-input" name="responsibleEntity" maxLength={160} defaultValue={config.responsibleEntity ?? ''}/></label>
    <h2 className="mt-3 text-lg font-bold">Contactos oficiais</h2>
    <label><span className="app-label">Email de suporte (opcional)</span><input className="app-input" name="supportEmail" type="email" maxLength={254} defaultValue={config.supportEmail ?? ''}/></label>
    <label><span className="app-label">Telefone de suporte (opcional)</span><input className="app-input" name="supportPhone" maxLength={40} defaultValue={config.supportPhone ?? ''}/></label>
    <label><span className="app-label">Website oficial (opcional)</span><input className="app-input" name="supportWebsite" type="url" maxLength={200} placeholder="https://" defaultValue={config.supportWebsite ?? ''}/></label>
    <h2 className="mt-3 text-lg font-bold">Publicidade (plano grátis)</h2>
    <label><span className="app-label">Anúncio em HTML (opcional, máx. 4000 caracteres)</span><textarea className="app-input min-h-28 font-mono text-xs" name="adHtml" maxLength={4000} defaultValue={config.adHtml ?? ''} placeholder='<a href="https://parceiro.co.ao" target="_blank"><img src="..." alt="Parceiro" style="width:100%;border-radius:8px"/></a>'/></label>
    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Este conteúdo aparece no painel lateral das empresas no plano Grátis. Empresas Pro não veem anúncios. Aceita HTML simples (links, imagens, texto).</p>
    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Segurança: as palavras-passe, tokens, segredos, dados fiscais e credenciais técnicas não são editáveis nesta página.</p>
    <label><span className="app-label">Motivo da alteração (obrigatório)</span><input className="app-input" name="reason" minLength={5} maxLength={500} required/></label>
    <button disabled={pending} className="w-fit rounded-lg bg-[#021f87] px-5 py-3 font-semibold text-white disabled:opacity-60">{pending ? 'A guardar…' : 'Guardar configuração'}</button>
    {state.message && <p role="status" className={state.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{state.message}</p>}
  </form>;
}
