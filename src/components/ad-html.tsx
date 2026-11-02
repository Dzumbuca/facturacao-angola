'use client';

import { useEffect, useRef } from 'react';

// Ad network snippets are stored in platformConfig.adHtml. Scripts added with
// innerHTML do not run. Adsterra scripts also use document.write to emit more
// scripts or an iframe, so capture that output and activate each nested script
// before restoring the document methods.
export function AdHtml({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    container.innerHTML = '';

    const originalWrite = document.write;
    const originalWriteln = document.writeln;
    let written = '';
    document.write = (...parts: string[]) => { written += parts.join(''); };
    document.writeln = (...parts: string[]) => { written += `${parts.join('')}\n`; };

    const flushWritten = async (): Promise<void> => {
      while (written && !cancelled) {
        const markup = written;
        written = '';
        const parsed = document.createElement('template');
        parsed.innerHTML = markup;
        await processNodes(Array.from(parsed.content.childNodes));
      }
    };

    const processNodes = async (nodes: ChildNode[]): Promise<void> => {
      for (const node of nodes) {
        if (cancelled) return;
        if (node.nodeName !== 'SCRIPT') {
          container.appendChild(node.cloneNode(true));
          continue;
        }

        const source = node as HTMLScriptElement;
        const src = source.getAttribute('src') ?? '';
        if (src.includes('adsbygoogle.js') && document.querySelector('script[src*="adsbygoogle.js"]')) continue;

        const script = document.createElement('script');
        for (const attribute of Array.from(source.attributes)) script.setAttribute(attribute.name, attribute.value);
        script.text = source.text;

        if (src) {
          // Keep document.write redirected until the external script has run;
          // otherwise a late write can replace the entire application page.
          await new Promise<void>((resolve) => {
            const timeout = window.setTimeout(resolve, 15000);
            script.onload = () => { window.clearTimeout(timeout); resolve(); };
            script.onerror = () => { window.clearTimeout(timeout); resolve(); };
            container.appendChild(script);
          });
        } else {
          container.appendChild(script);
        }
        await flushWritten();
      }
    };

    void (async () => {
      try {
        const parsed = document.createElement('template');
        parsed.innerHTML = html;
        await processNodes(Array.from(parsed.content.childNodes));
        await flushWritten();
      } finally {
        document.write = originalWrite;
        document.writeln = originalWriteln;
      }
    })();

    return () => {
      cancelled = true;
      document.write = originalWrite;
      document.writeln = originalWriteln;
    };
  }, [html]);

  return <div ref={containerRef} className="ad-slot" />;
}
