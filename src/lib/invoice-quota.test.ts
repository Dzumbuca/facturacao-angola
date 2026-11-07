import { describe, it, expect, vi } from 'vitest';

vi.mock('./tenant-db', () => ({ runWithTenant: vi.fn() }));

import { luandaMonthBounds, resolveInvoiceLimit, FREE_INVOICE_LIMIT_MONTHLY } from './invoice-quota';

function txWith({ subscription = null, tenant = { plan: 'FREE', planExpiry: null } }: any = {}) {
  return {
    tenantSubscription: { findFirst: vi.fn().mockResolvedValue(subscription) },
    tenant: { findUnique: vi.fn().mockResolvedValue(tenant) },
  };
}

describe('invoice-quota', () => {
  it('calcula o mês civil em Africa/Luanda', () => {
    const { start, end } = luandaMonthBounds(new Date('2026-11-15T12:00:00Z'));
    expect(start.toISOString()).toBe('2026-10-31T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('legado FREE usa 15/mês e PRO é ilimitado', async () => {
    expect(await resolveInvoiceLimit(txWith(), 't1')).toBe(FREE_INVOICE_LIMIT_MONTHLY);
    expect(await resolveInvoiceLimit(txWith({ tenant: { plan: 'PRO', planExpiry: null } }), 't1')).toBeNull();
  });

  it('subscrição usa max_invoices_per_month do plano', async () => {
    const withLimit = txWith({ subscription: { plan: { slug: 'basico', limits: [{ metric: 'max_invoices_per_month', value: 100 }] } } });
    expect(await resolveInvoiceLimit(withLimit, 't1')).toBe(100);
    const unlimited = txWith({ subscription: { plan: { slug: 'profissional', limits: [] } } });
    expect(await resolveInvoiceLimit(unlimited, 't1')).toBeNull();
  });
});
