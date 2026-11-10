import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getWmsAccess } from '@/lib/entitlements';

const SECURE_COOKIE = '__Secure-authjs.session-token';
const COOKIE = 'authjs.session-token';

// Gate do módulo WMS: bloqueia páginas e APIs de stock para tenants sem a
// aplicação "wms" activa. Corre em Node.js (Next 16 proxy).
export async function proxy(request: NextRequest) {
  const cookieName = request.cookies.has(SECURE_COOKIE) ? SECURE_COOKIE : COOKIE;
  if (!request.cookies.has(cookieName)) return NextResponse.next();

  let tenantId: string | null = null;
  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
      salt: cookieName,
      cookieName,
    } as never);
    tenantId = typeof token?.tenantId === 'string' ? token.tenantId : null;
  } catch {
    return NextResponse.next();
  }
  if (!tenantId) return NextResponse.next();

  const enabled = (await getWmsAccess(tenantId)).allowed;
  if (enabled) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ code: 'APP_NOT_ENABLED', app: 'wms' }, { status: 403 });
  }
  const url = new URL('/apps', request.url);
  url.searchParams.set('wms', 'bloqueado');
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/stock/:path*', '/warehouses/:path*', '/api/stock/:path*'],
};
