import { runWithTenant } from './tenant-db';
import { computeEffectivePlan } from './plan';
import { hasAvailableUnlock } from './ad-unlock-service';

export const FREE_INVOICE_LIMIT = 20;

export type InvoiceQuota = {
  plan: 'FREE' | 'PRO' | string;
  used: number;
  limit: number | null;
  remaining: number | null;
  hasUnlock: boolean;
  canEmit: boolean;
};

export async function getInvoiceQuota(tenantId: string, userId?: string): Promise<InvoiceQuota> {
  return runWithTenant(tenantId, async (tx) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planExpiry: true } });
    const plan = computeEffectivePlan(tenant?.plan, tenant?.planExpiry).effectivePlan;
    if (plan === 'PRO') return { plan, used: 0, limit: null, remaining: null, hasUnlock: false, canEmit: true };

    const used = await tx.invoice.count({ where: { tenantId, type: 'FT' } });
    const hasUnlock = await hasAvailableUnlock(tenantId, tx as any);
    const remaining = Math.max(0, FREE_INVOICE_LIMIT - used);
    return { plan, used, limit: FREE_INVOICE_LIMIT, remaining, hasUnlock, canEmit: remaining > 0 || hasUnlock };
  }, { userId });
}

export const quotaExceeded = (quota: InvoiceQuota): boolean =>
  quota.remaining !== null && quota.remaining <= 0;

export const quotaBlocked = (quota: InvoiceQuota): boolean => quotaExceeded(quota) && !quota.hasUnlock;

export const quotaMessage = (quota: InvoiceQuota): string =>
  `Limite de ${quota.limit} facturas gratuitas atingido (${quota.used}/${quota.limit}). Veja o anúncio para desbloquear a próxima emissão ou suba para o plano Pro.`;

export class AdUnlockRequiredError extends Error {
  constructor(public used: number, public limit: number) {
    super(`Limite de ${limit} facturas gratuitas atingido (${used}/${limit}). Veja o anúncio para desbloquear a próxima emissão.`);
    this.name = 'AdUnlockRequiredError';
  }
}