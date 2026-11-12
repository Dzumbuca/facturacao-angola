'use client';

import { useEffect, useState } from 'react';

type Props = { value: number; durationMs?: number };

/** Conta progressivamente de 0 até `value` quando entra no ecrã. */
export function CountUp({ value, durationMs = 900 }: Props) {
  const [display, setDisplay] = useState(0);
  const target = Math.max(0, value);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return <span className="tabular-nums">{display}</span>;
}
