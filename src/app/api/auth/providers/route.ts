import { NextResponse } from 'next/server';

export async function GET() {
  const providers = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push({ id: 'google', name: 'Google' });
  }
  providers.push({ id: 'credentials', name: 'Email e senha' });
  return NextResponse.json(providers);
}