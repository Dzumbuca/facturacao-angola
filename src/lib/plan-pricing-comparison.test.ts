import { describe, it, expect } from 'vitest';
import { computePlanPricingSummary } from './plan-pricing-comparison';

describe('computePlanPricingSummary', () => {
  it('free returns monthly 0 with no discount', () => {
    const s = computePlanPricingSummary({ priceKz: 0 });
    expect(s.monthly).toBe(0);
    expect(s.discountSaving).toBeNull();
  });

  it('computes monthly equivalent for yearly plan', () => {
    const s = computePlanPricingSummary({ priceKz: 5000, priceYearly: 51000 });
    expect(s.yearlyMonthlyEquivalent).toBe(4250);
  });

  it('computes discount when previous price is higher', () => {
    const s = computePlanPricingSummary({ priceKz: 5000, previousPriceKz: 6000 });
    expect(s.discountSaving).toBe(1000);
    expect(s.discountPercentage).toBe(17);
  });

  it('nulls discount when previous price is lower', () => {
    const s = computePlanPricingSummary({ priceKz: 5000, previousPriceKz: 4000 });
    expect(s.discountSaving).toBeNull();
  });

  it('handles null previous price', () => {
    const s = computePlanPricingSummary({ priceKz: 3500 });
    expect(s.discountSaving).toBeNull();
  });

  it('ignores negative inputs', () => {
    const s = computePlanPricingSummary({ priceKz: 3500, priceYearly: -1000 });
    expect(s.yearly).toBeNull();
  });
});
