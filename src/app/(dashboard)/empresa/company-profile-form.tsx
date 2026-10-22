'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BankAccountManager } from './bank-account-manager';

type CompanyProfile = {
  name: string;
  legalName: string;
  nif: string;
  address: string;
  municipality: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  bankName: string;
  bankAccountName: string;
  iban: string;
  brandColor: string;
  invoiceFooter: string;
  defaultMessage: string;
  defaultCurrency: string;
  documentLanguage: string;
  defaultPaymentDays: string;
  defaultPaymentMethod: string;
  defaultObservations: string;
  logoDataUrl: string | null;
};

const fields: { name: keyof Omit<CompanyProfile, 'logoDataUrl'>; id: string; label: string; type?: string; autoComplete?: string }[] = [
  { name: 'name', id: 'company-name', label: 'Nome da empresa', autoComplete: 'organization' },
  { name: 'legalName', id: 'company-legal-name', label: 'Denominação legal', autoComplete: 'organization' },
  { name: 'nif', id: 'company-nif', label: 'NIF', autoComplete: 'off' },
  { name: 'address', id: 'company-address', label: 'Morada', autoComplete: 'street-address' },
  { name: 'municipality', id: 'company-municipality', label: 'Município' },
  { name: 'province', id: 'company-province', label: 'Província' },
  { name: 'country', id: 'company-country', label: 'País' },
  { name: 'phone', id: 'company-phone', label: 'Telefone', type: 'tel', autoComplete: 'tel' },
  { name: 'email', id: 'company-email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'website', id: 'company-website', label: 'Website', type: 'url', autoComplete: 'url' },
  { name: 'bankName', id: 'company-bank', label: 'Banco' },
  { name: 'bankAccountName', id: 'company-bank-account-name', label: 'Titular da conta' },
  { name: 'iban', id: 'company-iban', label: 'IBAN', autoComplete: 'off' },
];
const maxLengthByField: Partial<Record<keyof Omit<CompanyProfile, 'logoDataUrl'>, number>> = {
  name: 160, legalName: 160, nif: 32, address: 250, municipality: 120, province: 120, country: 100, phone: 40, email: 254, website: 200,
  bankName: 120, bankAccountName: 160, iban: 34,
};

export function CompanyProfileForm({ initialProfile, initialBankAccounts = [] }: { initialProfile: CompanyProfile; initialBankAccounts?: { id: string; bankName: string; accountHolder: string | null; iban: string | null; currency: string; label: string | null; isActive: boolean; isPrimary: boolean }[] }) {
  const [profile, setProfile] = useState(initialProfile);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialProfile.logoDataUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isDirty = JSON.stringify(profile) !== JSON.stringify(initialProfile) || Boolean(logoFile) || removeLogo;
  const fileInput = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  // Depois de guardar (ou errar), traz a mensagem para o ecrã — o formulário é
  // comprido e quem carrega Guardar no fundo não vê o alerta no topo.
  function announce(kind: 'notice' | 'error', message: string) {
    if (kind === 'notice') setNotice(message); else setError(message);
    requestAnimationFrame(() => noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  }

  useEffect(() => () => {
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  function changeLogo(file: File | null) {
    setLogoFile(file);
    setRemoveLogo(false);
    setLogoPreview(file ? URL.createObjectURL(file) : profile.logoDataUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    formData.set('removeLogo', String(removeLogo));
    try {
      const response = await fetch('/api/company-profile', { method: 'PUT', body: formData });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.profile) {
        const validationErrors = Array.isArray(data?.errors) ? data.errors.join(' ') : '';
        announce('error', validationErrors || data?.error || 'Não foi possível guardar os dados da empresa.');
        return;
      }

      setProfile(data.profile);
      setLogoFile(null);
      setRemoveLogo(false);
      setLogoPreview(data.profile.logoDataUrl);
      if (fileInput.current) fileInput.current.value = '';
      announce('notice', 'Dados da empresa guardados com sucesso.');
    } catch {
      announce('error', 'Não foi possível comunicar com o servidor. Verifique a ligação e tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }

  return <div className="company-profile space-y-7">
    <div>
      <p className="text-sm text-[#708195]">Perfil único da empresa</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">Dados da empresa</h2>
      <p className="mt-2 text-sm text-[#708195]">Actualize os dados que podem aparecer nas facturas emitidas.</p>
    </div>

    {notice && <p ref={noticeRef} role="status" className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] px-4 py-3 text-sm font-medium text-[#267256]">{notice}</p>}
    {error && <p ref={noticeRef} role="alert" className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-[#a83939]">{error}</p>}

    <form className="space-y-5" onSubmit={handleSubmit}>
      <section className="company-profile-section overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)]">
        <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6"><h3 className="font-bold text-[#1c2d3f]">Identificação e contactos</h3><p className="mt-1 text-xs text-[#708195]">Estes dados pertencem à empresa associada à sua conta.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6">
          {fields.filter((field) => !['bankName', 'bankAccountName', 'iban'].includes(field.name)).map((field) => <div key={field.name} className={field.name === 'address' ? 'sm:col-span-2' : ''}>
            <label htmlFor={field.id} className="app-label">{field.label}{field.name === 'name' && <span className="ml-1 text-[#c44747]">*</span>}</label>
            <input id={field.id} name={field.name} type={field.type ?? 'text'} autoComplete={field.autoComplete} className="app-input" value={profile[field.name]} onChange={(event) => setProfile((current) => ({ ...current, [field.name]: event.target.value }))} maxLength={maxLengthByField[field.name]} required={field.name === 'name'} />
          </div>)}
        </div>
      </section>

      <section className="company-profile-section overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)]">
        <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6"><h3 className="font-bold text-[#1c2d3f]">Dados bancários</h3><p className="mt-1 text-xs text-[#708195]">O bloco bancário aparece na factura quando estiver preenchido.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6">
          {fields.filter((field) => ['bankName', 'bankAccountName', 'iban'].includes(field.name)).map((field) => <div key={field.name}>
            <label htmlFor={field.id} className="app-label">{field.label}</label>
            <input id={field.id} name={field.name} type={field.type ?? 'text'} autoComplete={field.autoComplete} className="app-input" value={profile[field.name]} onChange={(event) => setProfile((current) => ({ ...current, [field.name]: event.target.value }))} maxLength={field.name === 'iban' ? 34 : 160} />
          </div>)}
        </div>
      </section>

      <section className="company-profile-section overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)]">
        <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6"><h3 className="font-bold text-[#1c2d3f]">Identidade e preferências</h3><p className="mt-1 text-xs text-[#708195]">Os valores preenchem novos documentos e podem ser alterados antes da emissão.</p></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 md:p-6">
          <div><label htmlFor="company-brand-color" className="app-label">Cor principal</label><div className="flex gap-2"><input id="company-brand-color" name="brandColor" type="color" className="h-11 w-14 rounded-lg border border-[#d8e1eb] p-1" value={/^#[0-9a-fA-F]{6}$/.test(profile.brandColor) ? profile.brandColor : '#2878d0'} onChange={(event) => setProfile((current) => ({ ...current, brandColor: event.target.value }))} /><input aria-label="Código hexadecimal da cor" className="app-input" value={profile.brandColor} maxLength={7} onChange={(event) => setProfile((current) => ({ ...current, brandColor: event.target.value }))} /></div></div>
          <div><label htmlFor="company-payment-days" className="app-label">Prazo padrão (dias)</label><input id="company-payment-days" name="defaultPaymentDays" type="number" min="0" max="3650" step="1" className="app-input" value={profile.defaultPaymentDays} onChange={(event) => setProfile((current) => ({ ...current, defaultPaymentDays: event.target.value }))} placeholder="Sem prazo padrão" /></div>
          <div><label htmlFor="company-default-currency" className="app-label">Moeda</label><select id="company-default-currency" name="defaultCurrency" className="app-input" value={profile.defaultCurrency} onChange={(event) => setProfile((current) => ({ ...current, defaultCurrency: event.target.value }))}><option value="AOA">AOA — Kwanza</option></select></div>
          <div><label htmlFor="company-default-language" className="app-label">Idioma do documento</label><select id="company-default-language" name="documentLanguage" className="app-input" value={profile.documentLanguage} onChange={(event) => setProfile((current) => ({ ...current, documentLanguage: event.target.value }))}><option value="pt-AO">Português (Angola)</option></select></div>
          <div><label htmlFor="company-default-method" className="app-label">Método de pagamento padrão</label><select id="company-default-method" name="defaultPaymentMethod" className="app-input" value={profile.defaultPaymentMethod} onChange={(event) => setProfile((current) => ({ ...current, defaultPaymentMethod: event.target.value }))}><option value="">Não definido</option><option value="BANK_TRANSFER">Transferência bancária</option><option value="MULTICAIXA_EXPRESS">Multicaixa Express (manual)</option><option value="MULTICAIXA_REFERENCE">Referência Multicaixa (manual)</option><option value="CASH">Numerário</option><option value="OTHER">Outro</option></select></div>
          <div><label htmlFor="company-invoice-footer" className="app-label">Rodapé da factura</label><input id="company-invoice-footer" name="invoiceFooter" className="app-input" maxLength={500} value={profile.invoiceFooter} onChange={(event) => setProfile((current) => ({ ...current, invoiceFooter: event.target.value }))} /></div>
          <div className="sm:col-span-2"><label htmlFor="company-default-message" className="app-label">Mensagem padrão</label><textarea id="company-default-message" name="defaultMessage" className="app-input min-h-20" maxLength={1000} value={profile.defaultMessage} onChange={(event) => setProfile((current) => ({ ...current, defaultMessage: event.target.value }))} /></div>
          <div className="sm:col-span-2"><label htmlFor="company-default-observations" className="app-label">Observações padrão</label><textarea id="company-default-observations" name="defaultObservations" className="app-input min-h-20" maxLength={2000} value={profile.defaultObservations} onChange={(event) => setProfile((current) => ({ ...current, defaultObservations: event.target.value }))} /></div>
        </div>
      </section>

      <section className="company-profile-section overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_3px_14px_rgba(25,52,80,.035)]">
        <div className="border-b border-[#e7edf3] px-5 py-4 md:px-6"><h3 className="font-bold text-[#1c2d3f]">Logótipo</h3><p className="mt-1 text-xs text-[#708195]">Carregue uma imagem PNG ou JPEG até 1 MB.</p></div>
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center md:p-6">
          <div className="flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#cdddeb] bg-[#f8fafc]">
            {logoPreview ? <img src={logoPreview} alt="Pré-visualização do logótipo da empresa" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-[#708195]">Sem logótipo</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="company-logo" className="inline-flex min-h-10 cursor-pointer items-center rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#2878d0] hover:bg-[#f4f8fc]">Escolher imagem</label>
            <input ref={fileInput} id="company-logo" name="logo" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => changeLogo(event.target.files?.[0] ?? null)} />
            {logoPreview && <button type="button" className="min-h-10 rounded-lg px-3 text-sm font-semibold text-[#9b4545] hover:bg-red-50" onClick={() => { setLogoFile(null); setLogoPreview(null); setRemoveLogo(true); if (fileInput.current) fileInput.current.value = ''; }}>Remover logótipo</button>}
            {logoFile && <span className="w-full text-xs text-[#708195]">{logoFile.name}</span>}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[#708195]">{isDirty ? 'Tem alterações por guardar.' : 'Todas as alterações estão guardadas.'}</p><button type="submit" disabled={isSaving} className="min-h-11 rounded-lg bg-[#2878d0] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#216bbd] disabled:cursor-wait disabled:opacity-60">{isSaving ? 'A guardar…' : 'Guardar dados da empresa'}</button></div>
    </form>
    <BankAccountManager initialAccounts={initialBankAccounts} />
  </div>;
}
