'use client';
import Link from 'next/link';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-6">
      <div className="max-w-md text-center space-y-4">
        <img src="/logo.png" alt="Machine Facturas" className="mx-auto h-16 w-16" />
        <h1 className="text-2xl font-bold">Está offline</h1>
        <p className="text-slate-300">
          A Machine Facturas continua disponível. Os dados previamente guardados localmente
          permanecem acessíveis e pode criar rascunhos de factura que serão sincronizados
          quando a ligação regressar.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">Tentar novamente</Link>
        </div>
      </div>
    </main>
  );
}
