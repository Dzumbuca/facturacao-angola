import 'server-only';
import { prisma } from './prisma';
import { isApplicationEnabled } from './platform-apps';

export type PlanSlug = 'gratis' | 'basico' | 'profissional' | 'empresarial' | string;

export type WmsLimits = {
  planSlug: PlanSlug;
  /** null = ilimitado / personalizado */
  maxWarehouses: number | null;
  /** null = limite ainda não definido comercialmente (não aplicado) */
  maxStockProducts: number | null;
  grandfathered: boolean;
};

const GRANDFATHERED: WmsLimits = {
  planSlug: 'empresarial',
  maxWarehouses: null,
  maxStockProducts: null,
  grandfathered: true,
};

const GRATIS: WmsLimits = {
  planSlug: 'gratis',
  maxWarehouses: 0,
  maxStockProducts: null,
  grandfathered: false,
};

function toLimits(plan: { slug: string; limits?: Array<{ metric: string; value: number | null }> }): WmsLimits {
  const valueOf = (metric: string): number | null => {
    const row = (plan.limits || []).find((l) => l.metric === metric);
    if (!row) return null;
    return row.value ?? null;
  };
  return {
    planSlug: plan.slug,
    maxWarehouses: valueOf('max_warehouses'),
    maxStockProducts: valueOf('max_stock_products'),
    grandfathered: false,
  };
}

/**
 * Plano efectivo de WMS:
 * - subscrição activa (ou trial) com fim futuro → limites do plano;
 * - sem subscrição mas com módulo WMS activo (tenants legados) → grandfathering sem limites;
 * - restantes (Grátis) → 0 armazéns.
 */
export async function getTenantWmsLimits(tenantId: string, db: any = prisma, now = new Date()): Promise<WmsLimits> {
  const subscription = await db.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'TRIAL'] },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { startsAt: 'desc' },
    include: { plan: { include: { limits: true } } },
  });
  if (subscription?.plan) return toLimits(subscription.plan);

  // Compatibilidade com o modelo legado: quem já tem o módulo activo mantém acesso.
  if (await isApplicationEnabled(tenantId, 'wms')) return GRANDFATHERED;
  return GRATIS;
}

export async function getWarehouseLimitStatus(
  tx: any,
  tenantId: string,
): Promise<{ allowed: true; limit: number | null; used: number } | { allowed: false; limit: number; used: number }> {
  const limits = await getTenantWmsLimits(tenantId, tx);
  if (limits.maxWarehouses === null) {
    const used = await tx.warehouse.count({ where: { tenantId, isActive: true } });
    return { allowed: true, limit: null, used };
  }
  const used = await tx.warehouse.count({ where: { tenantId, isActive: true } });
  if (used >= limits.maxWarehouses) return { allowed: false, limit: limits.maxWarehouses, used };
  return { allowed: true, limit: limits.maxWarehouses, used };
}
