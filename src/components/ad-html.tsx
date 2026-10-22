'use client';

import { useEffect, useRef } from 'react';

// Renderiza HTML de anúncios externos (Adsterra, A-ADS, AdSense, etc.).
// Dois problemas resolvidos aqui:
// 1) Scripts inseridos via innerHTML não executam — recriamos os <script>.
// 2) Redes como a Adsterra usam document.write, que apagaria a página —
//    interceptamos document.write/writeln e redireccionamos para o contentor.
export function AdHtml({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = '';

    const template = document.createElement('div');
    template.innerHTML = html;

    const originalWrite = document.write.bind(document);
    const originalWriteln = document.writeln.bind(document);
    const buffer = document.createElement('div');
    const bufferedWrite = (...parts: string[]) => { buffer.innerHTML += parts.join(''); };
    const bufferedWriteln = (...parts: string[]) => { buffer.innerHTML += parts.join('') + '\n'; };

    (document as unknown as { write: (...p: string[]) => void }).write = bufferedWrite;
    (document as unknown as { writeln: (...p: string[]) => void }).writeln = bufferedWriteln;

    try {
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
    } finally {
      while (buffer.firstChild) container.appendChild(buffer.firstChild);
      document.write = originalWrite;
      document.writeln = originalWriteln;
    }
  }, [html]);

  return <div ref={containerRef} className="ad-slot" />;
}
