import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const COOKIE_NAME = 'authjs.session-token';
const SECURE_COOKIE_NAME = '__Secure-authjs.session-token';

function getCookieName(request: Request): string {
  return request.url.startsWith('https://') ? SECURE_COOKIE_NAME : COOKIE_NAME;
}

export async function GET(request: Request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    cookieName: getCookieName(request),
  } as never);

  return NextResponse.json({ csrfToken: token?.csrfToken ?? '' });
}