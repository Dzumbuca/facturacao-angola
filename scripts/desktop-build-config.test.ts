import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { getDesktopBuildConfig } from './desktop-build-config.cjs';

describe('desktop build configuration', () => {
  it('normalizes only the public Ed25519 key for the executable', () => {
    const pair = generateKeyPairSync('ed25519');
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const config = getDesktopBuildConfig({ DESKTOP_OFFLINE_GRANT_PUBLIC_KEY: publicKey });
    expect(config.publicKey).toBe(publicKey);
    expect(config.publicKey).not.toContain('PRIVATE KEY');
    expect(() => getDesktopBuildConfig({ DESKTOP_OFFLINE_GRANT_PUBLIC_KEY: privateKey })).toThrow(/public/i);
  });

  it('allows HTTPS origins only and permits an empty public key for online-only builds', () => {
    expect(getDesktopBuildConfig({}).publicKey).toBe('');
    expect(getDesktopBuildConfig({ DESKTOP_APP_ORIGIN: 'https://machinefaturas.shop' }).origin).toBe('https://machinefaturas.shop');
    expect(() => getDesktopBuildConfig({ DESKTOP_APP_ORIGIN: 'http://machinefaturas.shop' })).toThrow(/HTTPS/i);
    expect(() => getDesktopBuildConfig({ DESKTOP_APP_ORIGIN: 'https://machinefaturas.shop/login' })).toThrow(/origin/i);
  });
});
