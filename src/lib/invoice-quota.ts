import { prisma } from './prisma';
import { computeEffectivePlan } from './plan';
import { hasAvailableUnlock } from './ad-unlock-service';

// Regra de negócio: as primeiras 20 facturas (FT) são gratuitas. Depois, cada
// nova emissão exige um desbloqueio por anúncio (um desbloqueio = uma emissão).
// Pro (dentro da validade) é ilimitado e nunca vê o bloqueio.
export const FREE_INVOICE_LIMIT = 20;

export type InvoiceQuota = {
  plan: 'FREE' | 'PRO' | string;
  // Facturas (tipo FT) efectivamente emitidas no TOTAL — rascunhos vivem na
  // tabela InvoiceDraft e nunca contam; anulações mantêm o consumo (o número
  // fiscal foi gasto), tal como a numeração sequencial.
  used: number;
  // null = ilimitado (Pro)
  limit: number | null;
  remaining: number | null;
  // Desbloqueio por anúncio disponível (GRANTED e ainda não consumido).
  hasUnlock: boolean;
  // Pode emitir agora? (dentro da quota OU com desbloqueio pronto)
  canEmit: boolean;
};

export async function getInvoiceQuota(tenantId: string): Promise<InvoiceQuota> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { plan: true, planExpiry: true } });
  const plan = computeEffectivePlan(tenant?.plan, tenant?.planExpiry).effectivePlan;
  if (plan === 'PRO') return { plan, used: 0, limit: null, remaining: null, hasUnlock: false, canEmit: true };

  // Conta TODAS as FT emitidas. Facturas anuladas (estado ANULADA) mantêm o
  // consumo porque o número fiscal sequencial já foi gasto — excluí-las
  // permitiria anular e voltar a emitir sem limite. Nota: as facturas nunca
  // recebem o estado 'CANCELLED' (esse estado pertence aos documentos
  // empresariais), pelo que o filtro antigo era neutro mas deixava uma porta
  // aberta caso algum fluxo viesse a escrevê-lo.
  const used = await prisma.invoice.count({ where: { tenantId, type: 'FT' } });
  const hasUnlock = await hasAvailableUnlock(tenantId);
  const remaining = Math.max(0, FREE_INVOICE_LIMIT - used);
  return { plan, used, limit: FREE_INVOICE_LIMIT, remaining, hasUnlock, canEmit: remaining > 0 || hasUnlock };
}

export const quotaExceeded = (quota: InvoiceQuota): boolean =>
  quota.remaining !== null && quota.remaining <= 0;

// Bloqueio real: limite atingido E sem desbloqueio disponível.
// Com desbloqueio pronto a emissão avança — o consumo atómico acontece na
// transacção de emissão (ver issueInvoice).
export const quotaBlocked = (quota: InvoiceQuota): boolean => quotaExceeded(quota) && !quota.hasUnlock;

export const quotaMessage = (quota: InvoiceQuota): string =>
  `Limite de ${quota.limit} facturas gratuitas atingido (${quota.used}/${quota.limit}). Veja o anúncio para desbloquear a próxima emissão ou suba para o plano Pro.`;

// Erro lançado na transacção de emissão quando o limite está atingido e não
// há desbloqueio consumível (ex.: corrida entre emissões simultâneas).
export class AdUnlockRequiredError extends Error {
  constructor(public used: number, public limit: number) {
    super(`Limite de ${limit} facturas gratuitas atingido (${used}/${limit}). Veja o anúncio para desbloquear a próxima emissão.`);
    this.name = 'AdUnlockRequiredError';
  }
}
