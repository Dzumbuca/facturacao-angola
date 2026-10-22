import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminPagePath, isProtectedPagePath } from '@/lib/route-access';

const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? '';

// Proxy rápido: valida SÓ o token JWT (sem base de dados, sem chamadas de rede).
// A validação completa (estado da conta, suspensões, papel) acontece nos layouts
// e nas rotas de API, onde corre em Node com acesso à base de dados.
export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const secure = request.nextUrl.protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https:';
  let authenticated = false;
  let tenantId: string | null = null;
  try {
    const token = SECRET
      ? await getToken({ req: request, secret: SECRET, salt: secure ? '__Secure-authjs.session-token' : 'authjs.session-token' })
      : null;
    authenticated = Boolean(token?.sub);
    tenantId = typeof token?.tenantId === 'string' ? token.tenantId : null;
  } catch {
    authenticated = false;
  }

  // Já autenticado nas páginas de entrada: enviar para a aplicação.
  if ((pathname === '/login' || pathname === '/register') && authenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Área de administração: só precisa de sessão aqui; o papel é validado
  // dentro de /admin (layouts e acções, com auditoria).
  if (isAdminPagePath(pathname)) {
    return authenticated ? NextResponse.next() : NextResponse.redirect(new URL('/login', request.url));
  }

  if (!isProtectedPagePath(pathname)) return NextResponse.next();

  // Visitante sem sessão no endereço principal: ver a página de venda.
  if (!authenticated) {
    if (pathname === '/') return NextResponse.redirect(new URL('/inicio', request.url));
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Sessão sem empresa (ex.: conta Google nova): onboarding.
  if (!tenantId) return NextResponse.redirect(new URL('/onboarding', request.url));

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
