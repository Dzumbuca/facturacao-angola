import { NextResponse } from 'next/server';
import { encode } from '@auth/core/jwt';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { runWithRlsContext } from '@/lib/tenant-db';

const COOKIE_NAME = 'authjs.session-token';
const SECURE_COOKIE_NAME = '__Secure-authjs.session-token';

function getCookieNames(isSecure: boolean) {
  return isSecure ? { name: SECURE_COOKIE_NAME, salt: SECURE_COOKIE_NAME } : { name: COOKIE_NAME, salt: COOKIE_NAME };
}

export async function POST(request: Request) {
  try {
    const isSecure = request.url.startsWith('https://');
    const { name: cookieName, salt: cookieSalt } = getCookieNames(isSecure);
    const body = await request.text();
    const params = new URLSearchParams(body);
    const email = params.get('email')?.trim().toLowerCase();
    const password = params.get('password');
    const callbackUrl = params.get('callbackUrl') ?? '/';

    if (!email || !password) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 });
    }

    const user = await runWithRlsContext((tx) => (tx.user as any).findUnique({
      where: { email },
      select: { id: true, name: true, email: true, tenantId: true, password: true, status: true, emailVerified: true, emailVerificationRequired: true, sessionVersion: true },
    }), { userId: null, tenantId: null, isAdmin: true }) as any;

    if (!user?.password || user.status !== 'ACTIVE' || (user.emailVerificationRequired && !user.emailVerified)) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 400 });
    }

    const token = await encode({
      token: {
        sub: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId ?? null,
        sessionVersion: user.sessionVersion,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      salt: cookieSalt,
    });

    const response = NextResponse.json({
      ok: true,
      url: callbackUrl,
    });

    response.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}