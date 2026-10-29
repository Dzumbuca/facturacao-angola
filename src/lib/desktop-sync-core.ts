export type DesktopSyncState = 'PENDING' | 'SYNCING' | 'SYNCED' | 'CONFLICT' | 'ERROR';
export type DesktopOutboxRecord = { id: string; payload: Record<string, unknown>; state: DesktopSyncState; attempts: number; retryAt: number };
export type DesktopSyncStore = {
  listOutbox(): Promise<DesktopOutboxRecord[]>;
  updateSyncState(id: string, state: DesktopSyncState, serverDraft?: Record<string, unknown>): Promise<void>;
  scheduleRetry(id: string): Promise<void>;
  holdForUser(id: string): Promise<void>;
};
export type DesktopDraftApi = { createDraft(draft: Record<string, unknown>): Promise<{ status: number; draft?: Record<string, unknown> }> };
export type SyncSummary = { synced: number; pending: number; conflicts: number };

export async function syncDraftQueue(store: DesktopSyncStore, api: DesktopDraftApi, now = Date.now()): Promise<SyncSummary> {
  let synced = 0;
  let conflicts = 0;
  for (const item of await store.listOutbox()) {
    if (item.state === 'SYNCED' || item.state === 'CONFLICT' || item.retryAt > now) continue;
    await store.updateSyncState(item.id, 'SYNCING');
    try {
      const response = await api.createDraft({ ...item.payload, id: item.id });
      if ((response.status === 200 || response.status === 201) && response.draft?.id === item.id) {
        await store.updateSyncState(item.id, 'SYNCED', response.draft);
        synced++;
      } else if (response.status === 409 || ((response.status === 200 || response.status === 201) && response.draft?.id !== item.id)) {
        await store.updateSyncState(item.id, 'CONFLICT');
        conflicts++;
      } else {
        await store.updateSyncState(item.id, 'ERROR');
        if (response.status === 401 || response.status === 403) { await store.scheduleRetry(item.id); break; }
        if (response.status === 408 || response.status === 429 || response.status >= 500) { await store.scheduleRetry(item.id); if (response.status === 429 || response.status >= 500) break; }
        else await store.holdForUser(item.id);
      }
    } catch {
      await store.updateSyncState(item.id, 'ERROR');
      await store.scheduleRetry(item.id);
      break;
    }
  }
  const remaining = await store.listOutbox();
  return { synced, pending: remaining.filter((row) => row.state !== 'SYNCED').length, conflicts };
}
