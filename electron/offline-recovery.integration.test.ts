import { createServer, type Server } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isOfflineGrantForAccess, signOfflineGrant } from '../src/lib/offline-grant-core';
import { syncDraftQueue } from '../src/lib/desktop-sync-core';
import { OfflineStore } from './offline-store';

const keys = generateKeyPairSync('ed25519');
const identity = { userId: 'recovery-user', tenantId: 'recovery-tenant', tenantRole: 'COMPANY_ADMIN' as const, sessionVersion: 1 };
const draft = { id: '33333333-3333-4333-8333-333333333333', customerName: 'Recovery fixture', customerNif: null, items: [], applyVat: true, discountType: 'amount', discountValue: 0, observations: null, includeCompanyProfile: true, currency: 'AOA', dueAt: null, companyBankAccountId: null };
const safeStorage = {
  isAsyncEncryptionAvailable: async () => true,
  encryptStringAsync: async (value: string) => Buffer.from(`wrapped:${value}`),
  decryptStringAsync: async (value: Buffer) => ({ result: value.toString().replace(/^wrapped:/, ''), shouldReEncrypt: false }),
};
const roots: string[] = [];
let server: Server | null = null;

async function listen(handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void) {
  server = createServer(handler);
  await new Promise<void>((resolve, reject) => server!.once('error', reject).listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
}

function stop() {
  if (!server) return Promise.resolve();
  const active = server;
  server = null;
  return new Promise<void>((resolve, reject) => active.close((error) => error ? reject(error) : resolve()));
}

afterEach(async () => {
  await stop();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('offline connection recovery over HTTP and SQLite', () => {
  it('retains a draft during a real connection outage and syncs it once after recovery', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mf-recovery-http-'));
    roots.push(root);
    const issuedAt = Math.floor(Date.now() / 1000);
    const grant = signOfflineGrant({ ...identity, canCreateInvoiceDrafts: true, issuedAt, expiresAt: issuedAt + 12 * 60 * 60 }, keys.privateKey);
    let origin = await listen((_request, response) => { response.writeHead(200); response.end('{}'); });
    const storeRoot = join(root, 'offline');
    let store = await OfflineStore.open({ root: storeRoot, ...identity, grantToken: grant, publicKey: keys.publicKey, safeStorage, now: issuedAt + 1 });
    await store.replaceSnapshot({ profile: { name: 'Recovery fixture' } });
    await store.saveDraft(draft);

    const api = { async createDraft(payload: Record<string, unknown>) {
      try {
        const response = await fetch(`${origin}/api/invoices/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Desktop-Offline-Grant': grant }, body: JSON.stringify(payload) });
        const body = await response.json().catch(() => null) as { draft?: Record<string, unknown> } | null;
        return { status: response.status, ...(body?.draft ? { draft: body.draft } : {}) };
      } catch (error) { lastFetchError = JSON.stringify({ error: String(error), cause: error instanceof Error ? (error as Error & { cause?: unknown }).cause : null, origin }); throw error; }
    } };

    await stop();
    const outage = await syncDraftQueue(store, api, Date.now());
    expect(outage).toMatchObject({ synced: 0, pending: 1 });
    await store.close();

    store = await OfflineStore.open({ root: storeRoot, ...identity, grantToken: grant, publicKey: keys.publicKey, safeStorage, now: issuedAt + 2 });
    expect((await store.listDrafts())[0]).toMatchObject({ id: draft.id, syncState: 'ERROR' });
    expect(await store.readSnapshot()).toEqual({ profile: { name: 'Recovery fixture' } });

    const saved = new Map<string, Record<string, unknown>>();
    let acceptedRequests = 0;
    let issuanceCalls = 0;
    let rejectedAuthorization = 0;
    let lastFetchError = '';
    origin = await listen((request, response) => {
      if (request.url?.endsWith('/issue')) { issuanceCalls++; response.writeHead(500); response.end(); return; }
      if (request.url !== '/api/invoices/drafts' || request.method !== 'POST') { response.writeHead(404); response.end(); return; }
      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
        const allowed = isOfflineGrantForAccess(String(request.headers['x-desktop-offline-grant'] ?? ''), keys.publicKey, identity);
        if (!allowed) { rejectedAuthorization++; response.writeHead(403); response.end('{}'); return; }
        acceptedRequests++;
        const id = String(payload.id);
        const existing = saved.get(id);
        if (existing) { response.writeHead(JSON.stringify(existing) === JSON.stringify(payload) ? 200 : 409, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ draft: existing })); return; }
        saved.set(id, payload);
        response.writeHead(201, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ draft: { ...payload, status: 'DRAFT' } }));
      });
    });

    const retryAt = (await store.listOutbox())[0].retryAt;
    const recovered = await syncDraftQueue(store, api, Math.max(Date.now(), retryAt + 1));
    expect(recovered, JSON.stringify({ retryAt, rows: await store.listOutbox(), acceptedRequests, rejectedAuthorization, saved: saved.size, lastFetchError })).toEqual({ synced: 1, pending: 0, conflicts: 0 });
    expect(saved.size).toBe(1);
    expect(acceptedRequests).toBe(1);
    expect(issuanceCalls).toBe(0);
    expect((await store.listDrafts())[0]).toMatchObject({ id: draft.id, syncState: 'SYNCED' });
    await store.close();
  }, 20_000);
});
