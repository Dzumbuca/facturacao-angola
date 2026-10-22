export type InvoiceLine = { qty: number; rate: number; taxRate?: number };
export type InvoiceDiscount = { type?: 'amount' | 'percent'; value?: number; applyVat?: boolean };

export const calculateInvoiceTotals = (items: InvoiceLine[], options: InvoiceDiscount = {}) => {
  const subTotal = items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const roundedSubTotal = Math.round((subTotal + Number.EPSILON) * 100) / 100;
  const rawDiscount = options.type === 'percent'
    ? roundedSubTotal * Math.max(0, Number(options.value) || 0) / 100
    : Math.max(0, Number(options.value) || 0);
  const discountAmount = Math.round((Math.min(roundedSubTotal, rawDiscount) + Number.EPSILON) * 100) / 100;
  const taxableBase = Math.round((Math.max(0, roundedSubTotal - discountAmount) + Number.EPSILON) * 100) / 100;
  const taxableRatio = roundedSubTotal > 0 ? taxableBase / roundedSubTotal : 0;
  const taxTotal = options.applyVat === false ? 0 : items.reduce((sum, item) => {
    const rate = item.taxRate ?? 14;
    return sum + item.qty * item.rate * taxableRatio * (rate / 100);
  }, 0);
  const roundedTaxTotal = Math.round((taxTotal + Number.EPSILON) * 100) / 100;

  return {
    subTotal: roundedSubTotal,
    discountAmount,
    taxableBase,
    taxTotal: roundedTaxTotal,
    total: Math.round((taxableBase + roundedTaxTotal + Number.EPSILON) * 100) / 100,
  };
};
