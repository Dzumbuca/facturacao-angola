import { describe, it, expect } from 'vitest';
import { isBillingCycle, isPaidPackageSlug, legacyCharge, legacySlugToPackage, monthsForCycle, resolveCharge } from './plan-pricing';

describe('plan-pricing', () => {
  it('mensal usa priceKz e anual usa priceYearly', () => {
    const plan = { priceKz: '5000.00', priceYearly: '51000.00' };
    expect(resolveCharge(plan, 'MONTHLY')).toEqual({ amount: 5000, months: 1 });
    expect(resolveCharge(plan, 'ANNUAL')).toEqual({ amount: 51000, months: 12 });
  });

  it('rejeita anual sem preço anual e valores inválidos', () => {
    expect(resolveCharge({ priceKz: 5000, priceYearly: null }, 'ANNUAL')).toBeNull();
    expect(resolveCharge({ priceKz: 0, priceYearly: 0 }, 'MONTHLY')).toBeNull();
  });

  it('valida slugs e ciclos', () => {
    expect(isPaidPackageSlug('basico')).toBe(true);
    expect(isPaidPackageSlug('gratis')).toBe(false);
    expect(isBillingCycle('ANNUAL')).toBe(true);
    expect(isBillingCycle('YEARLY')).toBe(false);
    expect(monthsForCycle('ANNUAL')).toBe(12);
    expect(monthsForCycle('MONTHLY')).toBe(1);
  });

  it('mantém compatibilidade com pagamentos antigos', () => {
    expect(legacySlugToPackage('BASICO')).toBe('basico');
    expect(legacySlugToPackage('PRO')).toBe('profissional');
    expect(legacySlugToPackage(null)).toBeNull();
    expect(legacyCharge({ priceKz: 5000 }, 3)).toEqual({ amount: 15000, months: 3 });
    expect(legacyCharge({ priceKz: 5000 }, 0)).toBeNull();
  });
});
