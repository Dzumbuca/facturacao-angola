export const BUSINESS_DOCUMENT_TYPES = [
  'PROPOSAL', 'QUOTE', 'PROFORMA', 'PURCHASE_ORDER', 'DELIVERY_NOTE',
  'SERVICE_ORDER', 'SERVICE_CONTRACT', 'COMPANY_DECLARATION',
] as const;

export type BusinessDocumentType = typeof BUSINESS_DOCUMENT_TYPES[number];
export type BusinessDocumentStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'CONVERTED';
export const BUSINESS_DOCUMENT_STATUSES: BusinessDocumentStatus[] = ['DRAFT', 'ISSUED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'CONVERTED'];

export type BusinessDocumentItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  productId: string | null;
};

export type BusinessDocumentInput = {
  type: BusinessDocumentType;
  title: string;
  customerId: string | null;
  counterpartyName: string | null;
  counterpartyNif: string | null;
  counterpartyAddress: string | null;
  issueDate: string;
  validUntil: string | null;
  currency: 'AOA';
  details: string | null;
  notes: string | null;
  items: BusinessDocumentItemInput[];
};

type ValidationResult = { ok: true; value: BusinessDocumentInput } | { ok: false; error: string };

const itemDocumentTypes = new Set<BusinessDocumentType>(['PROPOSAL', 'QUOTE', 'PROFORMA', 'PURCHASE_ORDER', 'DELIVERY_NOTE']);
const detailDocumentTypes = new Set<BusinessDocumentType>(['SERVICE_ORDER', 'SERVICE_CONTRACT', 'COMPANY_DECLARATION']);
const acceptDocumentTypes = new Set<BusinessDocumentType>(['PROPOSAL', 'QUOTE', 'PROFORMA', 'PURCHASE_ORDER', 'SERVICE_CONTRACT']);
const numberPrefixes: Record<BusinessDocumentType, string> = {
  PROPOSAL: 'PROP', QUOTE: 'ORC', PROFORMA: 'PRO', PURCHASE_ORDER: 'ENC',
  DELIVERY_NOTE: 'GR', SERVICE_ORDER: 'OS', SERVICE_CONTRACT: 'CTR', COMPANY_DECLARATION: 'DECL',
};

function text(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateBusinessDocumentInput(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Dados do documento inválidos.' };
  const data = input as Record<string, unknown>;
  if (!BUSINESS_DOCUMENT_TYPES.includes(data.type as BusinessDocumentType)) {
    return { ok: false, error: 'Tipo de documento indisponível ou sujeito a validação fiscal.' };
  }
  const type = data.type as BusinessDocumentType;
  const title = text(data.title, 160);
  if (!title) return { ok: false, error: 'Indique o título do documento.' };
  const issueDate = data.issueDate === undefined
    ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    : data.issueDate;
  if (!validDate(issueDate)) return { ok: false, error: 'A data de emissão é inválida.' };
  const validUntil = data.validUntil === undefined || data.validUntil === null || data.validUntil === '' ? null : data.validUntil;
  if (validUntil !== null && (!validDate(validUntil) || validUntil < issueDate)) {
    return { ok: false, error: 'A validade deve ser uma data real igual ou posterior à emissão.' };
  }
  if (data.currency !== undefined && data.currency !== 'AOA') return { ok: false, error: 'A moeda suportada é AOA.' };

  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (rawItems.length > 100) return { ok: false, error: 'O documento não pode exceder 100 linhas.' };
  const items: BusinessDocumentItemInput[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Uma linha do documento é inválida.' };
    const row = raw as Record<string, unknown>;
    const description = text(row.description, 240);
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unitPrice);
    const taxRate = row.taxRate === undefined || row.taxRate === null || row.taxRate === '' ? 0 : Number(row.taxRate);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000
      || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000
      || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      return { ok: false, error: 'Revê a descrição, quantidade, preço e taxa informativa de cada linha.' };
    }
    items.push({ description, quantity, unitPrice, taxRate, productId: typeof row.productId === 'string' && row.productId.trim() ? row.productId.trim() : null });
  }
  if (itemDocumentTypes.has(type) && !items.length) return { ok: false, error: 'Adicione pelo menos uma linha ao documento.' };
  const customerId = typeof data.customerId === 'string' && data.customerId.trim() ? data.customerId.trim() : null;
  const counterpartyName = text(data.counterpartyName, 160) || null;
  const counterpartyNif = text(data.counterpartyNif, 40) || null;
  const counterpartyAddress = text(data.counterpartyAddress, 240) || null;
  if (itemDocumentTypes.has(type) && !customerId && !counterpartyName) return { ok: false, error: 'Seleccione um cliente registado ou indique o nome do destinatário.' };
  const details = text(data.details, 12_000) || null;
  if (detailDocumentTypes.has(type) && !details) return { ok: false, error: 'Descreva os termos ou o conteúdo do documento.' };
  const notes = text(data.notes, 2_000) || null;
  return { ok: true, value: { type, title, customerId, counterpartyName, counterpartyNif, counterpartyAddress, issueDate, validUntil, currency: 'AOA', details, notes, items } };
}

export function calculateBusinessDocumentTotals(items: readonly Pick<BusinessDocumentItemInput, 'quantity' | 'unitPrice' | 'taxRate'>[]) {
  const subTotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const taxTotal = roundMoney(items.reduce((sum, item) => sum + item.quantity * item.unitPrice * item.taxRate / 100, 0));
  return { subTotal, taxTotal, total: roundMoney(subTotal + taxTotal) };
}

function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

export function formatBusinessDocumentNumber(type: BusinessDocumentType, year: number, sequence: number) {
  return `${numberPrefixes[type]} ${year}/${String(sequence).padStart(4, '0')}`;
}

export function isBusinessDocumentTransitionAllowed(from: BusinessDocumentStatus, to: BusinessDocumentStatus, type: BusinessDocumentType) {
  if (from === 'DRAFT' && to === 'ISSUED') return true;
  if (from === 'ISSUED' && to === 'CANCELLED') return true;
  if (from === 'ISSUED' && acceptDocumentTypes.has(type) && ['ACCEPTED', 'REJECTED'].includes(to)) return true;
  if (from === 'ACCEPTED' && to === 'CANCELLED') return true;
  return false;
}

export function canConvertBusinessDocumentToInvoice(document: {
  status: string;
  type: string;
  items: readonly { taxRate: number }[];
}): { ok: true; applyVat: boolean } | { ok: false; error: string } {
  if (document.status !== 'ACCEPTED' || !['PROPOSAL', 'QUOTE', 'PROFORMA'].includes(document.type)) {
    return { ok: false, error: 'Apenas propostas, orçamentos ou proformas aceites podem originar um rascunho de factura.' };
  }
  if (!document.items.length) return { ok: false, error: 'O documento não tem linhas para converter.' };
  const rates = new Set(document.items.map((item) => item.taxRate));
  if (rates.size !== 1 || ![0, 14].includes(document.items[0].taxRate)) {
    return { ok: false, error: 'A factura actual só permite converter linhas uniformes sem IVA ou com IVA a 14%. Revê o documento manualmente.' };
  }
  return { ok: true, applyVat: document.items[0].taxRate === 14 };
}
