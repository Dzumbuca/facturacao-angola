import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantAccess, AuthorizationError } from '@/lib/admin-auth';
import { computeEffectivePlan } from '@/lib/plan';
import { AppShell } from '@/components/app-shell';
import { DesktopOfflineBootstrap } from '@/components/desktop-offline-bootstrap';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  let access;
  try {
    access = await getTenantAccess();
  } catch (error) {
    // Sem empresa (ex.: conta criada com Google): seguir para o onboarding
    // em vez de voltar ao login.
    if (error instanceof AuthorizationError) redirect('/onboarding');
    throw error;
  }
  const sessionUser = session.user as any;
  const tenantId = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
  const [tenantRow, platformAd] = await Promise.all([
    tenantId ? prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planExpiry: true } }) : Promise.resolve(null),
    prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } }),
  ]);
  const planInfo = computeEffectivePlan(tenantRow?.plan, tenantRow?.planExpiry);
  const adHtml = planInfo.effectivePlan === 'PRO' ? null : platformAd?.adHtml ?? null;
  return <AppShell platformAdmin={access.platformRole === 'ADMIN'} plan={planInfo.effectivePlan} adHtml={adHtml} planDaysLeft={planInfo.daysLeft} planExpired={planInfo.expired}>
    {access.tenantStatus === 'SUSPENDED' && <p role="status" className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">A empresa está suspensa. Pode consultar e exportar documentos existentes; novas alterações estão bloqueadas.</p>}
    <DesktopOfflineBootstrap />
    {children}
  </AppShell>;
}
