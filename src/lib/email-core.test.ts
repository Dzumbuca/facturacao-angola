import { describe, expect, it } from 'vitest';
import { parseEmailConfiguration, sanitizeSmtpError } from './email-core';

const configured = {
  SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465', SMTP_SECURE: 'true',
  SMTP_USER: 'mailer@example.test', SMTP_PASSWORD: 'not-a-real-secret',
  EMAIL_FROM_NAME: 'Machine Facturas', EMAIL_FROM: 'mailer@example.test', APP_URL: 'http://localhost:3002',
};

describe('email configuration', () => {
  it('parses a configured TLS transport without exposing the password', () => {
    const result = parseEmailConfiguration(configured, 'development');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.config).toMatchObject({ host: 'smtp.example.test', port: 465, secure: true, fromName: 'Machine Facturas' });
    expect(JSON.stringify(result)).not.toContain(configured.SMTP_PASSWORD);
  });

  it('reports missing values by variable name only', () => {
    const result = parseEmailConfiguration({ ...configured, SMTP_PASSWORD: '' }, 'development');
    expect(result).toMatchObject({ ok: false, missing: ['SMTP_PASSWORD'] });
    expect(JSON.stringify(result)).not.toContain(configured.SMTP_USER);
  });

  it('requires HTTPS for production action links', () => {
    expect(parseEmailConfiguration({ ...configured, APP_URL: 'http://machine.example.test' }, 'production')).toMatchObject({ ok: false, insecureProductionUrl: true });
  });

  it('sanitizes SMTP errors without returning provider messages or credentials', () => {
    expect(sanitizeSmtpError({ code: 'EAUTH', message: 'bad password mailer@example.test' })).toBe('SMTP_AUTH');
    expect(sanitizeSmtpError({ code: 'ETIMEDOUT', message: 'smtp.example.test timeout' })).toBe('SMTP_CONNECTION');
  });
});
