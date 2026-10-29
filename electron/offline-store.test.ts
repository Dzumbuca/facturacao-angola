import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { signOfflineGrant } from '../src/lib/offline-grant-core';
import { OfflineStore } from './offline-store';

const pair = generateKeyPairSync('ed25519');
const storage = {
  isAsyncEncryptionAvailable: async () => true,
  encryptStringAsync: async (value: string) => Buffer.from(`wrapped:${value}`),
  decryptStringAsync: async (value: Buffer) => ({ result: value.toString().replace(/^wrapped:/, ''), shouldReEncrypt: false }),
};
const rootPaths: string[] = [];
async function createRoot() { const path = await mkdtemp(join(tmpdir(), 'mf-offline-')); rootPaths.push(path); return path; }
function token(userId: string, tenantId: string, expiresAt = 1_900_043_200) {
  return signOfflineGrant({ userId, tenantId, tenantRole: 'COMPANY_ADMIN', sessionVersion: 1, canCreateInvoiceDrafts: true, issuedAt: 1_900_000_000, expiresAt }, pair.privateKey);
}

afterEach(async () => { await Promise.all(rootPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))); });

describe('encrypted offline store', () => {
  it('encrypts contents, isolates account partitions and retains drafts on restart', async () => {
    const root = await createRoot();
    const store = await OfflineStore.open({ root, userId: 'user-a', tenantId: 'tenant-a', grantToken: token('user-a', 'tenant-a'), publicKey: pair.publicKey, safeStorage: storage, now: 1_900_000_100 });
    await store.replaceSnapshot({ customers: [{ name: 'PRIVATE CUSTOMER' }] });
    await store.saveDraft({ id: '11111111-1111-4111-8111-111111111111', customerName: 'PRIVATE INVOICE', items: [] });
    const files = await import('node:fs/promises').then((fs) => fs.readdir(root));
    const dbFile = await readFile(join(root, files.find((file) => file.endsWith('.sqlite'))!));
    expect(dbFile.toString()).not.toContain('PRIVATE CUSTOMER');
    expect(dbFile.toString()).not.toContain('PRIVATE INVOICE');
    await store.close();

    const other = await OfflineStore.open({ root, userId: 'user-b', tenantId: 'tenant-b', grantToken: token('user-b', 'tenant-b'), publicKey: pair.publicKey, safeStorage: storage, now: 1_900_000_100 });
    expect(await other.listDrafts()).toEqual([]);
    await other.close();
    const resumed = await OfflineStore.open({ root, userId: 'user-a', tenantId: 'tenant-a', grantToken: token('user-a', 'tenant-a'), publicKey: pair.publicKey, safeStorage: storage, now: 1_900_000_100 });
    expect((await resumed.listDrafts())[0]).toMatchObject({ id: '11111111-1111-4111-8111-111111111111', syncState: 'PENDING' });
    expect(await resumed.readSnapshot()).toEqual({ customers: [{ name: 'PRIVATE CUSTOMER' }] });
    await resumed.close();
  });

  it('allows reading cached data but blocks writes after the grant expires', async () => {
    const root = await createRoot();
    const oldToken = token('user-a', 'tenant-a', 1_900_010_000);
    const store = await OfflineStore.open({ root, userId: 'user-a', tenantId: 'tenant-a', grantToken: oldToken, publicKey: pair.publicKey, safeStorage: storage, now: 1_900_005_000 });
    await store.replaceSnapshot({ products: [] });
    await store.close();
    const expired = await OfflineStore.open({ root, userId: 'user-a', tenantId: 'tenant-a', grantToken: oldToken, publicKey: pair.publicKey, safeStorage: storage, now: 1_900_020_000 });
    expect(await expired.readSnapshot()).toEqual({ products: [] });
    await expect(expired.saveDraft({ id: '22222222-2222-4222-8222-222222222222' })).rejects.toThrow(/expired|expirada/i);
    await expired.close();
  });
});
