import { app, BrowserWindow, ipcMain, net, protocol, safeStorage, session, shell, type IpcMainInvokeEvent, type Session } from 'electron';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { validateInvoiceDraftInput } from '../src/lib/invoice-draft-validation';
import { verifyOfflineGrant, verifyOfflineGrantSignature, type OfflineGrantClaims } from '../src/lib/offline-grant-core';
import { OfflineStore, type OfflineDraft } from './offline-store';
import { isAllowedSender, isOfflineDraftPayload, IPC_CHANNELS } from './ipc-contract';
import { syncDraftQueue } from '../src/lib/desktop-sync-core';

declare const __DESKTOP_ORIGIN__: string;
declare const __OFFLINE_PUBLIC_KEY__: string;

const APP_ORIGIN = new URL(__DESKTOP_ORIGIN__);
const PUBLIC_KEY = __OFFLINE_PUBLIC_KEY__.replace(/\\n/g, '\n');
const PARTITION = 'persist:machine-facturas';
const OFFLINE_ROOT = () => join(app.getPath('userData'), 'offline');
let mainWindow: BrowserWindow | null = null;
let activeStore: OfflineStore | null = null;
let activeClaims: OfflineGrantClaims | null = null;
let syncInProgress = false;
let refreshInProgress = false;
const storesToClose = new Set<OfflineStore>();
let loadingOffline = false;
let shutdownComplete = false;

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false } }]);

function isTrustedWebUrl(raw: string) {
  try { return new URL(raw).origin === APP_ORIGIN.origin && new URL(raw).protocol === 'https:'; }
  catch { return false; }
}

function isTrustedNavigation(raw: string) {
  if (isTrustedWebUrl(raw) || raw.startsWith('app://offline/')) return true;
  try { return new URL(raw).hostname === 'accounts.google.com' && new URL(raw).protocol === 'https:'; }
  catch { return false; }
}

function assertSender(event: IpcMainInvokeEvent, allowOffline = true) {
  const senderUrl = event.senderFrame?.url ?? '';
  if (!isAllowedSender(senderUrl, APP_ORIGIN.origin) || (!allowOffline && !isTrustedWebUrl(senderUrl))) {
    throw new Error('Desktop IPC sender is not authorized');
  }
  return new URL(senderUrl).protocol === 'app:';
}

function getSession(): Session {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Desktop window unavailable');
  return mainWindow.webContents.session;
}

async function closeActiveStoreSafely() {
  if (!activeStore) return;
  const previous = activeStore;
  activeStore = null;
  activeClaims = null;
  if (syncInProgress) {
    storesToClose.add(previous);
    return;
  }
  await previous.close();
}

async function clearActiveAccount() {
  await rm(join(OFFLINE_ROOT(), 'active-account.bin'), { force: true });
  await closeActiveStoreSafely();
}

async function setActiveAccount(claims: OfflineGrantClaims) {
  const root = OFFLINE_ROOT();
  await mkdir(root, { recursive: true });
  const identity = JSON.stringify({ userId: claims.userId, tenantId: claims.tenantId });
  await writeFile(join(root, 'active-account.bin'), await safeStorage.encryptStringAsync(identity), { mode: 0o600 });
}

async function activateOfflineAccount(): Promise<boolean> {
  try {
    const encryptedIdentity = await readFile(join(OFFLINE_ROOT(), 'active-account.bin'));
    const { userId, tenantId } = JSON.parse((await safeStorage.decryptStringAsync(encryptedIdentity)).result) as { userId: string; tenantId: string };
    if (typeof userId !== 'string' || typeof tenantId !== 'string' || !PUBLIC_KEY) return false;
    const grantToken = await OfflineStore.readPersistedGrant(OFFLINE_ROOT(), userId, tenantId, safeStorageAdapter);
    if (!grantToken) return false;
    const claims = verifyOfflineGrantSignature(grantToken, publicKey());
    if (!claims || claims.userId !== userId || claims.tenantId !== tenantId) return false;
    await closeActiveStoreSafely();
    activeStore = await OfflineStore.open({ root: OFFLINE_ROOT(), userId, tenantId, grantToken, publicKey: publicKey(), safeStorage: safeStorageAdapter });
    activeClaims = claims;
    return true;
  } catch { return false; }
}

