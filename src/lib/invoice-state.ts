export type InvoiceDisplayState = 'DRAFT' | 'CANCELLED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'ISSUED';

export type InvoiceStateInput = {
  status: string;
  type: string;
  dueAt: Date | null;
  total: number | string | { toNumber(): number };
};

const toMoney = (value: InvoiceStateInput['total']) =>
  typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : value.toNumber();

const dateInLuanda = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const getInvoiceState = (
  invoice: InvoiceStateInput,
  confirmedAmount: number,
  now: Date = new Date(),
): InvoiceDisplayState => {
  if (invoice.status === 'DRAFT') return 'DRAFT';
  if (invoice.status === 'ANULADA' || invoice.type === 'NC') return 'CANCELLED';

  const total = toMoney(invoice.total);
  if (total > 0 && confirmedAmount >= total - 0.005) return 'PAID';
  if (invoice.dueAt && dateInLuanda(invoice.dueAt) < dateInLuanda(now)) return 'OVERDUE';
  if (confirmedAmount > 0) return 'PARTIALLY_PAID';
  return 'ISSUED';
};
