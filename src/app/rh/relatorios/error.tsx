'use client';

import { useEffect } from 'react';

export default function ReportsDebugError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('RH Reports error:', error);
  }, [error]);
  return (
    <div style={{ padding: '32px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', fontSize: '12px', color: '#b91c1c', background: '#fff5f5', borderRadius: '8px' }}>
      <h1 style={{ fontSize: '16px', fontWeight: 700 }}>ERRO ACTUAL (debug temporário)</h1>
      <p>digest: {error.digest ?? '(sem digest)'}</p>
      <pre>{error.stack ?? error.message}</pre>
      <button onClick={() => reset()} style={{ padding: '8px 14px', background: '#021f87', color: '#fff', border: 0, borderRadius: '6px', marginTop: '14px' }}>Tentar novamente</button>
    </div>
  );
}
