import { describe, expect, it } from 'vitest';
import { isDismissalActive, isIosDevice, isIosSafari, isStandalone, shouldShowInstall, PWA_DISMISS_MS } from './pwa';

describe('pwa helpers', () => {
  it('detecta standalone', () => {
    expect(isStandalone(true, false)).toBe(true);
    expect(isStandalone(false, true)).toBe(true);
    expect(isStandalone(false, false)).toBe(false);
  });

  it('detecta iPhone/iPad e iPadOS como Mac com toque', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14)')).toBe(false);
  });

  it('distingue Safari de outros navegadores em iOS', () => {
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1';
    expect(isIosSafari(safari, 'Apple Computer, Inc.')).toBe(true);
    expect(isIosSafari(safari.replace('Safari/604.1', 'CriOS/120.0'), 'Google Inc.')).toBe(false);
  });

  it('só mostra com prompt nativo ou em iOS, e esconde se instalada/descartada', () => {
    expect(shouldShowInstall({ installed: false, dismissed: false, hasPrompt: true, ios: false })).toBe(true);
    expect(shouldShowInstall({ installed: false, dismissed: false, hasPrompt: false, ios: true })).toBe(true);
    expect(shouldShowInstall({ installed: true, dismissed: false, hasPrompt: true, ios: true })).toBe(false);
    expect(shouldShowInstall({ installed: false, dismissed: true, hasPrompt: true, ios: true })).toBe(false);
    expect(shouldShowInstall({ installed: false, dismissed: false, hasPrompt: false, ios: false })).toBe(false);
  });

  it('respeita a janela de dispensa de 30 dias', () => {
    const now = Date.now();
    expect(isDismissalActive(0, now)).toBe(false);
    expect(isDismissalActive(now - 1000, now)).toBe(true);
    expect(isDismissalActive(now - PWA_DISMISS_MS - 1000, now)).toBe(false);
  });
});
