'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { importChartOfAccounts } from '@/lib/gl-account-actions';

export function ImportForm({ existingCount }: { existingCount: number }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<{ created: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);
  const [isPending, start] = useTransition();

  const submit = () => {
    setError(''); setReport(null);
    if (!text.trim()) { setError('Cole o CSV antes de importar.'); return; }
    start(async () => {
      try {
        const r = await importChartOfAccounts(text);
        setReport(r as any);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  return (
    <div className="rounded-2xl border border-[#e2e9f1] bg-white p-6 space-y-4">
      <p className="text-xs text-[#627068]">Já existem <strong>{existingCount}</strong> contas activas. A importação CRIA contas novas (não sobrescreve existentes com o mesmo código).</p>
      <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border border-[#e2e9f1] bg-[#f7fbff] p-3 font-mono text-xs" placeholder="1000;Caixa;ASSET;DEBIT;4000;false\n1100;Banco;ASSET;DEBIT;;false" />
      {error && <p role="alert" className="border-l-4 border-[#a83939] bg-[#fff4f4] px-3 py-2 text-xs font-semibold text-[#a83939]">{error}</p>}
      {report && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs">
          <p className="font-bold text-emerald-700">Importação concluída</p>
          <ul className="mt-2 space-y-1 text-emerald-900">
            <li>Contas criadas: {report.created}</li>
            <li>Ignoradas (já existiam): {report.skipped}</li>
            <li>Erros: {report.errors.length}</li>
          </ul>
          {report.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-4 text-rose-700">
              {report.errors.slice(0, 20).map((e, i) => <li key={i}>Linha {e.row}: {e.reason}</li>)}
            </ul>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={() => router.push('/contabilidade/plano-contas')} className="h-10 rounded-xl border border-[#e2e9f1] bg-white px-4 text-xs font-semibold text-[#627068]">Cancelar</button>
        <button disabled={isPending} onClick={submit} className="h-10 rounded-xl bg-[#021f87] px-4 text-xs font-semibold text-white hover:bg-[#011566]">{isPending ? 'A importar…' : 'Validar e importar'}</button>
      </div>
    </div>
  );
}
