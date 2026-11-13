import { listCommercialPlans, listApplications } from '@/lib/admin-planos';
import { AdminPlanEditor } from '@/components/admin-plan-editor';
import { AdminErrorState } from '@/components/admin-ui';

export default async function AdminPlansPage() {
  let plans = [] as Awaited<ReturnType<typeof listCommercialPlans>>;
  let apps = [] as Awaited<ReturnType<typeof listApplications>>;
  try {
    plans = await listCommercialPlans();
    apps = await listApplications();
  } catch {
    return <AdminErrorState title="Planos comerciais" />;
  }
  return <div><h1 className="text-3xl font-bold">Planos comerciais</h1><p className="mt-2 text-[var(--text-muted)]">Criar, editar e consultar pacotes Free / Stock / RH / Business. Os dados salvam-se na base e entram em vigor imediatamente.</p><AdminPlanEditor plans={plans} applications={apps} /></div>;
}
