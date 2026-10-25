import 'server-only';

// Plano EFECTIVO: PRO só conta se a validade não tiver expirado.
// Isto permite vender durações (1/3/6/12 meses) sem que o cliente fique
// Pro para sempre — e o admin vê sempre o plano bruto.
export type PlanRaw = string | null | undefined;

export function computeEffectivePlan(plan: PlanRaw, planExpiry: Date | null | undefined, now = new Date()): {
  effectivePlan: 'FREE' | 'PRO';
  expired: boolean;
  daysLeft: number | null;
} {
  const raw = plan === 'PRO' ? 'PRO' : 'FREE';
  if (raw !== 'PRO') return { effectivePlan: 'FREE', expired: false, daysLeft: null };
  if (!planExpiry) return { effectivePlan: 'PRO', expired: false, daysLeft: null };
  const msLeft = planExpiry.getTime() - now.getTime();
  if (msLeft <= 0) return { effectivePlan: 'FREE', expired: true, daysLeft: 0 };
  return { effectivePlan: 'PRO', expired: false, daysLeft: Math.ceil(msLeft / 86_400_000) };
}

// Novo prazo ao confirmar um pagamento: renovações somam a partir do prazo
// actual (se ainda válido) para o cliente não perder dias ao pagar antes.
export function nextPlanExpiry(currentExpiry: Date | null | undefined, months: number, now = new Date()): Date {
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? new Date(currentExpiry) : new Date(now);
  base.setMonth(base.getMonth() + months);
  return base;
}
