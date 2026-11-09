export type PaidPackageSlug = 'basico' | 'profissional' | 'empresarial';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export const PAID_PACKAGE_SLUGS: readonly PaidPackageSlug[] = ['basico', 'profissional', 'empresarial'];
export const BILLING_CYCLES: readonly BillingCycle[] = ['MONTHLY', 'ANNUAL'];

export const isPaidPackageSlug = (value: unknown): value is PaidPackageSlug =>
  typeof value === 'string' && (PAID_PACKAGE_SLUGS as readonly string[]).includes(value);

export const isBillingCycle = (value: unknown): value is BillingCycle =>
  typeof value === 'string' && (BILLING_CYCLES as readonly string[]).includes(value);

export function monthsForCycle(cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? 12 : 1;
}

/** Preço cobrado no servidor: nunca confiar no valor enviado pelo cliente. */
export function resolveCharge(
  plan: { priceKz: unknown; priceYearly?: unknown },
  cycle: BillingCycle,
): { amount: number; months: number } | null {
  if (cycle === 'ANNUAL') {
    const yearly = plan.priceYearly == null ? null : Number(plan.priceYearly);
    if (!Number.isFinite(yearly) || !yearly || yearly <= 0) return null;
    return { amount: yearly, months: 12 };
  }
  const monthly = Number(plan.priceKz);
  if (!Number.isFinite(monthly) || monthly <= 0) return null;
  return { amount: monthly, months: 1 };
}

/** Compatibilidade com pagamentos antigos (BASICO/PRO e meses livres). */
export function legacyCharge(plan: { priceKz: unknown }, months: number): { amount: number; months: number } | null {
  const monthly = Number(plan.priceKz);
  if (!Number.isFinite(monthly) || monthly <= 0 || !Number.isInteger(months) || months < 1 || months > 12) return null;
  return { amount: monthly * months, months };
}

export function legacySlugToPackage(plan: string | null | undefined): PaidPackageSlug | null {
  if (plan === 'BASICO') return 'basico';
  if (plan === 'PRO') return 'profissional';
  return null;
}
