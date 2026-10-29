'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AdHtml } from '@/components/ad-html';

type AdUnlockModalProps = {
  adHtml: string | null;
  used: number;
  limit: number;
  onUnlocked: () => void;
  onClose: () => void;
};

type Phase = 'beginning' | 'watching' | 'granted' | 'error';

// Janela de desbloqueio por publicidade.
// Regra: depois do limite de facturas gratuitas, cada emissão exige uma
// visualização com duração mínima. A contagem é iniciada pelo SERVIDOR
// (POST /api/ads/unlock/begin devolve o started_at autoritativo) e a
// conclusão é validada no servidor (POST /api/ads/unlock/complete) — o
// cliente não pode saltar o tempo. No navegador, a contagem só avança com o
// separador visível (Page Visibility API).
export function AdUnlockModal({ adHtml, used, limit, onUnlocked, onClose }: AdUnlockModalProps) {
  const [phase, setPhase] = useState<Phase>('beginning');
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const secondsRef = useRef(20);
  const beganRef = useRef(false);

  // Inicia a sessão de visualização no servidor (uma única vez por montagem).
  // Sem patrocinador configurado não há ciclo de visualização: nada seria
  // mostrado e abrir uma contagem seria simular uma visualização.
  useEffect(() => {
    if (!adHtml) return;
    if (beganRef.current) return;
    beganRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/ads/unlock/begin', { method: 'POST' });
        const data = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok || !data?.status) {
          setPhase('error');
          setMessage(data?.error ?? 'Não foi possível iniciar o desbloqueio. Tente novamente.');
          return;
        }
        if (data.status === 'READY') {
          // Já existia um desbloqueio disponível — nada a visualizar.
          setPhase('granted');
          onUnlocked();
          return;
        }
        startedAtRef.current = Date.parse(data.startedAt);
        secondsRef.current = Number(data.seconds) || 20;
        setPhase('watching');
      } catch {
        if (!cancelled) {
          setPhase('error');
          setMessage('Não foi possível comunicar com o servidor. Verifique a ligação.');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adHtml]);

  // Contagem regressiva — só avança com o separador visível.
  useEffect(() => {
    if (phase !== 'watching') return;
    const tick = () => {
      if (!startedAtRef.current) return;
      if (document.visibilityState !== 'visible') return; // pausa quando oculto
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setWaitSeconds(Math.max(0, Math.ceil(secondsRef.current - elapsed)));
    };
    tick();
    const interval = setInterval(tick, 500);
    const onVisibility = () => tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [phase]);

  const handleComplete = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/ads/unlock/complete', { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.status !== 'GRANTED') {
        setMessage(data?.error ?? 'Não foi possível validar a visualização. Tente novamente.');
        setBusy(false);
        return;
      }
      setPhase('granted');
      onUnlocked();
    } catch {
      setMessage('Não foi possível comunicar com o servidor. Tente novamente.');
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Desbloquear próxima emissão por publicidade" className="fixed inset-0 z-[60] flex items-end justify-center bg-[#071936]/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border border-[#d8e6f5] bg-white p-5 shadow-2xl md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#1c2d3f]">Desbloquear a próxima emissão</h2>
            <p className="mt-1 text-sm leading-6 text-[#4a5f76]">
              Usaste as <strong>{used} de {limit}</strong> facturas gratuitas. Veja o anúncio durante <strong>{secondsRef.current} segundos</strong> para desbloquear <strong>1 factura</strong>. A emissão seguinte pede um novo desbloqueio.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1.5 text-[#708195] transition hover:bg-[#f6f9fc] hover:text-[#1c2d3f]">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {adHtml ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-[#e2e9f1] bg-white p-2">
            <AdHtml html={adHtml} />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-[#f0dfc9] bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            <p>Sem patrocinador disponível neste momento — não é possível validar uma visualização, por isso o desbloqueio automático está inativo.</p>
            <p className="mt-2">Peça o desbloqueio ao suporte ou <Link href="/pagamento" className="font-semibold underline">suba para o plano Pro</Link> — sem anúncios e sem limites.</p>
          </div>
        )}

        {adHtml && <div className="mt-4 flex flex-col items-center gap-3">
          {phase === 'beginning' && <p className="text-sm text-[#708195]">A preparar a visualização…</p>}
          {phase === 'watching' && (
            <>
              <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={secondsRef.current} aria-valuenow={secondsRef.current - waitSeconds}>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#eef2f7]">
                  <div className="h-full rounded-full bg-[#2878d0] transition-all duration-500" style={{ width: `${Math.min(100, ((secondsRef.current - waitSeconds) / secondsRef.current) * 100)}%` }} />
                </div>
              </div>
              <p className="text-sm font-semibold text-[#2c4a68]">
                {waitSeconds > 0 ? <>Mantenha o anúncio visível — faltam <strong>{waitSeconds} s</strong></> : 'Tempo concluído — pode desbloquear.'}
              </p>
              <button
                type="button"
                onClick={handleComplete}
                disabled={waitSeconds > 0 || busy}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#2878d0] px-6 text-base font-bold text-white transition hover:bg-[#216bbd] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'A validar…' : 'Desbloquear emissão'}
              </button>
            </>
          )}
          {phase === 'granted' && <p className="text-sm font-semibold text-[#227958]">✓ Desbloqueado — já pode emitir 1 factura.</p>}
          {phase === 'error' && <p role="alert" className="text-sm font-medium text-[#a83939]">{message}</p>}
          {message && phase !== 'error' && <p role="status" className="text-sm text-[#a83939]">{message}</p>}
          <Link href="/pagamento" className="text-sm font-semibold text-[#2878d0] hover:underline">Ou suba para o plano Pro — sem anúncios nem limites →</Link>
        </div>}
      </div>
    </div>
  );
}
