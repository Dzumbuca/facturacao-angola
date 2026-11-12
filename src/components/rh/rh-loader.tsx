'use client';

import { useEffect, useState } from 'react';

const FILL_MS = 1300;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Loader Machine RH — contador 000→100 + painel escuro que desliza para cima. */
export function RhLoader() {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / FILL_MS);
      setProgress(Math.round(easeInOutCubic(t) * 100));
      if (t < 1) { raf = requestAnimationFrame(tick); return; }
      setLeaving(true);
      const exitStart = performance.now();
      const exit = () => {
        const et = Math.min(1, (performance.now() - exitStart) / 700);
        if (et < 1) { raf = requestAnimationFrame(exit); return; }
        setDone(true);
      };
      raf = requestAnimationFrame(exit);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (done) return null;
  const padded = String(progress).padStart(3, '0');
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[120] flex flex-col items-center justify-center gap-6 rounded-b-2xl bg-[#0a0a0a] text-white transition-transform duration-700"
      style={{ transform: leaving ? 'translateY(-100%)' : 'translateY(0)', transitionTimingFunction: 'cubic-bezier(.22,1,.36,1)' }}
    >
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="#5f93ff" aria-hidden><path d="M24 2c2.2 13.8 7.9 19.6 22 22-14.1 2.4-19.8 8.2-22 22-2.2-13.8-7.9-19.6-22-22 14.1-2.4 19.8-8.2 22-22Z"/></svg>
          Machine RH
        </div>
        <p className="max-w-[24ch] text-center text-xs text-white/55">Bold ideas, shipped with quiet precision.</p>
      </div>
      <div className="w-[min(22rem,72vw)] space-y-3">
        <div className="h-px w-full bg-white/15"><div className="h-full bg-[#5f93ff]" style={{ width: `${progress}%` }} /></div>
        <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[.06em] text-white/45">
          <span>Loading</span>
          <span className="tabular-nums text-white/80">{padded}</span>
        </div>
      </div>
    </div>
  );
}
