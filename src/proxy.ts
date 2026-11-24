import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getWmsAccess } from '@/lib/entitlements';
import { isApplicationEnabled } from '@/lib/platform-apps';

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

  if (request.nextUrl.pathname.startsWith('/rh') || request.nextUrl.pathname.startsWith('/api/rh')) {
    if (await isApplicationEnabled(tenantId, 'rh')) return NextResponse.next();
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ code: 'APP_NOT_ENABLED', app: 'rh' }, { status: 403 });
    }
    const rhUrl = new URL('/apps', request.url);
    rhUrl.searchParams.set('rh', 'bloqueado');
    return NextResponse.redirect(rhUrl);
  }

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
  matcher: ['/stock/:path*', '/warehouses/:path*', '/api/stock/:path*', '/rh/:path*', '/api/rh/:path*'],
};
