'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Revela conteúdo com leve translateY quando entra no ecrã (uma vez). */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(18px)';
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.style.transition = 'opacity .7s cubic-bezier(.22,1,.36,1), transform .7s cubic-bezier(.22,1,.36,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      observer.disconnect();
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref} className={className}>{children}</div>;
}
