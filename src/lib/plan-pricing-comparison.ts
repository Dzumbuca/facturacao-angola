export type PlanPricingSummary = {
  monthly: number;
  quarterly: number | null;
  semiannual: number | null;
  yearly: number | null;
  previousPriceKz: number | null;
  quarterlyMonthlyEquivalent: number | null;
  semiannualMonthlyEquivalent: number | null;
  yearlyMonthlyEquivalent: number | null;
  discountSaving: number | null;
  discountPercentage: number | null;
};

const toMaybePositiveNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
};

export function computePlanPricingSummary(input: {
  priceKz: number;
  priceQuarterly?: number | null;
  priceSemiannual?: number | null;
  priceYearly?: number | null;
  previousPriceKz?: number | null;
}): PlanPricingSummary {
  const monthly = Math.max(0, Math.round(input.priceKz));
  const quarterly = toMaybePositiveNumber(input.priceQuarterly);
  const semiannual = toMaybePositiveNumber(input.priceSemiannual);
  const yearly = toMaybePositiveNumber(input.priceYearly);
  const previousPriceKz = toMaybePositiveNumber(input.previousPriceKz);

  const quarterlyMonthlyEquivalent = quarterly === null ? null : Math.round(quarterly / 3);
  const semiannualMonthlyEquivalent = semiannual === null ? null : Math.round(semiannual / 6);
  const yearlyMonthlyEquivalent = yearly === null ? null : Math.round(yearly / 12);

  let discountSaving: number | null = null;
  let discountPercentage: number | null = null;
  if (previousPriceKz !== null && previousPriceKz > monthly) {
    discountSaving = previousPriceKz - monthly;
    discountPercentage = Math.round((discountSaving / previousPriceKz) * 100);
  }

  return {
    monthly,
    quarterly,
    semiannual,
    yearly,
    previousPriceKz,
    quarterlyMonthlyEquivalent,
    semiannualMonthlyEquivalent,
    yearlyMonthlyEquivalent,
    discountSaving,
    discountPercentage,
  };
}
