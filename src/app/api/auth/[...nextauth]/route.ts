import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';
import { clientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';

// Barreira contra força-bruta em todas as acções POST do NextAuth
// (login com password, login Google, logout, etc.).
const MAX_AUTH_POSTS_PER_MINUTE = 30;

export const GET = handlers.GET;

export const POST: typeof handlers.POST = async (request: NextRequest) => {
  const limiter = rateLimit(`auth-post:${clientIp(request)}`, MAX_AUTH_POSTS_PER_MINUTE, 60_000);
  if (!limiter.ok) return tooManyRequestsResponse(limiter.retryAfterSeconds);
  return handlers.POST(request);
};
