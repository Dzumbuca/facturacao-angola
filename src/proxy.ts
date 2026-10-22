import { auth } from '@/lib/auth';
import { updateSession } from '@/utils/supabase/middleware';

// Proxy (middleware) do Next 16: default export conforme a convenção do
// next/dist/docs (03-file-conventions/proxy.md). O `auth` fornece o pedido
// autenticado e o callback `authorized` decide os redirects.
export default auth(async function proxy(request) {
  return updateSession(request);
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
