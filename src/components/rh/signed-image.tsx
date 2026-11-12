'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** Avatar a partir de um path no bucket privado (signed URL de 1h). */
export function SignedImage({ path, alt, className, fallback }: { path?: string | null; alt: string; className?: string; fallback?: ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setUrl(null);
    setFailed(false);
    if (!path) return;
    fetch(`/api/rh/signed-url?path=${encodeURIComponent(path)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!mounted) return;
        if (data?.url) setUrl(data.url as string);
        else setFailed(true);
      })
      .catch(() => mounted && setFailed(true));
    return () => { mounted = false; };
  }, [path]);

  if (!path || failed) return <div className={className}>{fallback}</div>;
  if (!url) return <div className={`${className ?? ''} animate-pulse bg-[#eef2f6]`} aria-label="A carregar fotografia" />;
  return <img src={url} alt={alt} className={className} />;
}
