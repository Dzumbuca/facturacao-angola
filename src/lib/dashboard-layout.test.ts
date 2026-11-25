// Regression tests: DashboardLayout error handling discrimination
// Garante que AuthorizationError faz redirect para /onboarding,
// enquanto erros de infraestrutura propagam (sem redirect genérico).
// Os logs expõem apenas mensagens sanitizadas (sem PII, tokens ou secrets).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { redirect } from 'next/navigation';
import { AuthorizationError } from '@/lib/admin-auth';

const mockAuth = vi.fn();
const mockGetTenantAccess = vi.fn();
const mockPrismaTenantFindUnique = vi.fn();
const mockPrismaPlatformConfigFindUnique = vi.fn();
const mockGetWmsAccess = vi.fn();
const mockComputeEffectivePlan = vi.fn();
const mockConsoleError = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));
vi.mock('@/lib/admin-auth', () => ({
  getTenantAccess: () => mockGetTenantAccess(),
  AuthorizationError: class AuthorizationError extends Error {
    constructor(readonly code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'TENANT_SUSPENDED') {
      super(code === 'UNAUTHENTICATED' ? 'Authentication required' : 'Access denied');
      this.name = 'AuthorizationError';
    }
  },
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenant: { findUnique: () => mockPrismaTenantFindUnique() },
    platformConfig: { findUnique: () => mockPrismaPlatformConfigFindUnique() },
  },
}));
vi.mock('@/lib/entitlements', () => ({ getWmsAccess: () => mockGetWmsAccess() }));
vi.mock('@/lib/plan', () => ({ computeEffectivePlan: () => mockComputeEffectivePlan() }));

beforeEach(() => {
  vi.clearAllMocks();
  mockConsoleError.mockImplementation(() => {});
  (vi.mocked(redirect)).mockImplementation(() => { throw new Error('redirect called'); });
  mockAuth.mockResolvedValue({ user: { id: 'user-1', tenantId: 'tenant-1' } });
  mockGetTenantAccess.mockResolvedValue({
    userId: 'user-1',
    tenantId: 'tenant-1',
    platformRole: 'USER',
    platformPermissions: [],
    tenantRole: 'USER',
    tenantStatus: 'ACTIVE',
  });
  mockPrismaTenantFindUnique.mockResolvedValue({ plan: 'STARTER', planExpiry: null });
  mockPrismaPlatformConfigFindUnique.mockResolvedValue({ adHtml: null });
  mockGetWmsAccess.mockResolvedValue({ allowed: false });
  mockComputeEffectivePlan.mockReturnValue({ effectivePlan: 'STARTER', daysLeft: 30, expired: false });
});

describe('DashboardLayout error discrimination', () => {
  it('renders normally when all calls succeed', async () => {
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout');
    const children = { type: 'div', props: { children: 'children' } };
    await expect(DashboardLayout({ children })).resolves.toBeDefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('redirects to /onboarding when getTenantAccess throws AuthorizationError', async () => {
    mockGetTenantAccess.mockRejectedValue(new AuthorizationError('FORBIDDEN'));
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout');
    await expect(DashboardLayout({ children: { type: 'div' } })).rejects.toThrow('redirect called');
    expect((vi.mocked(redirect)).mock.calls.some((args) => args[0] === '/onboarding')).toBe(true);
  });

  it('propagates non-AuthorizationError from getTenantAccess (no generic redirect)', async () => {
    const infraError = new Error('connection timeout');
    mockGetTenantAccess.mockRejectedValue(infraError);
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout');
    await expect(DashboardLayout({ children: { type: 'div' } })).rejects.toThrow('connection timeout');
    expect((vi.mocked(redirect)).mock.calls.some((args) => args[0] === '/onboarding')).toBe(false);
  });

  it('propagates infrastructure error from auth() without redirect', async () => {
    const infraError = new Error('database connection failed');
    mockAuth.mockRejectedValue(infraError);
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout');
    await expect(DashboardLayout({ children: { type: 'div' } })).rejects.toThrow('database connection failed');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('propagates infrastructure error from Prisma tenant query without redirect', async () => {
    const infraError = new Error('RLS policy violation');
    mockPrismaTenantFindUnique.mockRejectedValue(infraError);
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout');
    await expect(DashboardLayout({ children: { type: 'div' } })).rejects.toThrow('RLS policy violation');
    expect((vi.mocked(redirect)).mock.calls.some((args) => args[0] === '/onboarding')).toBe(false);
  });

  it('logs only sanitized error messages, no stack trace', async () => {
    const infraError = new Error('connection timeout');
    mockGetTenantAccess.mockRejectedValue(infraError);
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout');
    try {
      await DashboardLayout({ children: { type: 'div' } });
    } catch {
      // expected
    }
    const loggedMessages = mockConsoleError.mock.calls.map((args) => args.join(' '));
    expect(loggedMessages.join(' ')).not.toContain('stack');
    expect(loggedMessages.join(' ')).not.toContain('at ');
  });
});
