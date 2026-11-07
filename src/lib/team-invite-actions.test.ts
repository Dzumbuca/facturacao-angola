import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: vi.fn(), platformTeamInvite: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() }, user: { findUnique: vi.fn() }, adminAuditLog: { create: vi.fn() } } }));
vi.mock('@/lib/admin-auth', () => ({ requirePlatformPermission: vi.fn(), isSuperAdminRole: (r: string) => ['ADMIN', 'SUPERADMIN'].includes(r) }));
vi.mock('@/lib/email-actions', () => ({ allowEmailRequest: vi.fn().mockResolvedValue(true), sendAndRecordEmail: vi.fn().mockResolvedValue({ ok: true, accepted: true }) }));
vi.mock('@/lib/email-core', () => ({ createPublicEmailUrl: (p: string, t: string) => `https://x${p}?token=${t}`, escapeEmailHtml: (s: string) => s }));

import { previewTeamInvite, acceptTeamInvite } from './team-invite-actions';
import { prisma } from '@/lib/prisma';
import { allowEmailRequest } from '@/lib/email-actions';

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const validToken = 'A'.repeat(44);

describe('team-invite-actions security', () => {
  beforeEach(() => vi.resetAllMocks());

  it('preview rejects invalid token format', async () => {
    expect(await previewTeamInvite('short')).toBeNull();
    expect(await previewTeamInvite('bad token !!!')).toBeNull();
  });

  it('preview returns null for expired/non-pending invite', async () => {
    (prisma as any).platformTeamInvite.findUnique.mockResolvedValue({ id: 'i1', name: 'N', email: 'a@b.c', platformRole: 'SUPPORT', status: 'PENDING', expiresAt: new Date(Date.now() - 1000) });
    expect(await previewTeamInvite(validToken)).toBeNull();
  });

  it('preview uses token hash lookup (not raw token)', async () => {
    (prisma as any).platformTeamInvite.findUnique.mockResolvedValue({ id: 'i1', name: 'N', email: 'a@b.c', platformRole: 'SUPPORT', status: 'PENDING', expiresAt: new Date(Date.now() + 10000) });
    (prisma as any).user.findUnique.mockResolvedValue(null);
    await previewTeamInvite(validToken);
    expect((prisma as any).platformTeamInvite.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: tokenHash(validToken) } }));
  });

  it('accept rejects invalid token/password formats', async () => {
    expect((await acceptTeamInvite({ token: 'x', password: 'ValidPass1!' })).ok).toBe(false);
    expect((await acceptTeamInvite({ token: validToken, password: 'short' })).ok).toBe(false);
  });

  it('accept fails for invalid/expired token in transaction', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) => fn({
      platformTeamInvite: { findUnique: vi.fn().mockResolvedValue(null) },
    }));
    const res = await acceptTeamInvite({ token: validToken, password: 'ValidPass1!' });
    expect(res.ok).toBe(false);
  });

  it('accept blocks suspended existing account', async () => {
    (prisma as any).$transaction.mockImplementation(async (fn: any) => fn({
      platformTeamInvite: { findUnique: vi.fn().mockResolvedValue({ id: 'i1', email: 'a@b.c', status: 'PENDING', expiresAt: new Date(Date.now() + 10000), platformRole: 'SUPPORT', permissions: [], name: 'N' }) },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', status: 'SUSPENDED', platformRole: 'NONE' }) },
    }));
    const res = await acceptTeamInvite({ token: validToken, password: 'ValidPass1!' });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/suspensa/i);
  });

  it('accept enforces single-use via updateMany count=1 (concurrent/reuse safe)', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    (prisma as any).$transaction.mockImplementation(async (fn: any) => fn({
      platformTeamInvite: { findUnique: vi.fn().mockResolvedValue({ id: 'i1', email: 'a@b.c', status: 'PENDING', expiresAt: new Date(Date.now() + 10000), platformRole: 'SUPPORT', permissions: [], name: 'N' }), updateMany },
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'u1', status: 'ACTIVE', platformRole: 'NONE', emailVerified: new Date() }), update: vi.fn().mockResolvedValue({}) },
      adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    }));
    const res = await acceptTeamInvite({ token: validToken });
    expect(res.ok).toBe(false);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'i1', status: 'PENDING' }) }));
  });
});
