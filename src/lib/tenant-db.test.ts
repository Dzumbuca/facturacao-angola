import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
import { runWithTenant, runAsAdmin, runAsSystem, runAsAuth, PRIVILEGED_RLS } from './tenant-db';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: { $transaction: vi.fn() },
}));

describe('tenant-db RLS helper hardening', () => {
  beforeEach(() => vi.resetAllMocks());

  it('runWithTenant forces isAdmin false even if caller context attempts escalation', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
    await runWithTenant('t1', async () => 'ok', { userId: 'u1', isAdmin: true } as any);
    const calls = tx.$executeRaw.mock.calls.map((c) => c[0]?.join?.('') ?? String(c[0]));
    expect(calls.some((s: string) => s.includes('app.is_admin'))).toBe(true);
    // third call sets app.is_admin to false
    expect(tx.$executeRaw.mock.calls[2][1]).toBe('false');
  });

  it('runAsAdmin rejects missing privileged authorization', async () => {
    await expect(runAsAdmin(async () => 'x', { userId: 'u' } as any, undefined as any)).rejects.toThrow(/privileged RLS authorization required/);
  });

  it('runAsSystem rejects missing privileged authorization', async () => {
    await expect(runAsSystem(async () => 'x', undefined as any)).rejects.toThrow(/privileged RLS authorization required/);
  });

  it('runAsAdmin sets admin context with explicit authorization marker', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
    await runAsAdmin(async () => 'ok', { userId: 'admin' }, PRIVILEGED_RLS);
    expect(tx.$executeRaw.mock.calls[2][1]).toBe('true');
  });

  it('runAsSystem sets admin context with explicit authorization marker', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
    await runAsSystem(async () => 'ok', PRIVILEGED_RLS);
    expect(tx.$executeRaw.mock.calls[2][1]).toBe('true');
    expect(tx.$executeRaw.mock.calls[1][1]).toBe('');
  });

  it('runAsAuth remains non-admin bootstrap context', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) };
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => fn(tx));
    await runAsAuth(async () => 'ok', { userId: 'u' });
    expect(tx.$executeRaw.mock.calls[2][1]).toBe('false');
  });
});