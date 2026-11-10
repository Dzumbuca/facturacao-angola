'use client';

import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function RhPwa() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/rh-sw.js', { scope: '/rh/' }).catch(() => {});
    }
    setInstalled(window.matchMedia('(display-mode: standalone)').matches);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => { setInstalled(true); setInstallEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!installEvent) { setIosOpen(true); return; }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#cdddeb] bg-white px-3 py-2 text-sm font-semibold text-[#021f87] transition hover:bg-[#f2f6fb]"
      >
        <span aria-hidden="true">↓</span> Instalar Machine RH
      </button>
      {iosOpen && (
        <div role="dialog" aria-modal="true" aria-label="Instalar Machine RH" className="fixed inset-0 z-[80] flex items-end justify-center bg-[#102b46]/50 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-[#1c2d3f]">Instalar no iPhone/iPad</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#52667a]">
              <li>Abra esta página no Safari.</li>
              <li>Toque no botão <strong>Partilhar</strong>.</li>
              <li>Escolha <strong>Adicionar ao ecrã principal</strong>.</li>
            </ol>
            <button type="button" onClick={() => setIosOpen(false)} className="mt-4 min-h-10 w-full rounded-lg bg-[#021f87] px-4 py-2 text-sm font-semibold text-white">Entendi</button>
          </div>
        </div>
      )}
    </>
  );
}
