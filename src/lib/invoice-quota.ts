import { runWithTenant } from './tenant-db';
import { computeEffectivePlan } from './plan';

/** Quota mensal do plano Grátis (substitui o antigo limite vitalício de 20). */
export const FREE_INVOICE_LIMIT_MONTHLY = 15;

/** Limites do mês civil em Africa/Luanda (UTC+1, sem horário de verão). */
export function luandaMonthBounds(now = new Date()): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + 3_600_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - 3_600_000),
    end: new Date(Date.UTC(year, month + 1, 1) - 3_600_000),
  };
}

/**
 * Limite mensal de facturas:
 * - subscrição activa → `max_invoices_per_month` do plano (null = ilimitado);
 * - sem subscrição → modelo legado (PRO ilimitado, FREE 15/mês).
 */
export async function resolveInvoiceLimit(tx: any, tenantId: string, now = new Date()): Promise<number | null> {
  const subscription = await tx.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: ['ACTIVE', 'TRIAL'] },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { startsAt: 'desc' },
    include: { plan: { include: { limits: true } } },
  });
  if (subscription?.plan) {
    const row = (subscription.plan.limits || []).find((l: any) => l.metric === 'max_invoices_per_month');
    return row ? (row.value ?? null) : null;
  }
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planExpiry: true } });
  return computeEffectivePlan(tenant?.plan, tenant?.planExpiry, now).effectivePlan === 'PRO' ? null : FREE_INVOICE_LIMIT_MONTHLY;
}

export async function countInvoicesThisMonth(tx: any, tenantId: string, now = new Date()): Promise<number> {
  const { start, end } = luandaMonthBounds(now);
  return tx.invoice.count({ where: { tenantId, type: 'FT', createdAt: { gte: start, lt: end } } });
}

export async function resolveInvoicePlanLabel(tx: any, tenantId: string, now = new Date()): Promise<string> {
  const subscription = await tx.tenantSubscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIAL'] }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    orderBy: { startsAt: 'desc' },
    include: { plan: true },
  });
  if (subscription?.plan) return subscription.plan.slug;
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planExpiry: true } });
  return computeEffectivePlan(tenant?.plan, tenant?.planExpiry, now).effectivePlan;
}

export type InvoiceQuota = {
  plan: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  hasUnlock: false;
  canEmit: boolean;
  periodStart: Date;
  periodEnd: Date;
};

export async function getInvoiceQuota(tenantId: string, userId?: string): Promise<InvoiceQuota> {
  return runWithTenant(tenantId, async (tx) => {
    const now = new Date();
    const [plan, limit, used] = await Promise.all([
      resolveInvoicePlanLabel(tx, tenantId, now),
      resolveInvoiceLimit(tx, tenantId, now),
      countInvoicesThisMonth(tx, tenantId, now),
    ]);
    const { start, end } = luandaMonthBounds(now);
    const remaining = limit === null ? null : Math.max(0, limit - used);
    return {
      plan,
      used,
      limit,
      remaining,
      hasUnlock: false as const,
      canEmit: remaining === null || remaining > 0,
      periodStart: start,
      periodEnd: end,
    };
  }, { userId });
}

export const quotaExceeded = (quota: InvoiceQuota): boolean =>
  quota.remaining !== null && quota.remaining <= 0;

export const quotaBlocked = (quota: InvoiceQuota): boolean => quotaExceeded(quota);

export const quotaMessage = (quota: InvoiceQuota): string =>
  `Limite de ${quota.limit} facturas por mês atingido (${quota.used}/${quota.limit}). Suba de plano para continuar a emitir.`;

export class InvoiceQuotaExceededError extends Error {
  constructor(public used: number, public limit: number) {
    super(`Limite de ${limit} facturas por mês atingido (${used}/${limit}). Suba de plano para continuar a emitir.`);
    this.name = 'InvoiceQuotaExceededError';
  }
}
