import { auth } from '@/lib/auth';
import { listTenantApplications } from '@/lib/platform-apps';

export default async function MachineAppsPage() {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  const apps = tenantId ? await listTenantApplications(tenantId) : [];
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Machine Apps</h1>
      <p className="text-gray-500 mb-6">Aplicações disponíveis na sua plataforma.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {apps.map((a: any) => (
          <div key={a.slug} className="border rounded-lg p-4">
            <h2 className="font-semibold">{a.name}</h2>
            <p className="text-sm text-gray-500">{a.description}</p>
            <div className="mt-3">
              {a.enabled ? (
                <span className="text-green-600 text-sm font-medium">Activa</span>
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
