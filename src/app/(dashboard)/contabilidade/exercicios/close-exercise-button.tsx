'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { closeExerciseAndApurar, openNextExercise } from '@/lib/gl-exercise-actions';

export function CloseExerciseButton({ exerciseId, year, disabled, exerciseState }: { exerciseId: string; year: number; disabled: boolean; exerciseState: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const onClose = () => {
    if (disabled) { alert('Exercício tem bloqueadores.'); return; }
    const justification = prompt('Apurar e encerrar exercício ' + year + '?\n\nDescreva brevemente (mín. 10 caracteres):', '');
    if (!justification) return;
    setError(''); setDone('');
    start(async () => {
      try {
        const r = await closeExerciseAndApurar(exerciseId, justification);
        setDone(`Exercício ${year} encerrado; resultado: ${r.resultBeforeApuramento}; lançamento ${r.journalEntryNumber ?? 'já existia'}`);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  const onOpen = () => {
    const justification = prompt('Abrir exercício ' + (year + 1) + '?\n\nDescreva (mín. 10 caracteres):', '');
    if (!justification) return;
    setError(''); setDone('');
    start(async () => {
      try {
        const r = await openNextExercise(year + 1, justification);
        setDone(`Exercício ${year + 1} aberto; lançamentos de abertura ${r.openingEntries}; número ${r.journalEntryNumber ?? '—'}`);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  if (exerciseState === 'CLOSED') {
    return (
      <div className="space-y-2">
        <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">Exercício encerrado. Para abrir o exercício seguinte, clique abaixo.</p>
        <button onClick={onOpen} disabled={isPending} className="h-11 rounded-xl border border-[#2878d0] bg-white px-5 text-sm font-semibold text-[#2878d0] hover:bg-[#f4f8ff] disabled:opacity-60">
          {isPending ? 'A abrir…' : `Abrir exercício ${year + 1}`}
        </button>
        {done && <p className="mt-2 text-xs text-emerald-700">{done}</p>}
        {error && <p role="alert" className="mt-2 border-l-4 border-red-500 bg-red-50 px-3 py-1 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button onClick={onClose} disabled={isPending || disabled} className="h-11 rounded-xl bg-[#a83939] px-5 text-sm font-semibold text-white hover:bg-[#882020] disabled:opacity-60">
        {isPending ? 'A apurar e encerrar…' : 'Apurar resultados e encerrar'}
      </button>
      {done && <p className="mt-2 text-xs text-emerald-700">{done}</p>}
      {error && <p role="alert" className="mt-2 border-l-4 border-red-500 bg-red-50 px-3 py-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
