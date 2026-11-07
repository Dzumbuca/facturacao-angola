import Link from 'next/link';
import { auth } from '@/lib/auth';
import { isApplicationEnabled } from '@/lib/platform-apps';

// Defesa em profundidade: mesmo que o proxy não apanhe o pedido, a área de
// stock não renderiza para tenants sem o módulo WMS activo.
export default async function StockLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const tenantId = (session?.user as { tenantId?: string | null } | undefined)?.tenantId;
  if (tenantId) {
    const enabled = await isApplicationEnabled(tenantId, 'wms');
    if (!enabled) {
      return (
        <section className="mx-auto max-w-2xl p-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6" role="alert">
            <h1 className="text-xl font-bold text-[#1c2d3f]">Armazém e Stock não incluído</h1>
            <p className="mt-2 text-sm text-slate-700">
              O módulo de armazém e stock não faz parte do pacote actual da sua empresa.
              Os seus dados continuam guardados e ficam disponíveis assim que o módulo for activado.
            </p>
            <p className="mt-4 text-sm">
              Contacte o comercial para activar o módulo.{' '}
              <Link href="/apps" className="font-semibold text-[#021f87] underline">
                Ver aplicações
              </Link>
            </p>
          </div>
        </section>
      );
    }
  }
  return children;
}
