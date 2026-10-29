import { describe, expect, it } from 'vitest';
import { isAllowedSender, isOfflineDraftPayload, IPC_CHANNELS } from './ipc-contract';

describe('desktop IPC contract', () => {
  it('allows only the trusted web origin and packaged offline origin', () => {
    expect(isAllowedSender('https://machinefaturas.shop/home', 'https://machinefaturas.shop')).toBe(true);
    expect(isAllowedSender('app://offline/', 'https://machinefaturas.shop')).toBe(true);
    expect(isAllowedSender('https://evil.example/', 'https://machinefaturas.shop')).toBe(false);
    expect(isAllowedSender('file:///etc/passwd', 'https://machinefaturas.shop')).toBe(false);
  });

  it('exposes named channels and rejects renderer-selected identities or malformed drafts', () => {
    expect(IPC_CHANNELS).not.toContain('ipc');
    const valid = { id: '11111111-1111-4111-8111-111111111111', customerName: 'Cliente', items: [] };
    expect(isOfflineDraftPayload(valid)).toBe(true);
    expect(isOfflineDraftPayload({ ...valid, tenantId: 'other-tenant' })).toBe(false);
    expect(isOfflineDraftPayload({ ...valid, id: 'x' })).toBe(false);
  });
});
