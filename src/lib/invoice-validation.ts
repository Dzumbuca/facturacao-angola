import { calculateInvoiceTotals } from './tax';

type InvoiceLineInput = { desc?: unknown; qty?: unknown; rate?: unknown; taxRate?: unknown };
type InvoiceInput = {
  customerName?: unknown;
  customerNif?: unknown;
  items?: unknown;
  total?: unknown;
  applyVat?: unknown;
  discountType?: unknown;
  discountValue?: unknown;
  observations?: unknown;
  includeCompanyProfile?: unknown;
};

const isValidNif = (nif: string) => /^\d{10}$/.test(nif) || /^\d{9}[A-Z]{2}\d{3}$/.test(nif);

export const validateInvoiceRequest = (data: InvoiceInput) => {
  const warnings: string[] = [];
  if (!data || typeof data !== 'object') {
    return { isValid: false, warnings: ['O conteúdo da fatura é inválido.'] };
  }
  const name = typeof data.customerName === 'string' ? data.customerName.trim() : '';
  const nif = typeof data.customerNif === 'string' ? data.customerNif.trim().toUpperCase() : '';
  const items = Array.isArray(data.items) ? data.items as InvoiceLineInput[] : [];

  if (!name) warnings.push('O nome do adquirente é obrigatório.');
  if (nif && !isValidNif(nif)) warnings.push('O NIF do adquirente tem formato inválido.');
  if (items.length === 0) warnings.push('A fatura deve conter pelo menos uma linha.');
  const applyVat = data.applyVat !== false;
  const discountType = data.discountType === 'percent' ? 'percent' : 'amount';
  const discountValue = Number(data.discountValue ?? 0);
  if (!Number.isFinite(discountValue) || discountValue < 0 || (discountType === 'percent' && discountValue > 100)) {
    warnings.push('O desconto deve ser positivo e a percentagem não pode exceder 100%.');
  }
  if (data.observations !== undefined && (typeof data.observations !== 'string' || data.observations.length > 2000)) {
    warnings.push('As observações devem ter no máximo 2000 caracteres.');
  }
  if (data.includeCompanyProfile !== undefined && typeof data.includeCompanyProfile !== 'boolean') {
    warnings.push('A opção de incluir os dados da empresa é inválida.');
  }

  const normalizedItems = items.map((item) => {
    if (!item || typeof item !== 'object') {
      warnings.push('Cada linha deve ser um objeto válido.');
      return { qty: Number.NaN, rate: Number.NaN, taxRate: Number.NaN };
    }
    const qty = Number(item.qty);
    const rate = Number(item.rate);
    const taxRate = applyVat ? 14 : 0;
    if (typeof item.desc !== 'string' || !item.desc.trim()) warnings.push('Cada linha deve ter uma descrição.');
    if (!Number.isFinite(qty) || qty <= 0) warnings.push('A quantidade de cada linha deve ser maior que zero.');
    if (!Number.isFinite(rate) || rate < 0) warnings.push('O preço unitário deve ser um valor válido não negativo.');
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) warnings.push('A taxa de IVA deve estar entre 0 e 100.');
    return { qty, rate, taxRate };
  });

  const total = Number(data.total);
  if (!Number.isFinite(total) || total < 0) {
    warnings.push('O total da fatura deve ser um valor válido.');
  } else if (normalizedItems.every((item) => Number.isFinite(item.qty) && Number.isFinite(item.rate) && Number.isFinite(item.taxRate))) {
    const calculated = calculateInvoiceTotals(normalizedItems, { type: discountType, value: discountValue, applyVat }).total;
    if (Math.abs(calculated - total) > 0.01) warnings.push('O total enviado não corresponde às linhas da fatura.');
  }

  return { isValid: warnings.length === 0, warnings };
};
