import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantAccess, AuthorizationError } from '@/lib/admin-auth';
import { computeEffectivePlan } from '@/lib/plan';
import { getWmsAccess } from '@/lib/entitlements';
import { AppShell } from '@/components/app-shell';
import { DesktopOfflineBootstrap } from '@/components/desktop-offline-bootstrap';

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  let session;
  try {
    session = await auth();
  } catch (error) {
    // Erro de infraestrutura na validação da sessão: não disfarçar com redirect genérico.
    // Registar apenas a mensagem (sem segredos/PII) e propagar a causa original.
    console.error('[DashboardLayout] auth() failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
  if (!session?.user) redirect('/inicio');
  let access;
  try {
    access = await getTenantAccess();
  } catch (error) {
    // Sem empresa (ex.: conta criada com Google): seguir para o onboarding
    // em vez de voltar ao login.
    if (error instanceof AuthorizationError) redirect('/onboarding');
    console.error('[DashboardLayout] getTenantAccess() failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
  const sessionUser = session.user as any;
  const tenantId = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
  let tenantRow: { plan: string | null; planExpiry: string | null } | null = null;
  let platformAd: { adHtml: string | null } | null = null;
  let wmsAccess = { allowed: false };
  try {
    const results = await Promise.all([
      tenantId ? prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planExpiry: true } }) : Promise.resolve(null),
      prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } }),
      tenantId ? getWmsAccess(tenantId) : Promise.resolve({ allowed: false }),
    ]);
    [tenantRow, platformAd, wmsAccess] = results;
  } catch (error) {
    // Erro de infraestrutura nas consultas de tenant: não disfarçar com redirect genérico.
    console.error('[DashboardLayout] tenant data queries failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
  const planExpiry = tenantRow?.planExpiry ? new Date(tenantRow.planExpiry) : null;
  const planInfo = computeEffectivePlan(tenantRow?.plan, planExpiry);
  const adHtml = planInfo.effectivePlan === 'PRO' ? null : platformAd?.adHtml ?? null;
  return <AppShell platformAdmin={access.platformRole === 'ADMIN'} plan={planInfo.effectivePlan} adHtml={adHtml} planDaysLeft={planInfo.daysLeft} planExpired={planInfo.expired} wmsEnabled={wmsAccess.allowed}>
    {access.tenantStatus === 'SUSPENDED' && <p role="status" className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">A empresa está suspensa. Pode consultar e exportar documentos existentes; novas alterações est\u00e3o bloqueadas.</p>}
    <DesktopOfflineBootstrap />
    {children}
  </AppShell>;
}
