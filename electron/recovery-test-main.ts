import { app, safeStorage, session } from 'electron';
import { createServer, type Server } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { signOfflineGrant, isOfflineGrantForAccess } from '../src/lib/offline-grant-core';
import { OfflineStore } from './offline-store';
import { syncDraftQueue } from '../src/lib/desktop-sync-core';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const userId = 'offline-fixture-user';
const tenantId = 'offline-fixture-tenant';
const draftId = '11111111-1111-4111-8111-111111111111';
const fixtureDrafts = new Map<string, Record<string, unknown>>();
let fixtureRequests = 0;
let server: Server;
let origin = '';
let testRoot = '';

function respond(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function startFixture(port = 0): Promise<number> {
  server = createServer(async (request, response) => {
    if (request.url === '/api/desktop/offline-bootstrap' && request.method === 'POST') {
      const issuedAt = Math.floor(Date.now() / 1000);
      return respond(response, 200, {
        grant: signOfflineGrant({ userId, tenantId, tenantRole: 'COMPANY_ADMIN', sessionVersion: 1, canCreateInvoiceDrafts: true, issuedAt, expiresAt: issuedAt + 12 * 60 * 60 }, privateKey),
        snapshot: { profile: { name: 'Fixture Company', nif: 'TST-001' }, customers: [{ id: 'customer-fixture', name: 'Confidential Fixture Client' }], products: [] },
      });
    }
    if (request.url === '/api/invoices/drafts' && request.method === 'POST') {
      fixtureRequests++;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      const allowed = isOfflineGrantForAccess(String(request.headers['x-desktop-offline-grant'] ?? ''), publicKey, { userId, tenantId, tenantRole: 'COMPANY_ADMIN', sessionVersion: 1 });
      if (!allowed) return respond(response, 403, { error: 'forbidden' });
      if (typeof body.id !== 'string') return respond(response, 400, { error: 'missing id' });
      const existing = fixtureDrafts.get(body.id);
      if (existing) return respond(response, JSON.stringify(existing) === JSON.stringify(body) ? 200 : 409, { draft: existing });
      fixtureDrafts.set(body.id, body);
      return respond(response, 201, { draft: { ...body, status: 'DRAFT' } });
    }
    if (request.url?.includes('/issue')) return respond(response, 500, { error: 'issuance must not run' });
    return respond(response, 404, { error: 'not found' });
  });
  await new Promise<void>((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
  return (server.address() as import('node:net').AddressInfo).port;
}

function closeFixture() {
  return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function main() {
  try {
    await app.whenReady();
    testRoot = await mkdtemp(join(tmpdir(), 'machine-facturas-electron-recovery-'));
    app.setPath('userData', join(testRoot, 'user-data'));
    if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Electron safeStorage is unavailable on this Windows host');
    const port = await startFixture();
    origin = `http://127.0.0.1:${port}`;
    const desktopSession = session.fromPartition('persist:machine-facturas-recovery-test');
    const bootstrapResponse = await desktopSession.fetch(`${origin}/api/desktop/offline-bootstrap`, { method: 'POST' });
    if (!bootstrapResponse.ok) throw new Error('Bootstrap fixture request failed');
    const bootstrap = await bootstrapResponse.json() as { grant: string; snapshot: unknown };
    const root = join(testRoot, 'user-data', 'offline');
    let store = await OfflineStore.open({ root, userId, tenantId, grantToken: bootstrap.grant, publicKey, safeStorage, now: Math.floor(Date.now() / 1000) });
    await store.replaceSnapshot(bootstrap.snapshot);
    await store.saveDraft({
      id: draftId, customerName: 'Confidential Fixture Client', customerNif: null,
      items: [{ desc: 'Fixture service', qty: 1, rate: 1200, productId: null }], applyVat: true,
      discountType: 'amount', discountValue: 0, observations: null, includeCompanyProfile: true,
      currency: 'AOA', dueAt: null, companyBankAccountId: null,
    });
    const createDraft = async (draft: Record<string, unknown>) => {
      const response = await desktopSession.fetch(`${origin}/api/invoices/drafts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Desktop-Offline-Grant': bootstrap.grant }, body: JSON.stringify(draft),
      });
      return { status: response.status, ...(response.ok ? { draft: (await response.json() as { draft: Record<string, unknown> }).draft } : {}) };
    };

    await closeFixture();
    const interrupted = await syncDraftQueue(store, { createDraft }, Date.now());
    if (interrupted.pending !== 1) throw new Error('Network interruption did not retain the pending draft');
    await store.close();

    store = await OfflineStore.open({ root, userId, tenantId, grantToken: bootstrap.grant, publicKey, safeStorage, now: Math.floor(Date.now() / 1000) });
    if ((await store.listOutbox())[0]?.state !== 'ERROR') throw new Error('The failed operation state did not survive store restart');
    if (!(await store.readSnapshot() as { customers: unknown[] }).customers.length) throw new Error('The authorized offline snapshot did not persist');
    const sqliteName = (await readdir(root)).find((file) => file.endsWith('.sqlite'));
    if (!sqliteName) throw new Error('SQLite database was not created');
    const sqliteBytes = await readFile(join(root, sqliteName));
    if (sqliteBytes.includes(Buffer.from('Confidential Fixture Client'))) throw new Error('Sensitive customer data is plaintext in SQLite');

    const retryAfter = (await store.listOutbox())[0].retryAt;
    await new Promise<void>((resolve, reject) => server.once('error', reject).listen(port, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${port}`;
    await delay(Math.max(0, retryAfter - Date.now() + 20));
    const recovered = await syncDraftQueue(store, { createDraft }, Date.now());
    if (recovered.synced !== 1 || recovered.pending !== 0 || fixtureDrafts.size !== 1) throw new Error('Restored connection did not synchronize exactly one stable draft');
    if (fixtureRequests !== 1) throw new Error(`Expected one recovered draft API request; received ${fixtureRequests}`);
    if ((await store.listOutbox())[0]?.state !== 'SYNCED') throw new Error('Local queue did not record synchronized state');
    if ((await store.listDrafts())[0]?.syncState !== 'SYNCED') throw new Error('Draft did not show synchronized state');
    console.log(JSON.stringify({ status: 'PASS', electron: process.versions.electron, sqliteEncryption: 'PASS', interruption: 'PASS', restartPersistence: 'PASS', recovery: 'PASS', stableDrafts: fixtureDrafts.size, issuanceCalls: 0 }));
    await store.close();
    await closeFixture();
    await desktopSession.clearStorageData();
    await rm(testRoot, { recursive: true, force: true });
    app.quit();
  } catch (error) {
    console.error('Electron connection recovery test failed:', error);
    try { await closeFixture(); } catch { /* Server may not have started. */ }
    if (testRoot) await rm(testRoot, { recursive: true, force: true }).catch(() => undefined);
    app.exit(1);
  }
}

void main();
