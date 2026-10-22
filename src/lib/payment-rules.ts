export type PaymentState = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'REVERSED';
const ACTIVE_RESERVATION_STATES = new Set<PaymentState>(['PENDING', 'CONFIRMED']);

export function getAllowedPaymentTransition(previous: string, next: PaymentState): boolean {
  return (previous === 'PENDING' && (next === 'CONFIRMED' || next === 'CANCELLED'))
    || (previous === 'CONFIRMED' && next === 'REVERSED');
}

export function getInvoicePaymentTotals(total: number, payments: { amount: number; status: string }[]) {
  const confirmed = roundMoney(payments.filter((payment) => payment.status === 'CONFIRMED').reduce((sum, payment) => sum + payment.amount, 0));
  const pending = roundMoney(payments.filter((payment) => payment.status === 'PENDING').reduce((sum, payment) => sum + payment.amount, 0));
  return { confirmed, pending, outstanding: roundMoney(Math.max(0, total - confirmed)) };
}

export function canRecordPayment(total: number, reserved: number, amount: number): boolean {
  if (![total, reserved, amount].every(Number.isFinite) || total < 0 || reserved < 0 || amount <= 0) return false;
  return roundMoney(reserved + amount) <= roundMoney(total) + 0.000001;
}

export function getReservedPaymentAmount(payments: { amount: number; status: string }[]): number {
  return roundMoney(payments.filter((payment) => ACTIVE_RESERVATION_STATES.has(payment.status as PaymentState)).reduce((sum, payment) => sum + payment.amount, 0));
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
