'use client';

import { useEffect, useState } from 'react';
import { NavIcon } from '@/components/nav-icons';
import { PWA_DISMISS_KEY, isDismissalActive, isIosDevice, isIosSafari, isStandalone, shouldShowInstall } from '@/lib/pwa';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaInstall() {
  const [mounted, setMounted] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);
  const [iosSafari, setIosSafari] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Na aplicação desktop não há instalação PWA.
    if ((window as unknown as { machineFacturasDesktop?: unknown }).machineFacturasDesktop) return;

    const standalone = isStandalone(window.matchMedia('(display-mode: standalone)').matches, (navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);

    const userAgent = navigator.userAgent;
    setIos(isIosDevice(userAgent, navigator.maxTouchPoints));
    setIosSafari(isIosSafari(userAgent, navigator.vendor));

    try {
      setDismissed(isDismissalActive(Number(window.localStorage.getItem(PWA_DISMISS_KEY) ?? 0)));
    } catch {
      setDismissed(false);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayMode = () => setInstalled(media.matches);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener?.('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener?.('change', onDisplayMode);
    };
  }, []);

  useEffect(() => {
    if (!sheetOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSheetOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sheetOpen]);

  if (!mounted || !shouldShowInstall({ installed, dismissed, hasPrompt: Boolean(deferred), ios })) return null;

  async function install() {
    if (!deferred) {
      setSheetOpen(true);
      return;
    }
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === 'accepted') setInstalled(true);
  }

  function dismiss() {
    try { window.localStorage.setItem(PWA_DISMISS_KEY, String(Date.now())); } catch { /* modo privado */ }
    setDismissed(true);
  }

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+70px)] z-40 flex justify-center px-4 md:hidden">
        <div className="flex items-center gap-1 rounded-full border border-[#dbe4ee] bg-white/95 p-1.5 shadow-[0_10px_30px_rgba(18,36,68,.16)] backdrop-blur">
          <button type="button" onClick={install} className="flex min-h-10 items-center gap-2 rounded-full bg-[#021f87] px-4 text-sm font-semibold text-white transition active:bg-[#061965]">
            <NavIcon name="download" className="h-4 w-4" />
            Instalar app
          </button>
          <button type="button" onClick={dismiss} aria-label="Agora não" className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[#708195] transition hover:bg-[#f2f6fb]">×</button>
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <button type="button" aria-label="Fechar" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-[#071936]/55 backdrop-blur-[2px]" />
          <section role="dialog" aria-modal="true" aria-label={iosSafari ? 'Instalar no iPhone' : 'Instalar no telemóvel'} className="sheet-panel absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#c8d2de]" aria-hidden="true" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-[#1c2d3f]">{iosSafari ? 'Instalar no iPhone' : 'Instalar no telemóvel'}</h2>
                <p className="mt-1 text-sm text-[#708195]">Fica no ecrã inicial e abre como aplicação, sem barra do navegador.</p>
              </div>
              <button type="button" onClick={() => setSheetOpen(false)} aria-label="Fechar" className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-[#708195] hover:bg-[#f2f6fb]">×</button>
            </div>

            {!iosSafari && (
              <p className="mt-3 rounded-lg border border-[#f0dcb9] bg-[#fdf6e9] px-3 py-2 text-xs text-[#8a5a10]">
                No iPhone, abre esta página no <strong>Safari</strong> para poderes instalar.
              </p>
            )}

            <ol className="mt-4 space-y-3 text-sm text-[#26354a]">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[#021f87]"><NavIcon name="share" className="h-4 w-4" /></span>
                <span>1. Toca em <strong>Partilhar</strong> na barra do Safari.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[#021f87]"><NavIcon name="plus" className="h-4 w-4" /></span>
                <span>2. Escolhe <strong>Adicionar ao ecrã principal</strong>.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-[#021f87]"><NavIcon name="grid" className="h-4 w-4" /></span>
                <span>3. Confirma com <strong>Adicionar</strong> — o ícone Machine Facturas aparece no ecrã inicial.</span>
              </li>
            </ol>

            <button type="button" onClick={() => setSheetOpen(false)} className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#021f87] px-4 text-sm font-semibold text-white transition hover:bg-[#061965]">Entendi</button>
          </section>
        </div>
      )}
    </>
  );
}
