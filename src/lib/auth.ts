import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { isAdminPagePath, isProtectedPagePath } from '@/lib/route-access';

const nextAuth = NextAuth({
  adapter: PrismaAdapter(prisma),
  // A app corre sempre atrás do proxy da Vercel (e AUTH_TRUST_HOST=true está
  // definido no ambiente), por isso o host do pedido pode ser confiado.
  // O cálculo anterior devolvia false em produção sem NEXTAUTH_URL, o que
  // bloqueava o callback OAuth com "There is a problem with the server".
  trustHost: true,
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  providers: [
    // Google só fica activo quando as credenciais OAuth estão configuradas
    // (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET no ambiente de execução).
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          // Permite que uma conta já registada com email/palavra-passe entre
          // também com Google quando o email coincide (a Google valida a posse).
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

        // Registration stores emails in lowercase; normalize login input the same way
        // so capitalization or accidental surrounding spaces do not hide an account.
        const email = String(credentials.email).trim().toLowerCase();
        const user = await (prisma.user as any).findUnique({
          where: { email },
          select: { id: true, name: true, email: true, tenantId: true, password: true, status: true, emailVerified: true, emailVerificationRequired: true, sessionVersion: true },
        });
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
      if (isAdminPagePath(pathname)) return Boolean(auth?.user?.id);
      if (!isProtectedPagePath(pathname)) return true;
      // Sessão sem empresa (ex.: conta criada com Google): enviar para o
      // onboarding em vez de bloquear no login.
      if (!auth?.user?.id) return false;
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
          ? await (prisma.user as any).findUnique({ where: { id: token.sub }, select: { status: true, sessionVersion: true, emailVerified: true, emailVerificationRequired: true, tenantId: true } })
          : null;
        const valid = currentUser?.status === 'ACTIVE'
          && currentUser.sessionVersion === token.sessionVersion
          && !(currentUser.emailVerificationRequired && !currentUser.emailVerified);
        const dbTenantId = currentUser && typeof currentUser.tenantId === 'string' ? currentUser.tenantId : null;
        const tokenTenantId = typeof token.tenantId === 'string' ? token.tenantId : null;
        session.user.id = valid ? token.sub : '';
        // O valor da base de dados tem prioridade sobre o JWT: permite atribuir
        // uma empresa a um utilizador já autenticado (ex.: onboarding pós-Google).
        session.user.tenantId = valid ? (dbTenantId ?? tokenTenantId) : null;
      }
      return session;
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;
