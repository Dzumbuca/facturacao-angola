import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { acquireEmissionLease, releaseEmissionLease } from './emission-lease';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A13 — lease debug', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!enabled) return;
    const p = new PrismaClient({ datasources: { db: { url } } });
    tenantId = `a13-lease-${Date.now()}`;
    await p.tenant.create({ data: { id: tenantId, name: tenantId, plan: 'PRO', status: 'ACTIVE' } });
    await p.$disconnect();
  });

  it('acquires maxSlots then blocks extra', async () => {
    const a = await acquireEmissionLease(tenantId, 'TEST', 2);
    expect(a.busy).toBe(false);
    const b = await acquireEmissionLease(tenantId, 'TEST', 2);
    expect(b.busy).toBe(false);
    const c = await acquireEmissionLease(tenantId, 'TEST', 2);
    expect(c.busy).toBe(true);
    await releaseEmissionLease(tenantId, a.leaseId!);
    const d = await acquireEmissionLease(tenantId, 'TEST', 2);
    expect(d.busy).toBe(false);
  });
});
