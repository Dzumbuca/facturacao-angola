'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT_ID } from '@/lib/adsense';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseUnitProps = {
  slot: string;
  format?: 'auto' | 'horizontal' | 'rectangle' | 'vertical';
  responsive?: boolean;
  minHeight?: number;
};

// Bloco manual do Google AdSense (<ins class="adsbygoogle">).
// O loader do AdSense é carregado uma única vez pelo rodapé público
// (site-footer.tsx); este componente apenas regista o bloco. O push fica em
// fila no array global adsbygoogle e é processado pelo loader quando
// inicializar — o padrão oficial recomendado pelo Google.
export function AdSenseUnit({ slot, format = 'auto', responsive = true, minHeight = 120 }: AdSenseUnitProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushedRef = useRef(false);

  useEffect(() => {
    const ins = insRef.current;
    if (!ins || pushedRef.current) return;
    // data-ad-status é definido pelo próprio AdSense ("filled"/"unfilled");
    // se já existir, o bloco foi processado e não voltamos a registá-lo
    // (evita duplicação em remontagens do React).
    if (ins.dataset.adStatus) {
      pushedRef.current = true;
      return;
    }
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Sem rede/loader disponível: o bloco permanece invisível (altura mínima
      // apenas), nunca quebra a página.
    }
  }, []);

  return (
    <ins
      ref={insRef}
      className="adsbygoogle"
      style={{ display: 'block', minHeight }}
      data-ad-client={ADSENSE_CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
