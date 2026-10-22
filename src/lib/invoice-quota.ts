import { prisma } from './prisma';

export const FREE_MONTHLY_INVOICE_LIMIT = 20;

export type InvoiceQuota = {
  plan: 'FREE' | 'PRO' | string;
  issuedThisMonth: number;
  limit: number | null;
  remaining: number | null;
};

// Conta facturas emitidas no mês civil corrente (excepto anuladas)
// e aplica o limite do plano Grátis. Pro é ilimitado.
export async function getInvoiceQuota(tenantId: string): Promise<InvoiceQuota> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true } });
  const plan = tenant?.plan ?? 'FREE';
  if (plan === 'PRO') return { plan, issuedThisMonth: 0, limit: null, remaining: null };

  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const issuedThisMonth = await prisma.invoice.count({
    where: { tenantId, issuedAt: { gte: start }, status: { not: 'CANCELLED' } },
  });
  return { plan, issuedThisMonth, limit: FREE_MONTHLY_INVOICE_LIMIT, remaining: Math.max(0, FREE_MONTHLY_INVOICE_LIMIT - issuedThisMonth) };
}

export const quotaExceeded = (quota: InvoiceQuota): boolean =>
  quota.remaining !== null && quota.remaining <= 0;

export const quotaUpgradeMessage = (quota: InvoiceQuota): string =>
  `Limite do plano Grátis atingido (${quota.issuedThisMonth}/${quota.limit} facturas este mês). Suba para o plano Pro para emitir sem limites.`;
