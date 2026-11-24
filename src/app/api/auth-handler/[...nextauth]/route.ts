import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

async function cloneRequestWithRewrittenPath(request: NextRequest): Promise<NextRequest> {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/api/auth-handler/', '/api/auth/');
  let body: BodyInit | null = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }
  const newRequest = new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body,
  }) as unknown as NextRequest;
  return newRequest;
}

export const GET = async (request: NextRequest) => {
  return handlers.GET(await cloneRequestWithRewrittenPath(request));
};

export const POST = async (request: NextRequest) => {
  return handlers.POST(await cloneRequestWithRewrittenPath(request));
};