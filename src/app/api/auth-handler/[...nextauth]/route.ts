import type { NextRequest } from 'next/server';
import { handlers } from '@/lib/auth';

export const GET = async (request: NextRequest) => {
  return handlers.GET(request);
};

export const POST = async (request: NextRequest) => {
  return handlers.POST(request);
};