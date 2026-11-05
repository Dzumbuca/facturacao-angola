import { NextResponse } from 'next/server';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';
import { clientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';
import { runAsSystem } from '@/lib/tenant-db';

const response = { success: true, message: 'Se existir uma conta associada, receberá instruções de recuperação.' };
export async function POST(request: Request) {
  const limiter = rateLimit(`forgot-password:${clientIp(request)}`, 5, 60_000);
  if (!limiter.ok) return tooManyRequestsResponse(limiter.retryAfterSeconds);
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json(response);
    if (!await allowEmailRequest('reset', email, 3)) return NextResponse.json(response);
    // RLS: server-controlled identity lookup by email (no user context). Narrow scope; response is intentionally generic.
    const user = await runAsSystem((tx) => (tx.user as any).findFirst({ where: { email, status: 'ACTIVE' }, select: { id: true, name: true, email: true } })) as { id: string; name: string | null; email: string } | null;
    if (user?.email) {
      const result = await sendEmailActionToken(user, 'PASSWORD_RESET');
      if (!result?.ok) console.error('[forgot-password] email send failed:', result?.code ?? 'unknown');
    }
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(response);
  }
}