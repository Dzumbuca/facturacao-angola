'use client';

import { useEffect, useRef } from 'react';

// Renderiza HTML de anúncios externos (Adsterra, A-ADS, AdSense, etc.).
// Scripts inseridos via innerHTML NÃO executam — por isso recriamos os
// elementos <script> manualmente para que corram de verdade.
export function AdHtml({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';
    const template = document.createElement('div');
    template.innerHTML = html;
    for (const node of Array.from(template.childNodes)) {
      if (node.nodeName === 'SCRIPT') {
        const script = document.createElement('script');
        const element = node as HTMLElement;
        for (const attribute of Array.from(element.attributes ?? [])) {
          script.setAttribute(attribute.name, attribute.value);
        }
        script.text = (node as HTMLScriptElement).text;
        container.appendChild(script);
      } else {
        container.appendChild(node.cloneNode(true));
      }
    }
  }, [html]);

  return <div ref={containerRef} />;
}
