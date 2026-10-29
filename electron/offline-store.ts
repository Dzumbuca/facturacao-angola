import { createCipheriv, createDecipheriv, randomBytes, createHash, type KeyLike } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { verifyOfflineGrantSignature, type OfflineGrantClaims } from '../src/lib/offline-grant-core';

export type SafeStorage = { isAsyncEncryptionAvailable(): Promise<boolean>; encryptStringAsync(value: string): Promise<Buffer>; decryptStringAsync(value: Buffer): Promise<{ result: string; shouldReEncrypt: boolean }> };
export type SyncState = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'ERROR';
export type OfflineDraft = Record<string, unknown> & { id: string; syncState?: SyncState };
export type OfflineOutboxRecord = { id: string; payload: OfflineDraft; state: SyncState; attempts: number; retryAt: number };
type OpenOptions = { root: string; userId: string; tenantId: string; grantToken: string; publicKey: KeyLike; safeStorage: SafeStorage; now?: number };

const require = createRequire(__filename);
let sqlPromise: Promise<SqlJsStatic> | undefined;
function getSql() {
  sqlPromise ??= initSqlJs({ locateFile: () => require.resolve('sql.js/dist/sql-wasm.wasm') });
  return sqlPromise;
}

function encrypt(value: unknown, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function decrypt<T>(value: string, key: Buffer): T {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Offline data is invalid');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')) as T;
}

export function accountPartitionId(userId: string, tenantId: string): string {
  return createHash('sha256').update(`${userId}\0${tenantId}`).digest('hex');
}

export class OfflineStore {
  private lock = Promise.resolve();
  private closed = false;
  private constructor(
    private readonly db: Database,
    private readonly dbPath: string,
    private readonly key: Buffer,
    private claims: OfflineGrantClaims,
    private readonly safeStorage: SafeStorage,
    private readonly now: () => number,
  ) {}

