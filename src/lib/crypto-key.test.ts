import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { getInvoiceSigningKey } from './crypto';

describe('invoice signing key configuration', () => {
  it('requires a persistent configured key instead of generating a random process key', () => {
    expect(() => getInvoiceSigningKey({})).toThrow(/PRIVATE_KEY/);
  });

  it('accepts a configured PEM private key', () => {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 1024 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(getInvoiceSigningKey({ PRIVATE_KEY: pem.replace(/\n/g, '\\n') }).asymmetricKeyType).toBe('rsa');
  });
});
