import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

function rewriteAuthUrl(request: NextRequest): NextRequest {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/api/auth-handler/', '/api/auth/');
  return new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
  }) as unknown as NextRequest;
}

export const GET = async (request: NextRequest) => {
  return handlers.GET(rewriteAuthUrl(request));
};

export const POST = async (request: NextRequest) => {
  return handlers.POST(rewriteAuthUrl(request));
};