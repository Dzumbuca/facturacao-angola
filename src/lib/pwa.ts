export const PWA_DISMISS_KEY = 'machine-facturas-pwa-dismissed';
export const PWA_DISMISS_MS = 30 * 24 * 60 * 60 * 1000;

/** A app está a correr instalada (standalone)? */
export function isStandalone(displayModeStandalone: boolean, navigatorStandalone?: boolean | null): boolean {
  return Boolean(displayModeStandalone || navigatorStandalone);
}

/** iPhone/iPad, incluindo iPadOS que se apresenta como Mac com toque. */
export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Safari real em iOS (Chrome/Firefox/Edge iOS não instalam pela barra). */
export function isIosSafari(userAgent: string, vendor: string): boolean {
  if (!isIosDevice(userAgent)) return false;
  if (!/apple/i.test(vendor)) return false;
  return !/(crios|fxios|edgios|opios)/i.test(userAgent);
}

/** O botão só aparece em iOS (instruções) ou quando há prompt nativo. */
export function shouldShowInstall(state: { installed: boolean; dismissed: boolean; hasPrompt: boolean; ios: boolean }): boolean {
  return !state.installed && !state.dismissed && (state.hasPrompt || state.ios);
}

export function isDismissalActive(dismissedAt: number, now = Date.now()): boolean {
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
  return now - dismissedAt < PWA_DISMISS_MS;
}