  static async open(options: OpenOptions): Promise<OfflineStore> {
    if (!await options.safeStorage.isAsyncEncryptionAvailable()) throw new Error('OS encryption is unavailable; offline data will not be stored');
    const claims = verifyOfflineGrantSignature(options.grantToken, options.publicKey);
    if (!claims || claims.userId !== options.userId || claims.tenantId !== options.tenantId) throw new Error('Offline grant scope is invalid');
    const partition = accountPartitionId(claims.userId, claims.tenantId);
    await mkdir(options.root, { recursive: true });
    const dbPath = join(options.root, `${partition}.sqlite`);
    const keyPath = join(options.root, `${partition}.key`);
    let key: Buffer;
    try {
      const wrappedKey = await options.safeStorage.decryptStringAsync(await readFile(keyPath));
      key = Buffer.from(wrappedKey.result, 'base64');
      if (key.length !== 32) throw new Error('Invalid wrapped data key');
      if (wrappedKey.shouldReEncrypt) await writeFile(keyPath, await options.safeStorage.encryptStringAsync(key.toString('base64')), { mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      key = randomBytes(32);
      await writeFile(keyPath, await options.safeStorage.encryptStringAsync(key.toString('base64')), { mode: 0o600, flag: 'wx' });
    }
    const SQL = await getSql();
    let db: Database;
    try { db = new SQL.Database(new Uint8Array(await readFile(dbPath))); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      db = new SQL.Database();
    }
    db.run('CREATE TABLE IF NOT EXISTS records (record_key TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    db.run('CREATE TABLE IF NOT EXISTS outbox (id TEXT PRIMARY KEY, payload TEXT NOT NULL, state TEXT NOT NULL, updated_at INTEGER NOT NULL, retry_at INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0)');
    const columns = db.exec('PRAGMA table_info(outbox)')[0]?.values.map((row) => String(row[1])) ?? [];
    if (!columns.includes('retry_at')) db.run('ALTER TABLE outbox ADD COLUMN retry_at INTEGER NOT NULL DEFAULT 0');
    if (!columns.includes('attempts')) db.run('ALTER TABLE outbox ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0');
    const store = new OfflineStore(db, dbPath, key, claims, options.safeStorage, () => options.now ?? Math.floor(Date.now() / 1000));
    const existingGrant = store.getRecord<string>('grant');
    if (existingGrant && existingGrant !== options.grantToken) {
      const oldClaims = verifyOfflineGrantSignature(existingGrant, options.publicKey);
      if (!oldClaims || oldClaims.userId !== claims.userId || oldClaims.tenantId !== claims.tenantId) throw new Error('Stored account scope mismatch');
    }
    await store.putRecord('grant', options.grantToken);
    await store.persist();
    await writeFile(join(options.root, `${partition}.grant`), await options.safeStorage.encryptStringAsync(options.grantToken), { mode: 0o600 });
    return store;
  }

  static async readPersistedGrant(root: string, userId: string, tenantId: string, storage: SafeStorage): Promise<string | null> {
    const path = join(root, `${accountPartitionId(userId, tenantId)}.grant`);
    try {
      const encrypted = await readFile(path);
      const decrypted = await storage.decryptStringAsync(encrypted);
      if (decrypted.shouldReEncrypt) await writeFile(path, await storage.encryptStringAsync(decrypted.result), { mode: 0o600 });
      return decrypted.result;
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }

  get authorization(): { expired: boolean; expiresAt: number } {
    return { expired: this.now() >= this.claims.expiresAt, expiresAt: this.claims.expiresAt };
  }

  async readSnapshot<T = unknown>(): Promise<T | null> { return this.getRecord<T>('snapshot') ?? null; }
  async getGrantToken(): Promise<string | null> { return this.getRecord<string>('grant'); }

  async replaceSnapshot(snapshot: unknown): Promise<void> {
    await this.write(async () => { this.assertWritable(); this.putRecord('snapshot', snapshot); });
  }

  async refreshAuthorization(grantToken: string, snapshot: unknown, publicKey: KeyLike): Promise<void> {
    const claims = verifyOfflineGrantSignature(grantToken, publicKey);
    if (!claims || claims.userId !== this.claims.userId || claims.tenantId !== this.claims.tenantId) throw new Error('Offline grant scope is invalid');
    await this.write(async () => {
      this.putRecord('grant', grantToken);
      this.putRecord('snapshot', snapshot);
      await this.persist();
      await writeFile(this.dbPath.replace(/\.sqlite$/, '.grant'), await this.safeStorage.encryptStringAsync(grantToken), { mode: 0o600 });
    });
    this.claims = claims;
  }

  async saveDraft(draft: OfflineDraft): Promise<void> {
    if (!draft || typeof draft.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(draft.id)) throw new Error('Draft id must be a UUID');
    await this.write(async () => {
      this.assertWritable();
      const existing = this.getRecord<OfflineDraft>(`draft:${draft.id}`);
      if (existing?.syncState === 'SYNCED' || existing?.syncState === 'CONFLICT') throw new Error('This draft is read-only until it is resolved online');
      const safeDraft = { ...draft, syncState: 'PENDING' as const };
      this.putRecord(`draft:${draft.id}`, safeDraft);
      this.db.run('INSERT INTO outbox(id, payload, state, updated_at, retry_at, attempts) VALUES (?, ?, ?, ?, 0, 0) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, state = \'PENDING\', updated_at = excluded.updated_at, retry_at = 0, attempts = 0', [draft.id, encrypt(safeDraft, this.key), 'PENDING', Date.now()]);
    });
  }

  async listDrafts(): Promise<OfflineDraft[]> {
    const result = this.db.exec("SELECT record_key, payload FROM records WHERE record_key LIKE 'draft:%'");
    return result.flatMap((table) => table.values.map((row) => decrypt<OfflineDraft>(String(row[1]), this.key)));
  }

  async listOutbox(): Promise<OfflineOutboxRecord[]> {
    const stmt = this.db.prepare('SELECT id, payload, state, attempts, retry_at FROM outbox ORDER BY updated_at ASC');
    const rows: OfflineOutboxRecord[] = [];
    try { while (stmt.step()) { const row = stmt.getAsObject(); rows.push({ id: String(row.id), payload: decrypt<OfflineDraft>(String(row.payload), this.key), state: String(row.state) as SyncState, attempts: Number(row.attempts), retryAt: Number(row.retry_at) }); } }
    finally { stmt.free(); }
    return rows;
  }

  async updateSyncState(id: string, state: SyncState, serverDraft?: OfflineDraft): Promise<void> {
    await this.write(async () => {
      const rows = await this.listDrafts();
      const local = rows.find((draft) => draft.id === id);
      if (!local) throw new Error('Draft not found');
      const updated = { ...(serverDraft ? { ...local, ...serverDraft } : local), syncState: state };
      this.putRecord(`draft:${id}`, updated);
      this.db.run('UPDATE outbox SET payload = ?, state = ?, updated_at = ?, retry_at = CASE WHEN ? = \'SYNCED\' THEN 0 ELSE retry_at END WHERE id = ?', [encrypt(updated, this.key), state, Date.now(), state, id]);
    });
  }

  async scheduleRetry(id: string): Promise<void> {
    await this.write(async () => {
      const stmt = this.db.prepare('SELECT attempts FROM outbox WHERE id = ?');
      let attempts = 0;
      try { stmt.bind([id]); if (stmt.step()) attempts = Number(stmt.getAsObject().attempts); }
      finally { stmt.free(); }
      const delay = Math.min(15 * 60_000, 30_000 * 2 ** Math.min(attempts, 5));
      this.db.run('UPDATE outbox SET attempts = attempts + 1, retry_at = ?, updated_at = ? WHERE id = ?', [Date.now() + delay, Date.now(), id]);
    });
  }

  async holdForUser(id: string): Promise<void> {
    await this.write(async () => {
      this.db.run('UPDATE outbox SET retry_at = ?, updated_at = ? WHERE id = ?', [Number.MAX_SAFE_INTEGER, Date.now(), id]);
    });
  }

  async close(): Promise<void> {
    if (this.closed) return;
    await this.lock;
    try { await this.persist(); }
    finally { this.db.close(); this.closed = true; this.key.fill(0); }
  }

  private getRecord<T>(key: string): T | null {
    const stmt = this.db.prepare('SELECT payload FROM records WHERE record_key = ?');
    try { stmt.bind([key]); return stmt.step() ? decrypt<T>(String(stmt.getAsObject().payload), this.key) : null; }
    finally { stmt.free(); }
  }

  private putRecord(key: string, value: unknown) {
    this.db.run('INSERT INTO records(record_key, payload) VALUES (?, ?) ON CONFLICT(record_key) DO UPDATE SET payload = excluded.payload', [key, encrypt(value, this.key)]);
  }

  private assertWritable() {
    if (this.now() >= this.claims.expiresAt) throw new Error('Offline authorization expired; reconnect to renew it');
    if (!this.claims.canCreateInvoiceDrafts) throw new Error('Offline draft creation is not authorized');
  }

  private async write(operation: () => Promise<void>) {
    const previous = this.lock;
    let release!: () => void;
    this.lock = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    let inTransaction = false;
    try {
      if (this.closed) throw new Error('Offline store is closed');
      this.db.run('BEGIN IMMEDIATE');
      inTransaction = true;
      await operation();
      this.db.run('COMMIT');
      inTransaction = false;
      await this.persist();
    }
    catch (error) {
      if (inTransaction) { try { this.db.run('ROLLBACK'); } catch { /* The database may already have rolled back. */ } }
      else if (!this.closed) { this.db.close(); this.closed = true; this.key.fill(0); }
      throw error;
    }
    finally { release(); }
  }

  private async persist() {
    const temporary = `${this.dbPath}.tmp`;
    await writeFile(temporary, Buffer.from(this.db.export()), { mode: 0o600 });
    await rename(temporary, this.dbPath);
  }
}
