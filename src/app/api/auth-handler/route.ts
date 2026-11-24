import { NextRequest, NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createRlsPrismaAdapter } from '@/lib/auth-prisma-adapter';
import { isAdminPagePath, isProtectedPagePath } from '@/lib/route-access';
import { runWithRlsContext } from '@/lib/tenant-db';

const nextAuth = NextAuth({
  adapter: createRlsPrismaAdapter(prisma as any),
  trustHost: true,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          allowDangerousEmailAccountLinking: true,
        })]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const user = await runWithRlsContext((tx) => (tx.user as any).findUnique({
          where: { email },
          select: { id: true, name: true, email: true, tenantId: true, password: true, status: true, emailVerified: true, emailVerificationRequired: true, sessionVersion: true },
        }), { userId: null, tenantId: null, isAdmin: true }) as any;
        if (!user?.password || user.status !== 'ACTIVE' || (user.emailVerificationRequired && !user.emailVerified)) return null;
        const isValidPassword = await bcrypt.compare(credentials.password as string, user.password);
        if (!isValidPassword) return null;
        return { id: user.id, name: user.name, email: user.email, tenantId: user.tenantId, sessionVersion: user.sessionVersion };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }: any) {
      const pathname = request.nextUrl.pathname;
      if ((pathname === '/login' || pathname === '/register') && auth?.user?.id) {
        return NextResponse.redirect(new URL('/', request.url));
      }
      if (isAdminPagePath(pathname)) return Boolean(auth?.user?.id);
      if (!isProtectedPagePath(pathname)) return true;
      if (!auth?.user?.id) {
        if (pathname === '/') return NextResponse.redirect(new URL('/inicio', request.url));
        return false;
      }
      if (!auth?.user?.tenantId) return NextResponse.redirect(new URL('/onboarding', request.url));
      return true;
    },
    async jwt({ token, user }: any) {
      if (user) {
        token.tenantId = user.tenantId ?? null;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        const currentUser = typeof token.sub === 'string'
          ? await runWithRlsContext((tx) => (tx.user as any).findUnique({ where: { id: token.sub }, select: { status: true, sessionVersion: true, emailVerified: true, emailVerificationRequired: true, tenantId: true } }), { userId: token.sub, tenantId: null, isAdmin: false }) as any
          : null;
        const valid = currentUser?.status === 'ACTIVE'
          && currentUser.sessionVersion === token.sessionVersion
          && !(currentUser.emailVerificationRequired && !currentUser.emailVerified);
        const dbTenantId = currentUser && typeof currentUser.tenantId === 'string' ? currentUser.tenantId : null;
        const tokenTenantId = typeof token.tenantId === 'string' ? token.tenantId : null;
        session.user.id = valid ? token.sub : '';
        session.user.tenantId = valid ? (dbTenantId ?? tokenTenantId) : null;
      }
      return session;
    },
  },
});

const { handlers } = nextAuth;

export const GET = handlers.GET;
export const POST = handlers.POST;