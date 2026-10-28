'use client';

import { useState } from 'react';

// Imprime o PDF do documento através de um iframe oculto, sem sair da área
// autenticada. Se o navegador não suportar impressão de PDF embutido, abre o
// PDF num separador — onde o utilizador pode imprimir manualmente.
export function PrintDocumentButton({ url, label = 'Imprimir' }: { url: string; label?: string }) {
  const [busy, setBusy] = useState(false);

  async function print() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('pdf');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const frame = document.createElement('iframe');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '0';
      frame.style.height = '0';
      frame.style.border = '0';
      frame.src = objectUrl;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          window.open(objectUrl, '_blank', 'noopener');
        }
        window.setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(objectUrl);
        }, 60_000);
      };
      document.body.appendChild(frame);
    } catch {
      window.open(url, '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={print} disabled={busy} className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold transition hover:bg-[#f6f9fc] disabled:cursor-wait disabled:opacity-60">
      {busy ? 'A preparar…' : label}
    </button>
  );
}
