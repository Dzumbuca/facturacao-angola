import { auth } from '@/lib/auth';
import { listTenantApplications } from '@/lib/platform-apps';

const APP_HREF: Record<string, string> = {
  'machine-facturas': '/dashboard',
  wms: '/warehouses',
  rh: '/rh/dashboard',
};

export default async function MachineAppsPage({ searchParams }: { searchParams?: Promise<{ wms?: string; rh?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const session = await auth();
  const tenantId = (session?.user as { tenantId?: string | null } | undefined)?.tenantId;
  const apps = tenantId ? await listTenantApplications(tenantId) : [];
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Machine Apps</h1>
      {params?.wms === 'bloqueado' && (
        <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
          O módulo <strong>Armazém e Stock</strong> não está incluído no pacote actual da sua empresa.
          <a href="/pagamento" className="ml-1 font-semibold text-[#021f87] underline">Ver pacotes disponíveis</a> para o activar.
        </div>
      )}
      {params?.rh && (
        <div role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
          O módulo <strong>Machine RH</strong> {params.rh === 'sem-permissao' ? 'não está disponível para o seu perfil.' : 'não está activo para esta empresa.'}
          <a href="/pagamento" className="ml-1 font-semibold text-[#021f87] underline">Falar sobre o Machine RH</a> para o activar.
        </div>
      )}
      <p className="text-gray-500 mb-6">Aplicações disponíveis na sua plataforma.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {apps.map((a: any) => (
          <div key={a.slug} className="border rounded-lg p-4">
            <h2 className="font-semibold">{a.name}</h2>
            <p className="text-sm text-gray-500">{a.description}</p>
            <div className="mt-3">
              {a.enabled ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-green-600 text-sm font-medium">Activa</span>
                  {APP_HREF[a.slug] && (
                    <a href={APP_HREF[a.slug]} className="inline-flex min-h-9 items-center rounded-lg bg-[#021f87] px-3 text-xs font-semibold text-white">
                      Abrir →
                    </a>
                  )}
                </div>
              ) : (
                <span className="text-gray-400 text-sm">Não contratada</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
