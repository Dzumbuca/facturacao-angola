'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { closePeriod, reopenPeriod } from '@/lib/gl-period-actions';

export function PeriodActions({ periodId, state, code }: { periodId: string; state: 'OPEN' | 'CLOSED'; code: string }) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (state === 'OPEN') {
    return (
      <button disabled={isPending} onClick={async () => {
        const reason = prompt('Fechar o periodo ' + code + '?\n\nJustifique:', '');
        if (!reason) return;
        
        try {
          await closePeriod(periodId, reason);
          setSuccess('Periodo fechado.');
          start(() => router.refresh());
        } catch (e: any) {
          setError(e?.message ?? 'Falha ao fechar periodo.');
        }
      }} className="h-9 rounded-xl border border-[#a83939] bg-white px-4 text-xs font-semibold text-[#a83939] hover:bg-[#fff4f4] disabled:opacity-60">Fechar periodo</button>
    );
  }

  return (
    <button disabled={isPending} onClick={async () => {
      const reason = prompt('Reabrir o periodo ' + code + '?\n\nJustifique (min. 10 caracteres):', '');
      if (!reason) return;
      
      try {
        await reopenPeriod(periodId, reason);
        setSuccess('Periodo reaberto.');
        start(() => router.refresh());
      } catch (e: any) {
        setError(e?.message ?? 'Falha ao reabrir periodo.');
      }
    }} className="h-9 rounded-xl border border-[#2878d0] bg-white px-4 text-xs font-semibold text-[#2878d0] hover:bg-[#f4f8ff] disabled:opacity-60">Reabrir periodo</button>
  );
}
