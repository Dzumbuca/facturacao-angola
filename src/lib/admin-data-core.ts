export type AdminMoneySummary = { invoiced: number; received: number; outstanding: number };

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => value / 100;

export function buildAdminMoneySummary(input: AdminMoneySummary): AdminMoneySummary {
  return {
    invoiced: fromCents(toCents(input.invoiced)),
    received: fromCents(toCents(input.received)),
    outstanding: fromCents(toCents(input.outstanding)),
  };
}
