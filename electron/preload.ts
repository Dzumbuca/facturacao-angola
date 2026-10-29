import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type DesktopApi, type DesktopStatus } from './ipc-contract';
import type { OfflineDraft } from './offline-store';

const invoke = <T>(channel: (typeof IPC_CHANNELS)[number], ...args: unknown[]) => ipcRenderer.invoke(channel, ...args) as Promise<T>;
const api: DesktopApi = Object.freeze({
  getStatus: () => invoke<DesktopStatus>('desktop:status'),
  refreshOfflineCache: () => invoke<{ ok: boolean; error?: string }>('desktop:refresh'),
  syncPendingDrafts: () => invoke<{ synced: number; pending: number; conflicts: number }>('desktop:sync'),
  connectOnline: () => invoke<void>('desktop:online'),
  readSnapshot: () => invoke<unknown | null>('desktop:snapshot'),
  listDrafts: () => invoke<OfflineDraft[]>('desktop:drafts:list'),
  saveDraft: (draft) => invoke<void>('desktop:drafts:save', draft),
});

contextBridge.exposeInMainWorld('machineFacturasDesktop', api);
