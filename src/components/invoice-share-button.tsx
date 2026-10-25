'use client';

import { useState, useTransition } from 'react';
import { WhatsappIcon } from '@/components/icons';

type ShareState = { ok: boolean; url?: string; error?: string };

export function ShareInvoiceButton({ invoiceId, waBase }: { invoiceId: string; waBase: string }) {
  const [state, setState] = useState<ShareState | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleShare() {
    startTransition(async () => {
      const { createInvoiceShare } = await import('@/lib/invoice-share');
      setState(await createInvoiceShare(invoiceId));
      setCopied(false);
    });
  }

  return <div className="flex flex-col items-stretch gap-2">
    <button
      type="button"
      onClick={handleShare}
      disabled={pending}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#1c2d3f] transition hover:bg-[#f6f9fc] disabled:cursor-wait disabled:opacity-60"
    >
      <WhatsappIcon className="h-4 w-4 text-[#25d366]" /> {pending ? 'A criar link…' : 'Partilhar por WhatsApp'}
    </button>
    {state?.error && <p role="alert" className="text-xs text-[#a83939]">{state.error}</p>}
    {state?.ok && state.url && <div className="rounded-lg border border-[#cbe8dc] bg-[#eff9f4] p-3 text-xs">
      <p className="font-semibold text-[#227958]">Link público criado (válido 30 dias):</p>
      <p className="mt-1 break-all rounded bg-white px-2 py-1.5 font-mono text-[11px] text-[#263c52]">{state.url}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${waBase} ${state.url}`)}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1fb855]"
        ><WhatsappIcon className="h-3.5 w-3.5" /> Abrir WhatsApp</a>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(state.url!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(() => null); }}
          className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] bg-white px-3 py-1.5 text-xs font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]"
        >{copied ? 'Copiado ✓' : 'Copiar link'}</button>
      </div>
    </div>}
  </div>;
}
