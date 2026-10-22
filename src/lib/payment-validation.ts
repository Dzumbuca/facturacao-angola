export const PAYMENT_METHODS = ['BANK_TRANSFER', 'MULTICAIXA_EXPRESS', 'MULTICAIXA_REFERENCE', 'CASH', 'OTHER'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export type PaymentInput = {
  amount: number;
  currency: 'AOA';
  method: PaymentMethod;
  status: 'PENDING';
  paymentDate: Date;
  reference: string | null;
  notes: string | null;
  idempotencyKey: string;
};

export function validatePaymentInput(input: unknown): { ok: true; value: PaymentInput } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Dados inválidos.' };
  const data = input as Record<string, unknown>;
  const amount = Number(data.amount);
  const method = data.method;
  const key = typeof data.idempotencyKey === 'string' ? data.idempotencyKey.trim() : '';
  const paymentDate = data.paymentDate === undefined ? new Date() : new Date(String(data.paymentDate));
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) return { ok: false, error: 'O valor do pagamento deve ser positivo e ter no máximo duas casas decimais.' };
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) return { ok: false, error: 'Método de pagamento inválido.' };
  if (data.currency !== undefined && data.currency !== 'AOA') return { ok: false, error: 'A moeda suportada é AOA.' };
  if (!Number.isFinite(paymentDate.getTime())) return { ok: false, error: 'A data de pagamento é inválida.' };
  if (!key || key.length > 120) return { ok: false, error: 'A chave de idempotência é obrigatória.' };
  if (typeof data.reference === 'string' && data.reference.length > 160) return { ok: false, error: 'A referência é demasiado longa.' };
  if (typeof data.notes === 'string' && data.notes.length > 2000) return { ok: false, error: 'As observações são demasiado longas.' };
  return {
    ok: true,
    value: {
      amount,
      currency: 'AOA',
      method: method as PaymentMethod,
      status: 'PENDING',
      paymentDate,
      reference: typeof data.reference === 'string' ? data.reference.trim() || null : null,
      notes: typeof data.notes === 'string' ? data.notes.trim() || null : null,
      idempotencyKey: key,
    },
  };
}
