'use client';

import { useEffect, useState } from 'react';

export type AssistantDocument = { title: string; body: string };
export type CompanyIdentity = {
  name?: string; legalName?: string; nif?: string; address?: string;
  phone?: string; email?: string; website?: string; logoDataUrl?: string | null;
};

const STORAGE_IDENTITY = 'machine-ia-company-profile-v1';

async function loadCompanyIdentity(): Promise<CompanyIdentity | null> {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.sessionStorage.getItem(STORAGE_IDENTITY);
    if (cached) return JSON.parse(cached) as CompanyIdentity;
    const res = await fetch('/api/company-profile');
    if (!res.ok) return null;
    const data = await res.json();
    const identity: CompanyIdentity = {
      name: data?.name, legalName: data?.legalName, nif: data?.nif,
      address: [data?.address, data?.municipality, data?.province].filter(Boolean).join(', ') || data?.address,
      phone: data?.phone, email: data?.email, website: data?.website,
      logoDataUrl: data?.logoDataUrl ?? null,
    };
    window.sessionStorage.setItem(STORAGE_IDENTITY, JSON.stringify(identity));
    return identity;
  } catch {
    return null;
  }
}

async function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); URL.revokeObjectURL(url);
}

function wordDocumentHtml(title: string, body: string) {
  const esc = body.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const blocks = esc.split('\n').map((line) => {
    const t = line.trim();
    if (/^# /.test(t)) return `<h1>${t.replace(/^#\s+/, '')}</h1>`;
    if (/^## /.test(t)) return `<h2>${t.replace(/^##\s+/, '')}</h2>`;
    if (/^### /.test(t)) return `<h3>${t.replace(/^###\s+/, '')}</h3>`;
    if (/^[-*•]\s+/.test(t)) return `<li>${t.replace(/^[-*•]\s+/, '')}</li>`;
    if (!t) return '';
    return `<p>${t}</p>`;
  }).join('');
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Calibri,sans-serif;font-size:11pt;line-height:1.5;color:#171c27}h1{color:#021f87;font-size:17pt}h2{color:#171c27;font-size:13pt}h3{color:#171c27;font-size:11pt}li{margin-left:18pt}</style></head><body><h1>${title}</h1>${blocks}</body></html>`;
}

export function AssistantDocumentCard({ doc, onRegenerate, regenerating }: {
  doc: AssistantDocument;
  onRegenerate?: (instruction: string) => void;
  regenerating?: boolean;
}) {
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.body);
  const [identity, setIdentity] = useState<CompanyIdentity | null>(null);
  const [useIdentity, setUseIdentity] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [extra, setExtra] = useState('');

  useEffect(() => { setTitle(doc.title); setBody(doc.body); }, [doc.title, doc.body]);
  useEffect(() => { void loadCompanyIdentity().then(setIdentity); }, []);

  async function exportTo(format: 'pdf' | 'docx' | 'txt' | 'md' | 'doc') {
    setExporting(format);
    try {
      if (format === 'txt') return download(`${title || 'documento'}.txt`, body, 'text/plain');
      if (format === 'md') return download(`${title || 'documento'}.md`, `# ${title}\n\n${body}`, 'text/markdown');
      if (format === 'doc') return download(`${title || 'documento'}.doc`, wordDocumentHtml(title, body), 'application/msword');
      const identityPayload = useIdentity && identity ? {
        ...identity,
        // só envia se o utilizador autorizou
        includeLogo: true,
      } : undefined;
      const response = await fetch('/api/assistant/document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'Documento', body, format, identity: identityPayload }),
      });
      if (!response.ok) throw new Error('export-failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(title || 'documento').replace(/[^\w\- ]/g, '')}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      // inline error handled by parent
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-[#dbe6fb] bg-[#f4f7ff] p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#021f87]">Documento gerado</p>
      <label htmlFor="ia-doc-title" className="mt-1 block text-[10px] font-semibold text-[#5b6f85]">Título</label>
      <input id="ia-doc-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-0.5 w-full rounded-lg border border-[#c9d8fb] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#1c2d3f] outline-none focus:border-[#021f87]" maxLength={160} />
      <label htmlFor="ia-doc-body" className="mt-2 block text-[10px] font-semibold text-[#5b6f85]">Conteúdo (editável)</label>
      <textarea id="ia-doc-body" value={body} onChange={(e) => setBody(e.target.value)} className="mt-0.5 h-36 w-full resize-none rounded-lg border border-[#c9d8fb] bg-white px-2 py-1.5 font-mono text-[10.5px] leading-5 text-[#24364d] outline-none focus:border-[#021f87]" spellCheck={false} />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#c9d8fb] bg-white px-2 py-1.5 text-[10px] font-semibold text-[#021f87]">
          <input type="checkbox" checked={useIdentity} onChange={(e) => setUseIdentity(e.target.checked)} className="h-3.5 w-3.5 accent-[#021f87]" />
          Incluir dados da minha empresa
        </label>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => navigator.clipboard.writeText(`${title}\n\n${body}`)} className="rounded-lg border border-[#c9d8fb] bg-white px-2 py-1.5 text-[10px] font-semibold text-[#021f87] transition hover:bg-[#eef2ff]">Copiar</button>
          {(['docx', 'pdf', 'txt', 'md'] as const).map((fmt) => (
            <button key={fmt} type="button" disabled={exporting === fmt} onClick={() => exportTo(fmt)} className="rounded-lg bg-[#021f87] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-white transition hover:bg-[#1233a8] disabled:opacity-50">
              {exporting === fmt ? '…' : fmt === 'docx' ? 'Word' : fmt === 'md' ? 'Markdown' : fmt.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {onRegenerate && (
        <div className="mt-2 flex gap-1.5 border-t border-[#e2e9fb] pt-2">
          <input value={extra} onChange={(e) => setExtra(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const v = extra.trim(); if (v) { onRegenerate(v); setExtra(''); } } }} placeholder="Instruções adicionais para regenerar…" className="min-w-0 flex-1 rounded-lg border border-[#c9d8fb] bg-white px-2 py-1.5 text-[10.5px] outline-none focus:border-[#021f87]" />
          <button type="button" disabled={regenerating || !extra.trim()} onClick={() => { const v = extra.trim(); onRegenerate(v); setExtra(''); }} className="rounded-lg border border-[#021f87] px-3 py-1.5 text-[10px] font-semibold text-[#021f87] transition hover:bg-[#eef2ff] disabled:opacity-40">{regenerating ? 'A regenerar…' : 'Regenerar'}</button>
        </div>
      )}
      {identity && useIdentity && <p className="mt-1.5 text-[9px] uppercase tracking-[.1em] text-[#647184]">Com identidade: {identity.legalName || identity.name}</p>}
    </div>
  );
}
