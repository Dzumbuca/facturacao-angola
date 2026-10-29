import { validateInvoiceDraftInput } from '../src/lib/invoice-draft-validation';
import type { OfflineDraft, SyncState } from './offline-store';

export const IPC_CHANNELS = [
  'desktop:status', 'desktop:refresh', 'desktop:sync', 'desktop:online',
  'desktop:snapshot', 'desktop:drafts:list', 'desktop:drafts:save',
] as const;
export type DesktopStatus = { online: boolean; configured: boolean; expiresAt: number | null; readOnly: boolean; pendingCount: number };
export type DesktopApi = {
  getStatus(): Promise<DesktopStatus>;
  refreshOfflineCache(): Promise<{ ok: boolean; error?: string }>;
  syncPendingDrafts(): Promise<{ synced: number; pending: number; conflicts: number }>;
  connectOnline(): Promise<void>;
  readSnapshot(): Promise<unknown | null>;
  listDrafts(): Promise<OfflineDraft[]>;
  saveDraft(draft: OfflineDraft): Promise<void>;
};

export function isAllowedSender(senderUrl: string, appOrigin: string): boolean {
  try {
    const url = new URL(senderUrl);
    if (url.protocol === 'app:' && url.hostname === 'offline' && url.pathname === '/') return true;
    const origin = new URL(appOrigin);
    return origin.protocol === 'https:' && url.origin === origin.origin;
  } catch { return false; }
}

export function isOfflineDraftPayload(value: unknown): value is OfflineDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  const allowed = new Set(['id', 'customerName', 'customerNif', 'items', 'applyVat', 'discountType', 'discountValue', 'observations', 'includeCompanyProfile', 'currency', 'dueAt', 'companyBankAccountId']);
  if (Object.keys(data).some((key) => !allowed.has(key))) return false;
  if (typeof data.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) return false;
  return validateInvoiceDraftInput(data).ok;
}

export function isSyncState(value: unknown): value is SyncState {
  return value === 'PENDING' || value === 'SYNCING' || value === 'SYNCED' || value === 'CONFLICT' || value === 'ERROR';
}
