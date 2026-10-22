export type InvoiceDraftInput = {
  customerName: string;
  customerNif: string | null;
  items: { desc: string; qty: number; rate: number; productId: string | null }[];
  applyVat: boolean;
  discountType: 'amount' | 'percent';
  discountValue: number;
  observations: string | null;
  includeCompanyProfile: boolean;
  currency: 'AOA';
  dueAt: Date | null;
  companyBankAccountId: string | null;
};

type Result = { ok: true; value: InvoiceDraftInput } | { ok: false; error: string };

export function validateInvoiceDraftInput(input: unknown): Result {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Dados inválidos.' };
  const data = input as Record<string, unknown>;
  const customerName = typeof data.customerName === 'string' ? data.customerName.trim() : '';
  const customerNif = typeof data.customerNif === 'string' ? data.customerNif.trim() || null : null;
  if (customerName.length > 160 || (customerNif?.length ?? 0) > 40) return { ok: false, error: 'Os dados do cliente excedem o limite permitido.' };
  if (data.currency !== undefined && data.currency !== 'AOA') return { ok: false, error: 'A moeda suportada é AOA.' };
  if (typeof data.observations === 'string' && data.observations.length > 2000) return { ok: false, error: 'As observações não podem exceder 2000 caracteres.' };

  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length > 100) return { ok: false, error: 'A factura não pode exceder 100 linhas.' };
  const items: InvoiceDraftInput['items'] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Uma linha de artigo é inválida.' };
    const item = raw as Record<string, unknown>;
    const desc = typeof item.desc === 'string' ? item.desc.trim() : '';
    const qty = item.qty === undefined || item.qty === '' ? 1 : Number(item.qty);
    const rate = item.rate === undefined || item.rate === '' ? 0 : Number(item.rate);
    if (desc.length > 200 || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(rate) || rate < 0) return { ok: false, error: 'Revê a descrição, quantidade e preço de cada artigo.' };
    items.push({ desc, qty, rate, productId: typeof item.productId === 'string' ? item.productId : null });
  }

  const discountType = data.discountType === 'percent' ? 'percent' : 'amount';
  const discountValue = data.discountValue === undefined ? 0 : Number(data.discountValue);
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percent' && discountValue > 100)) return { ok: false, error: 'O desconto indicado é inválido.' };
  let dueAt: Date | null = null;
  if (data.dueAt !== undefined && data.dueAt !== null && data.dueAt !== '') {
    dueAt = data.dueAt instanceof Date ? data.dueAt : new Date(String(data.dueAt));
    if (!Number.isFinite(dueAt.getTime())) return { ok: false, error: 'A data de vencimento é inválida.' };
  }
  const companyBankAccountId = typeof data.companyBankAccountId === 'string' && data.companyBankAccountId.trim() ? data.companyBankAccountId : null;
  return {
    ok: true,
    value: {
      customerName, customerNif, items,
      applyVat: data.applyVat !== false,
      discountType,
      discountValue,
      observations: typeof data.observations === 'string' ? data.observations.trim() || null : null,
      includeCompanyProfile: data.includeCompanyProfile !== false,
      currency: 'AOA',
      dueAt,
      companyBankAccountId,
    },
  };
}
