import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';
import { runAsSystem, PRIVILEGED_RLS } from '@/lib/tenant-db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true, message: 'Se o email for elegível, receberá um email de confirmação.' });
    }
    if (!await allowEmailRequest('resend-verification', email, 5)) {
      return NextResponse.json({ ok: true, message: 'Se o email for elegível, receberá um email de confirmação.' });
    }
    // RLS: server-controlled lookup for unverified active user.
    const user = await runAsSystem((tx) => (tx.user as any).findFirst({ where: { email, emailVerificationRequired: true, emailVerified: null, status: 'ACTIVE' }, select: { id: true, name: true, email: true } }), PRIVILEGED_RLS) as { id: string; name: string | null; email: string } | null;
    if (user) {
      const sent = await sendEmailActionToken(user, 'VERIFY_EMAIL');
      if (!sent.ok || !sent.accepted) return NextResponse.json({ ok: false, message: 'Não foi possível enviar o email de confirmação. Tente novamente.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: 'Se o email for elegível, receberá um email de confirmação.' });
  } catch {
    return NextResponse.json({ ok: false, message: 'Erro ao processar o pedido.' }, { status: 500 });
  }
}
