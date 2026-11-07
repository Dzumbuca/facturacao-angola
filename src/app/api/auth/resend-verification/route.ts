import { NextResponse } from 'next/server';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';
import { clientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import { runAsSystem } from '@/lib/tenant-db';

const response = { success: true, message: 'Se existir uma conta pendente para esse endereço, receberá instruções.' };
export async function POST(request: Request) {
  const limiter = rateLimit(`resend-verification:${clientIp(request)}`, 5, 60_000);
  if (!limiter.ok) return tooManyRequestsResponse(limiter.retryAfterSeconds);
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json(response);
    if (!await allowEmailRequest('verify', email, 3)) return NextResponse.json(response);
    // RLS: server-controlled lookup by email for unverified active account. Generic response preserved.
    const user = await runAsSystem((tx) => (tx.user as any).findFirst({ where: { email, emailVerificationRequired: true, emailVerified: null, status: 'ACTIVE' }, select: { id: true, name: true, email: true } })) as { id: string; name: string | null; email: string } | null;
    if (user) await sendEmailActionToken(user, 'VERIFY_EMAIL');
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(response);
  }
}