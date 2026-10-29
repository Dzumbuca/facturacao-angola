import { describe, expect, it } from 'vitest';
import { syncDraftQueue, type DesktopOutboxRecord } from './desktop-sync-core';

function fakeStore() {
  const rows: DesktopOutboxRecord[] = [{ id: 'draft-id', payload: { id: 'draft-id', customerName: 'Cliente' }, state: 'PENDING', attempts: 0, retryAt: 0 }];
  return {
    rows,
    async listOutbox() { return rows; },
    async updateSyncState(_id: string, state: DesktopOutboxRecord['state'], _serverDraft?: Record<string, unknown>) { rows[0].state = state; },
    async scheduleRetry() { rows[0].state = 'ERROR'; rows[0].attempts++; rows[0].retryAt = 50_000; },
    async holdForUser() { rows[0].state = 'ERROR'; rows[0].retryAt = Number.MAX_SAFE_INTEGER; },
  };
}

describe('offline draft synchronization', () => {
  it('retries a network failure with the same stable id and synchronizes once', async () => {
    const store = fakeStore();
    const ids: string[] = [];
    let calls = 0;
    const api = { async createDraft(draft: Record<string, unknown>) {
      ids.push(String(draft.id)); calls++;
      if (calls === 1) throw new Error('offline');
      return { status: 201, draft: { ...draft, status: 'DRAFT' } };
    } };
    const first = await syncDraftQueue(store, api, 1_000);
    expect(first.pending).toBe(1);
    expect(store.rows[0].state).toBe('ERROR');
    expect((await syncDraftQueue(store, api, 2_000)).synced).toBe(0);
    store.rows[0].retryAt = 0;
    const recovered = await syncDraftQueue(store, api, 60_000);
    expect(recovered.synced).toBe(1);
    expect(ids).toEqual(['draft-id', 'draft-id']);
    expect(store.rows[0].state).toBe('SYNCED');
  });

  it('retains a conflict and never overwrites a server draft', async () => {
    const store = fakeStore();
    const result = await syncDraftQueue(store, { async createDraft() { return { status: 409 }; } }, 1_000);
    expect(result.conflicts).toBe(1);
    expect(store.rows[0].state).toBe('CONFLICT');
  });
});
