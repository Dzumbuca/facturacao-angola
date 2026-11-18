// Agrega o saldo em dívida (FT emitida ainda não paga) por entidade.
// Usado para mostrar "Em dívida · {Kz}" na lista de clientes e
// "Em dívida" na lista de fornecedores.

export type OutstandingInvoice = {
  customerId?: string | null;
  supplierId?: string | null;
  total: number | string | { toNumber(): number };
  payments: { amount: number | string | { toNumber(): number }; status: string }[];
};

const toMoney = (value: OutstandingInvoice['total']): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return value.toNumber();
};

export function aggregateOutstandingByCustomer(invoices: OutstandingInvoice[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.customerId) continue;
    const confirmed = invoice.payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + toMoney(payment.amount), 0);
    const balance = Math.max(0, toMoney(invoice.total) - confirmed);
    if (balance > 0) result.set(invoice.customerId, (result.get(invoice.customerId) ?? 0) + balance);
  }
  return result;
}

export function aggregateOutstandingBySupplier(invoices: OutstandingInvoice[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const invoice of invoices) {
    if (!invoice.supplierId) continue;
    // supplierInvoice has no payments relation; use paidAmount semantic stored in total.
    const total = toMoney(invoice.total);
    const paid = (invoice as { paidAmount?: number | string }).paidAmount;
    const confirmed = paid === undefined ? 0 : toMoney(paid);
    const balance = Math.max(0, total - confirmed);
    if (balance > 0) result.set(invoice.supplierId, (result.get(invoice.supplierId) ?? 0) + balance);
  }
  return result;
}
