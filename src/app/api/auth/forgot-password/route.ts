import { NextResponse } from 'next/server';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';
import { runAsSystem, PRIVILEGED_RLS } from '@/lib/tenant-db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true, message: 'Se existir conta associada, receberá instruções no email.' });
    }
    if (!await allowEmailRequest('forgot-password', email, 5)) {
      return NextResponse.json({ ok: true, message: 'Se existir conta associada, receberá instruções no email.' });
    }
    // RLS: User table restricted; password reset lookup is server-controlled bootstrap action.
    const user = await runAsSystem((tx) => (tx.user as any).findFirst({ where: { email, status: 'ACTIVE' }, select: { id: true, name: true, email: true } }), PRIVILEGED_RLS) as { id: string; name: string | null; email: string } | null;
    if (user) {
      const sent = await sendEmailActionToken(user, 'PASSWORD_RESET');
      if (!sent.ok || !sent.accepted) return NextResponse.json({ ok: false, message: 'Não foi possível enviar o email de recuperação. Tente novamente.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: 'Se existir conta associada, receberá instruções no email.' });
  } catch {
    return NextResponse.json({ ok: false, message: 'Erro ao processar o pedido.' }, { status: 500 });
  }
}
