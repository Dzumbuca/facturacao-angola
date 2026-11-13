// tests/e2e/wms/http-auth-harness.ts
// Harness HTTP: autenticação real contra NextAuth contra um servidor já em execução.
// Requer o servidor Next.js em execucao (E2E_PORT default 3002).

const BASE_URL = process.env.APP_URL || 'http://localhost:3002';
const DEFAULT_EMAIL = 'e2e-test@machinefacturas.test';
const DEFAULT_PASSWORD = 'TestPass123!';

export interface AuthSession {
  cookies: string;
  csrfToken: string;
}

function extractCookieNameValuePairs(setCookieHeader: string | null | undefined): string[] {
  if (!setCookieHeader) return [];
  // Next.js/Node liga várias Set-Cookie pelo separador ', ' quando não há aspas.
  // Para tratar correctamente, dividimos por '", "' e por '","'.
  // Porém a maioria de valores JWT não contém vírgulas sem aspas;
  // o problema estava apenas na Expires=Sat, 12 Dec...que contém vírgula não aspasficada.
  // Para testes de auth, preferimos separar manualmente por segmentos de cookie.
  const parts = setCookieHeader.split(/,(?=\s*[A-Za-z_][A-Za-z0-9_.-]*=)/);
  const pairs: string[] = [];
  for (const part of parts) {
    const first = part.split(';')[0].trim();
    if (first) pairs.push(first);
  }
  return pairs;
}

export async function getCsrfToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/csrf`);
  const json = await res.json();
  const setCookie = res.headers.get('set-cookie') || '';
  (global as any).__csrfCookie = setCookie;
  return json.csrfToken;
}

export async function login(email: string = DEFAULT_EMAIL, password: string = DEFAULT_PASSWORD): Promise<AuthSession> {
  const csrfToken = await getCsrfToken();
  const csrfCookie = (global as any).__csrfCookie || '';

  const csrfPairs = extractCookieNameValuePairs(csrfCookie);

  const body = new URLSearchParams({
    csrfToken,
    email,
    password,
    callbackUrl: `${BASE_URL}/`,
    json: 'true',
  });

  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfPairs.join('; '),
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const loginSetCookie = res.headers.get('set-cookie') || '';
  const sessionPairs = extractCookieNameValuePairs(loginSetCookie);

  const cookieMap = new Map<string, string>();
  for (const pair of [...csrfPairs, ...sessionPairs]) {
    const nameValue = pair.split('=');
    const name = nameValue[0].trim();
    cookieMap.set(name, pair);
  }
  const allCookies = Array.from(cookieMap.values()).join('; ');

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
