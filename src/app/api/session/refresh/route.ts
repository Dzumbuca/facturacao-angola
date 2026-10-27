import { NextRequest, NextResponse } from 'next/server';
import { decode, encode } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { canRefreshAuthSession } from '@/lib/session-refresh-security';

// Reemite o token de sessão com os dados frescos da base de dados.
// Usado depois do onboarding (empresa criada) para que o proxy, que lê
// apenas o JWT, passe a ver o tenantId sem novo login.
export async function POST(request: NextRequest) {
  try {
    const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
    const cookieName = secure ? '__Secure-authjs.session-token' : 'authjs.session-token';
    const raw = request.cookies.get(cookieName)?.value;
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';
    if (!raw || !secret) return NextResponse.json({ error: 'Sessão inexistente.' }, { status: 401 });

    const token = await decode({ token: raw, secret, salt: cookieName });
    if (!token?.sub) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

    const user = await (prisma.user as any).findUnique({
      where: { id: token.sub },
      select: { status: true, tenantId: true, sessionVersion: true, emailVerified: true, emailVerificationRequired: true },
    });
    if (!canRefreshAuthSession(token, user)) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });

    const refreshed = await encode({
      token: { ...token, tenantId: user.tenantId, sessionVersion: user.sessionVersion },
      secret,
      salt: cookieName,
    });

    const response = NextResponse.json({ success: true, tenantId: user.tenantId });
    response.cookies.set(cookieName, refreshed, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao actualizar a sessão.' }, { status: 500 });
  }
}
