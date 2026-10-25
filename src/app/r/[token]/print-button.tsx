'use client';

export function PrintButton() {
  return <button
    type="button"
    onClick={() => window.print()}
    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#cdddeb] bg-white px-4 text-sm font-semibold text-[#2878d0] transition hover:bg-[#f0f6fc]"
  >
    Guardar em PDF / Imprimir
  </button>;
}
