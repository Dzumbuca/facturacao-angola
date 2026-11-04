// tests/e2e/wms/http-auth.test.ts
// Testes de autenticacao HTTP real contra NextAuth (staging).
// Requer servidor Next.js em execucao: npm run dev (com .env.playwright)
import { describe, it, expect } from 'vitest';
import { login, authenticatedFetch, logout } from './http-auth-harness';

describe('WMS v2 E2E - HTTP Auth (staging)', () => {
  it('login returns session cookies', async () => {
    const session = await login();
    expect(session.cookies).toBeTruthy();
    expect(session.cookies).toContain('next-auth');
  });

  it('authenticated request to /api/stock returns 200', async () => {
    const session = await login();
    const res = await authenticatedFetch('/api/stock', session);
    expect(res.status).toBe(200);
  });

  it('unauthenticated request to /api/stock returns 401', async () => {
    const res = await fetch('http://localhost:3000/api/stock');
    expect(res.status).toBe(401);
  });

  it('logout invalidates session', async () => {
    const session = await login();
    await logout(session);
    const res = await authenticatedFetch('/api/stock', session);
    // After logout, session cookie should be invalidated
    expect(res.status).toBe(401);
  });
});