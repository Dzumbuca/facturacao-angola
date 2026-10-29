import type { DesktopApi } from '../../electron/ipc-contract';

declare global {
  interface Window { machineFacturasDesktop?: DesktopApi }
}

export {};
