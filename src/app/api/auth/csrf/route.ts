import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(request: Request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  } as never);

  return NextResponse.json({ csrfToken: token?.csrfToken ?? '' });
}