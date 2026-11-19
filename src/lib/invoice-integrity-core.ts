import crypto from 'crypto';
import * as runtime from '@prisma/client/runtime/library.js';

export type Decimal = runtime.Decimal;
export const Decimal = runtime.Decimal;

/**
 * Canonicalização determinística para o hash v2.
 *
 * A implementação preserva a associação entre chave original e chave
 * normalizada (NFC) para evitar perda silenciosa de propriedades e colisões.
 */

export function canonicalDecimal(value: Decimal | number | string): string {
  const decimal = value instanceof Decimal
    ? value
    : new Decimal(value as string | number);

  if (decimal.isNaN()) throw new Error('Decimal: value required (got NaN)');
  if (!decimal.isFinite()) throw new Error('Decimal: value required (non-finite)');

  // Decimal.toString() produz notação científica somente para expoentes
  // grandes, pela spec do Prisma. Mantém-se a representação canónica integral.
  const raw = decimal.toString();

  // Expandir notação científica para decimal simples
  if (/e/i.test(raw)) {
    const [base, exp] = raw.split(/e/i);
    const exponent = Number(exp);
    if (!Number.isFinite(exponent)) throw new Error('Decimal: invalid scientific notation');

    const negative = base.startsWith('-');
    const digits = (negative ? base.slice(1) : base).replace('.', '');
    const pointFromEnd = base.includes('.') ? base.split('.')[1].length : 0;
    const newPointPos = digits.length - pointFromEnd + exponent;

    if (newPointPos <= 0) {
      return `${negative ? '-' : ''}0.${'0'.repeat(-newPointPos)}${digits}`;
    }
    if (newPointPos >= digits.length) {
      return `${negative ? '-' : ''}${digits}${'0'.repeat(newPointPos - digits.length)}`;
    }
    return `${negative ? '-' : ''}${digits.slice(0, newPointPos)}.${digits.slice(newPointPos)}`;
  }

  // Normalizar — remover zeros finais fracionários e ponto residual
  if (raw.includes('.')) {
    return raw.replace(/0+$/, '').replace(/\.$/, '');
  }
  return raw;
}

export function canonical(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) throw new Error('Integridade: undefined não suportado no payload canónico');

  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
      throw new Error('Integridade: BigInt fora do intervalo seguro');
    }
    return value.toString();
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Integridade: Number não finito no payload canónico');
    if (Object.is(value, -0)) return '0';
    if (!Number.isInteger(value)) throw new Error('Integridade: Number não inteiro; use Decimal');
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error('Integridade: Number inteiro fora do intervalo seguro');
    return String(value);
  }

  if (typeof value === 'string') return JSON.stringify(value.normalize('NFC'));

  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error('Integridade: Date inválida');
    return JSON.stringify(value.toISOString());
  }

  if (value instanceof Decimal) {
    return JSON.stringify(canonicalDecimal(value));
  }

  if (Array.isArray(value)) {
    // Rejeitar arrays com lacunas
    if (Object.keys(value).length !== value.length) {
      throw new Error('Integridade: arrays esparsas não suportadas');
    }
    return '[' + value.map(canonical).join(',') + ']';
  }

  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('Integridade: objecto com protótipo não suportado');
    }

    const rawKeys = Object.keys(value);
    const pairs: Array<[string, unknown]> = [];
    const collator = new Intl.Collator('en', { sensitivity: 'variant', numeric: true });

    for (const rawKey of rawKeys) {
      const normalizedKey = rawKey.normalize('NFC');
      if (!normalizedKey) throw new Error('Integridade: chave vazia');
      pairs.push([normalizedKey, (value as Record<string, unknown>)[rawKey]]);
    }

    // Detectar colisões de chaves NFC (chaves diferentes antes da normalização,\n    // mas iguais depois)
    const seen = new Set<string>();
    for (const [normalizedKey] of pairs) {
      if (seen.has(normalizedKey)) {
        throw new Error('Integridade: colisão de chaves após normalização NFC');
      }
      seen.add(normalizedKey);
    }

    pairs.sort((a, b) => collator.compare(a[0], b[0]));

    return '{' + pairs.map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  }

  throw new Error('Integridade: tipo não suportado no payload canónico');
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export const generateInvoiceHashV2 = (
  data: Record<string, unknown>,
  previousHash: string | null,
  chainSequence: number
): string => {
  const payload = {
    hashVersion: 2,
    seriesCode: data.seriesCode ?? null,
    documentType: data.documentType ?? 'FT',
    year: data.year ?? null,
    number: data.number ?? null,
    tenantId: data.tenantId ?? null,
    customerId: data.customerId ?? null,
    customerName: data.customerName ?? null,
    customerNif: data.customerNif ?? null,
    currency: data.currency ?? 'AOA',
    items: Array.isArray(data.items)
      ? (data.items as Array<Record<string, unknown>>).map((item) => ({
          position: item.position,
          description: item.description,
          productCode: item.productCode ?? null,
          quantity: canonicalDecimal(item.quantity as Decimal | string | number),
          unitPrice: canonicalDecimal(item.unitPrice as Decimal | string | number),
          taxRate: canonicalDecimal(item.taxRate as Decimal | string | number),
          total: canonicalDecimal(item.total as Decimal | string | number),
        }))
      : [],
    applyVat: data.applyVat ?? true,
    discountAmount: data.discountAmount == null
      ? null
      : canonicalDecimal(data.discountAmount as Decimal | string | number),
    discountType: data.discountType ?? null,
    discountValue: data.discountValue == null
      ? null
      : canonicalDecimal(data.discountValue as Decimal | string | number),
    observations: data.observations ?? null,
    includeCompanyProfile: data.includeCompanyProfile ?? false,
    companyProfileSnapshot: data.companyProfileSnapshot ?? null,
    companyLogoId: data.companyLogoId ?? null,
    subTotal: canonicalDecimal(data.subTotal as Decimal | string | number),
    taxTotal: canonicalDecimal(data.taxTotal as Decimal | string | number),
    total: canonicalDecimal(data.total as Decimal | string | number),
    issuedAt: data.issuedAt instanceof Date
      ? data.issuedAt.toISOString()
      : (data.issuedAt as string | null),
    previousHash,
    chainSequence,
  };

  return sha256Hex(canonical(payload));
};
