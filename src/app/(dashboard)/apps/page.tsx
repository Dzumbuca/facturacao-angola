import { auth } from '@/lib/auth';
import { listTenantApplications } from '@/lib/platform-apps';
import { AppsClient } from '@/components/apps/apps-client';

export default async function MachineAppsPage({ searchParams }: { searchParams?: Promise<{ wms?: string; rh?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const session = await auth();
  const tenantId = (session?.user as { tenantId?: string | null } | undefined)?.tenantId;
  const apps = tenantId ? await listTenantApplications(tenantId) : [];
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text)] sm:text-3xl">As suas aplicações</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">Explore as ferramentas disponíveis e expanda a gestão da sua empresa através de módulos integrados.</p>
      </header>
      {params?.wms === 'bloqueado' && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          O módulo <strong>Armazém e Stock</strong> não está incluído no pacote actual.
          <a href="/pagamento" className="ml-1 font-semibold text-amber-900 underline dark:text-amber-100">Ver como o activar →</a>
        </div>
      )}
      {params?.rh && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          O módulo <strong>Machine RH</strong> {params.rh === 'sem-permissao' ? 'não está disponível para o seu perfil.' : 'não está activo para esta empresa.'}
          <a href="/pagamento" className="ml-1 font-semibold text-amber-900 underline dark:text-amber-100">Ver como o activar →</a>
        </div>
      )}
      <AppsClient initialApps={apps as any[]} />
    </div>
  );
}
