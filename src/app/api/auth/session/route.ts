import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(request: Request) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  } as never);

  if (!token) {
    return NextResponse.json({});
  }

  return NextResponse.json({
    user: {
      id: token.sub,
      name: token.name,
      email: token.email,
      tenantId: token.tenantId,
    },
    expires: token.exp ? new Date(token.exp * 1000).toISOString() : null,
  });
}