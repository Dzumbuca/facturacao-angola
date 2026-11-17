'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { closeExercise } from '@/lib/gl-period-actions';

export function CloseExerciseButton({ year, exerciseId, disabled }: { year: number; exerciseId: string; disabled: boolean }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState('');

  const onClose = () => {
    if (disabled) { alert('Exercício tem bloqueadores — não pode ser encerrado.'); return; }
    const reason = prompt('Fechar o exercício ' + year + '?\n\nJustifique (mín. 5 caracteres):', '');
    if (!reason) return;
    setError('');
    start(async () => {
      try {
        // Cast — the server action accepts (exerciseId, justification)
        await closeExercise(exerciseId, reason);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Falha.');
      }
    });
  };

  return (
    <button disabled={isPending || disabled} onClick={onClose} className="h-11 rounded-xl bg-[#a83939] px-5 text-sm font-semibold text-white hover:bg-[#882020] disabled:opacity-60">
      {isPending ? 'A encerrar…' : 'Encerrar exercício'}
    </button>
  );
}