const safeStorageAdapter = {
  isAsyncEncryptionAvailable: () => safeStorage.isAsyncEncryptionAvailable(),
  encryptStringAsync: (value: string) => safeStorage.encryptStringAsync(value),
  async decryptStringAsync(value: Buffer) {
    const result = await safeStorage.decryptStringAsync(value);
    return { result: result.result, shouldReEncrypt: result.shouldReEncrypt };
  },
};

function publicKey() {
  if (!PUBLIC_KEY) throw new Error('Desktop offline authorization key is not configured');
  return PUBLIC_KEY;
}

async function refreshOfflineCache() {
  if (refreshInProgress || syncInProgress) return { ok: false as const, error: 'A sincronização está ocupada. Tente novamente dentro de momentos.' };
  refreshInProgress = true;
  try {
  if (!PUBLIC_KEY) return { ok: false as const, error: 'A autorização offline ainda não está configurada nesta versão.' };
  const response = await getSession().fetch(new URL('/api/desktop/offline-bootstrap', APP_ORIGIN).toString(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const payload = await response.json().catch(() => null) as { grant?: string; snapshot?: unknown; error?: string } | null;
  if (!response.ok || !payload?.grant || !payload.snapshot) return { ok: false as const, error: payload?.error ?? `Não foi possível preparar a cópia offline (${response.status}).` };
  const claims = verifyOfflineGrant(payload.grant, publicKey());
  if (!claims || claims.expiresAt - claims.issuedAt > 12 * 60 * 60) return { ok: false as const, error: 'A autorização recebida é inválida.' };
  if (activeStore && activeClaims?.userId === claims.userId && activeClaims?.tenantId === claims.tenantId) {
    await activeStore.refreshAuthorization(payload.grant, payload.snapshot, publicKey());
  } else {
    await closeActiveStoreSafely();
    activeStore = await OfflineStore.open({ root: OFFLINE_ROOT(), userId: claims.userId, tenantId: claims.tenantId, grantToken: payload.grant, publicKey: publicKey(), safeStorage: safeStorageAdapter });
    await activeStore.replaceSnapshot(payload.snapshot);
  }
  await setActiveAccount(claims);
  activeClaims = claims;
  return { ok: true as const };
  } finally { refreshInProgress = false; }
}

async function syncPendingDrafts() {
  if (syncInProgress || refreshInProgress || !activeStore || !net.isOnline()) return { synced: 0, pending: (await activeStore?.listOutbox() ?? []).filter((row) => row.state !== 'SYNCED').length, conflicts: 0 };
  try {
    if (!activeClaims || Date.now() / 1000 >= activeClaims.expiresAt) {
      const refreshed = await refreshOfflineCache();
      if (!refreshed.ok || !activeStore || !activeClaims || Date.now() / 1000 >= activeClaims.expiresAt) {
        return { synced: 0, pending: (await activeStore?.listOutbox() ?? []).filter((row) => row.state !== 'SYNCED').length, conflicts: 0 };
      }
    }
    syncInProgress = true;
    const grantToken = await activeStore.getGrantToken();
    if (!grantToken) throw new Error('Offline grant is unavailable');
    return await syncDraftQueue(activeStore, { async createDraft(draft) {
      const response = await getSession().fetch(new URL('/api/invoices/drafts', APP_ORIGIN).toString(), {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Desktop-Offline-Grant': grantToken }, body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => null) as { draft?: Record<string, unknown> } | null;
      return { status: response.status, ...(body?.draft ? { draft: body.draft } : {}) };
    } });
  } finally {
    syncInProgress = false;
    await Promise.all([...storesToClose].map((store) => store.close().catch(() => undefined)));
    storesToClose.clear();
  }
}

function registerIpc() {
  const handle = (channel: (typeof IPC_CHANNELS)[number], fn: (event: IpcMainInvokeEvent, ...args: any[]) => unknown) => {
    ipcMain.handle(channel, async (event, ...args) => { assertSender(event); return fn(event, ...args); });
  };
  handle('desktop:status', async () => {
    const rows = await activeStore?.listOutbox() ?? [];
    return { online: net.isOnline(), configured: !!activeStore, expiresAt: activeClaims?.expiresAt ?? null, readOnly: !activeClaims || Date.now() / 1000 >= activeClaims.expiresAt, pendingCount: rows.filter((row) => row.state !== 'SYNCED').length };
  });
  handle('desktop:refresh', (event) => { if (!isTrustedWebUrl(event.senderFrame?.url ?? '')) throw new Error('Only the trusted app can refresh offline access'); return refreshOfflineCache(); });
  handle('desktop:sync', () => syncPendingDrafts());
  handle('desktop:online', async (event) => {
    if (!new URL(event.senderFrame?.url ?? '').protocol.startsWith('app:')) throw new Error('Only the offline workspace can request online mode');
    await mainWindow?.loadURL(APP_ORIGIN.toString());
  });
  handle('desktop:snapshot', (event) => { if (!new URL(event.senderFrame?.url ?? '').protocol.startsWith('app:')) throw new Error('Cached data is available only in offline mode'); return activeStore?.readSnapshot() ?? null; });
  handle('desktop:drafts:list', (event) => { if (!new URL(event.senderFrame?.url ?? '').protocol.startsWith('app:')) throw new Error('Local drafts are available only in offline mode'); return activeStore?.listDrafts() ?? []; });
  handle('desktop:drafts:save', async (event, draft: unknown) => {
    if (!new URL(event.senderFrame?.url ?? '').protocol.startsWith('app:')) throw new Error('Local drafts can only be edited in offline mode');
    if (!isOfflineDraftPayload(draft)) throw new Error('Invalid offline draft payload');
    const normalized = validateInvoiceDraftInput(draft);
    if (!normalized.ok || !activeStore) throw new Error('Offline workspace is not authorized');
    await activeStore.saveDraft({ ...normalized.value, id: (draft as OfflineDraft).id });
  });
}

async function serveOfflineAssets(offlineProtocol: Electron.Protocol) {
  const base = resolve(app.getAppPath(), 'desktop', 'offline-dist');
  await offlineProtocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'offline') return new Response('Not found', { status: 404 });
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\//, '');
    const filePath = resolve(base, relative);
    if (!filePath.startsWith(`${base}${sep}`)) return new Response('Not found', { status: 404 });
    try {
      const bytes = await readFile(filePath);
      const contentType = filePath.endsWith('.html') ? 'text/html; charset=utf-8' : filePath.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
      return new Response(bytes, { headers: { 'Content-Type': contentType, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'" } });
    }
    catch { return new Response('Offline workspace unavailable', { status: 404 }); }
  });
}

async function createWindow() {
  const partitionSession = session.fromPartition(PARTITION);
  mainWindow = new BrowserWindow({
    width: 1280, height: 850, minWidth: 360, minHeight: 600,
    webPreferences: { preload: join(app.getAppPath(), app.isPackaged ? 'preload.cjs' : 'dist-electron/preload.cjs'), partition: PARTITION, contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) void shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) event.preventDefault();
    else if (isTrustedWebUrl(url) && /^\/(?:login|logout)(?:[/?#]|$)/i.test(new URL(url).pathname)) {
      void clearActiveAccount().catch((error) => console.error('Could not clear offline account after sign-out', error));
    }
  });
  mainWindow.webContents.on('did-navigate-in-page', (_event, url) => {
    if (isTrustedWebUrl(url) && /^\/(?:login|logout)(?:[/?#]|$)/i.test(new URL(url).pathname)) {
      void clearActiveAccount().catch((error) => console.error('Could not clear offline account after sign-out', error));
    }
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) void enterOfflineWorkspace();
  });
  try { await mainWindow.loadURL(APP_ORIGIN.toString()); }
  catch { await enterOfflineWorkspace(); }
}

async function enterOfflineWorkspace() {
  if (loadingOffline || !mainWindow || mainWindow.isDestroyed()) return;
  loadingOffline = true;
  try { await activateOfflineAccount(); await mainWindow.loadURL('app://offline/'); }
  catch (error) { console.error('Unable to open offline workspace', error); }
  finally { loadingOffline = false; }
}

app.whenReady().then(async () => {
  if (APP_ORIGIN.protocol !== 'https:' || APP_ORIGIN.username || APP_ORIGIN.password) throw new Error('Desktop app origin must be HTTPS');
  await serveOfflineAssets(session.fromPartition(PARTITION).protocol);
  registerIpc();
  await createWindow();
  setInterval(() => { if (net.isOnline()) void syncPendingDrafts().catch(() => undefined); }, 30_000);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
}).catch((error) => { console.error('Desktop app startup failed', error); app.quit(); });

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', (event) => {
  if (shutdownComplete || !activeStore) return;
  event.preventDefault();
  const store = activeStore;
  activeStore = null;
  void Promise.all([...(store ? [store.close()] : []), ...[...storesToClose].map((pending) => pending.close())]).catch((error) => console.error('Could not flush local offline store during shutdown', error)).finally(() => {
    shutdownComplete = true;
    app.quit();
  });
});
