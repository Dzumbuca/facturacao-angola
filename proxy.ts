import { auth } from '@/lib/auth';
import { updateSession } from '@/utils/supabase/middleware';

export const proxy = auth(async (request) => updateSession(request));

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
