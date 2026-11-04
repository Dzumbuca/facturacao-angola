// tests/e2e/wms/http-auth-harness.ts
// Harness HTTP de autenticacao real contra NextAuth (staging).
// Requer o servidor Next.js em execucao (npm run dev com .env.playwright).

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const TEST_USER_EMAIL = 'e2e-test@machinefacturas.test';
const TEST_USER_PASSWORD = 'TestPass123!';

export interface AuthSession {
  cookies: string;
  csrfToken: string;
}

export async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/csrf`);
  const json = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  // store cookie for subsequent calls
  (global as any).__csrfCookie = setCookie;
  return json.csrfToken;
}

export async function login(): Promise<AuthSession> {
  const csrfToken = await getCsrfToken();
  const csrfCookie = (global as any).__csrfCookie || '';

  const body = new URLSearchParams({
    csrfToken,
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    callbackUrl: `${BASE_URL}/`,
    json: 'true',
  });

  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookie,
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const setCookieHeader = res.headers.get('set-cookie') || '';
  const allCookies = [csrfCookie, setCookieHeader].filter(Boolean).join('; ');

  return { cookies: allCookies, csrfToken };
}

export async function authenticatedFetch(path: string, session: AuthSession, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Cookie: session.cookies,
    },
  });
}

export async function logout(session: AuthSession): Promise<Response> {
  return fetch(`${BASE_URL}/api/auth/signout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: session.cookies,
    },
    body: new URLSearchParams({ csrfToken: session.csrfToken, json: 'true' }).toString(),
    redirect: 'manual',
  });
}