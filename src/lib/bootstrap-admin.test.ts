import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { bootstrapPlatformAdmin } = require('../../scripts/bootstrap-platform-admin.cjs') as {
  bootstrapPlatformAdmin: (userId: string, confirmation: string, repository: any) => Promise<void>;
};

function repository(initialUser: any = { id: 'user-1', status: 'ACTIVE', tenantId: 'tenant-1', tenantRole: 'USER' }, hasAdmin = false) {
  const state = { user: { ...initialUser }, audit: [] as any[], hasAdmin };
  return {
    state,
    transaction: async (run: (tx: any) => Promise<void>) => run({
      findUserById: async (id: string) => id === state.user.id ? { ...state.user } : null,
      hasAnyPlatformAdmin: async () => state.hasAdmin,
      promoteUser: async (id: string) => { state.user = { ...state.user, platformRole: 'ADMIN' }; return id; },
      writeBootstrapAudit: async (entry: any) => { state.audit.push(entry); },
    }),
  };
}

describe('bootstrapPlatformAdmin', () => {
  it('requires an exact user id and explicit confirmation before opening a transaction', async () => {
    const repo = repository();
    const transaction = vi.spyOn(repo, 'transaction');
    await expect(bootstrapPlatformAdmin('user-1', 'wrong', repo)).rejects.toThrow(/confirmation/i);
    await expect(bootstrapPlatformAdmin('operator@example.test', 'PROMOVER operator@example.test', repo)).rejects.toThrow(/id/i);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('promotes only an active user when no platform admin exists and writes bootstrap audit', async () => {
    const repo = repository();
    await bootstrapPlatformAdmin('user-1', 'PROMOVER user-1', repo);
    expect(repo.state.user).toMatchObject({ platformRole: 'ADMIN', tenantId: 'tenant-1', tenantRole: 'USER' });
    expect(repo.state.audit).toEqual([expect.objectContaining({ actorType: 'BOOTSTRAP', resourceId: 'user-1' })]);
  });

  it('rejects suspended users and refuses a second bootstrap administrator', async () => {
    await expect(bootstrapPlatformAdmin('user-1', 'PROMOVER user-1', repository({ id: 'user-1', status: 'SUSPENDED' }))).rejects.toThrow(/active/i);
    await expect(bootstrapPlatformAdmin('user-1', 'PROMOVER user-1', repository(undefined, true))).rejects.toThrow(/already/i);
  });
});
