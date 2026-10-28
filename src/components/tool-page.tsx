import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getTenantAccess, AuthorizationError } from '@/lib/admin-auth';
import { computeEffectivePlan } from '@/lib/plan';
import { AppShell } from '@/components/app-shell';

// Moldura das páginas do Centro de Ferramentas (/ferramentas):
// - Visitante: vê o site público exactamente como hoje (SiteHeader/SiteFooter
//   já presentes na própria página, SEO e publicidade preservados).
// - Cliente autenticado: permanece na área de gestão — mesmo menu (AppShell),
//   mesmo layout, sessão e contexto da empresa — sem ser redireccionado para
//   páginas públicas. Os blocos de marketing do site público (CTA de registo,
//   header/footer e anúncio do topo) são escondidos por CSS (.tool-authenticated)
//   porque a área autenticada já fornece plano, anúncio lateral e navegação.
// As URLs não mudam: nenhuma lógica de ferramenta é duplicada.
export async function ToolPage({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) return <>{children}</>;

  let access;
  try {
    access = await getTenantAccess();
  } catch (error) {
    // Autenticado sem empresa (ex.: conta Google ainda em configuração):
    // retomar o onboarding, tal como o resto da área de gestão faz.
    if (error instanceof AuthorizationError) redirect('/onboarding');
    throw error;
  }

  const [tenantRow, platformAd] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: access.tenantId }, select: { plan: true, planExpiry: true } }),
    prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } }),
  ]);
  const planInfo = computeEffectivePlan(tenantRow?.plan, tenantRow?.planExpiry);
  const adHtml = planInfo.effectivePlan === 'PRO' ? null : platformAd?.adHtml ?? null;

  return (
    <AppShell platformAdmin={access.platformRole === 'ADMIN'} plan={planInfo.effectivePlan} adHtml={adHtml} planDaysLeft={planInfo.daysLeft} planExpired={planInfo.expired}>
      {access.tenantStatus === 'SUSPENDED' && <p role="status" className="mb-5 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">A empresa está suspensa. Pode consultar e exportar documentos existentes; novas alterações estão bloqueadas.</p>}
      <div className="tool-authenticated">{children}</div>
    </AppShell>
  );
}
