import 'server-only';
import { prisma } from './prisma';
import { isApplicationEnabled } from './platform-apps';

export type PlanSlug = 'gratis' | 'basico' | 'profissional' | 'empresarial' | string;

export type PlanCapabilities = {
  transfers: boolean;
};

export type WmsLimits = {
  planSlug: PlanSlug;
  /** null = ilimitado / personalizado */
  maxWarehouses: number | null;
  /** null = limite ainda não definido comercialmente (não aplicado) */
  maxStockProducts: number | null;
  maxProducts: number | null;
  maxClients: number | null;
  maxInvoicesPerMonth: number | null;
  capabilities: PlanCapabilities;
  grandfathered: boolean;
};

const GRANDFATHERED: WmsLimits = {
  planSlug: 'empresarial',
  maxWarehouses: null,
  maxStockProducts: null,
  maxProducts: null,
  maxClients: null,
  maxInvoicesPerMonth: null,
  capabilities: { transfers: true },
  grandfathered: true,
};

const GRATIS: WmsLimits = {
  planSlug: 'gratis',
  maxWarehouses: 0,
  maxStockProducts: null,
  maxProducts: 30,
  maxClients: 30,
  maxInvoicesPerMonth: 15,
  capabilities: { transfers: false },
  grandfathered: false,
};

function toLimits(plan: {
  slug: string;
  limits?: Array<{ metric: string; value: number | null }>;
  capabilities?: Array<{ capability: string; enabled: boolean }>;
}): WmsLimits {
  const valueOf = (metric: string): number | null => {
    const row = (plan.limits || []).find((l) => l.metric === metric);
    if (!row) return null;
    return row.value ?? null;
  };
  const capabilityOf = (name: string): boolean =>
    Boolean((plan.capabilities || []).find((c) => c.capability === name)?.enabled);
  return {
    planSlug: plan.slug,
    maxWarehouses: valueOf('max_warehouses'),
    maxStockProducts: valueOf('max_stock_products'),
    maxProducts: valueOf('max_products'),
    maxClients: valueOf('max_clients'),
    maxInvoicesPerMonth: valueOf('max_invoices_per_month'),
    capabilities: { transfers: capabilityOf('transfers') },
    grandfathered: false,
  };
}

/**
 * Plano efectivo:
 * - subscrição activa (ou trial) com fim futuro → limites do plano;
 * - sem subscrição mas com módulo WMS activo (tenants legados) → grandfathering sem limites;
 * - restantes (Grátis) → limites do Grátis.
 */
export async function getTenantWmsLimits(tenantId: string, db: any = prisma, now = new Date()): Promise<WmsLimits> {
  // Qualquer subscrição (mesmo expirada) tira o tenant do grandfathering.
  const subscription = await db.tenantSubscription.findFirst({
    where: { tenantId },
    orderBy: { startsAt: 'desc' },
    include: { plan: { include: { limits: true, capabilities: true } } },
  });
  if (subscription) {
    const active = (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL')
      && (!subscription.endsAt || subscription.endsAt.getTime() > now.getTime());
    if (active && subscription.plan) return toLimits(subscription.plan);
    // Expirada/cancelada: cai para Grátis (sem grandfathering).
    return GRATIS;
  }

  // Compatibilidade com o modelo legado: quem já tem o módulo activo mantém acesso.
  if (await isApplicationEnabled(tenantId, 'wms')) return GRANDFATHERED;
  return GRATIS;
}

export async function getWarehouseLimitStatus(
  tx: any,
  tenantId: string,
): Promise<{ allowed: true; limit: number | null; used: number } | { allowed: false; limit: number; used: number }> {
  const limits = await getTenantWmsLimits(tenantId, tx);
  const used = await tx.warehouse.count({ where: { tenantId, isActive: true } });
  if (limits.maxWarehouses === null || used < limits.maxWarehouses) {
    return { allowed: true, limit: limits.maxWarehouses, used };
  }
  return { allowed: false, limit: limits.maxWarehouses, used };
}

export type CountLimitMetric = 'max_products' | 'max_clients';

export async function getCountLimitStatus(
  tx: any,
  tenantId: string,
  metric: CountLimitMetric,
  used: number,
): Promise<{ allowed: true; limit: number | null } | { allowed: false; limit: number; used: number }> {
  const limits = await getTenantWmsLimits(tenantId, tx);
  const limit = metric === 'max_products' ? limits.maxProducts : limits.maxClients;
  if (limit === null || used < limit) return { allowed: true, limit };
  return { allowed: false, limit, used };
}

export async function hasCapability(tenantId: string, capability: keyof PlanCapabilities): Promise<boolean> {
  const limits = await getTenantWmsLimits(tenantId);
  return Boolean(limits.capabilities[capability]);
}
