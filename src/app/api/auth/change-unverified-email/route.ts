import { NextResponse } from 'next/server';
import { allowEmailRequest, sendEmailActionToken } from '@/lib/email-actions';
import { runAsSystem, PRIVILEGED_RLS } from '@/lib/tenant-db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: true, message: 'Se a conta existir, receberá um email de confirmação.' });
    }
    if (!await allowEmailRequest('change-unverified-email', email, 5)) {
      return NextResponse.json({ ok: true, message: 'Se a conta existir, receberá um email de confirmação.' });
    }
    // Requer utilizador existente com email ainda não verificado (RLS: User query em contexto admin-only via narrow executor).
    const changed = await runAsSystem((tx) => tx.$transaction(async (inner: any) => {
      const user = await inner.user.findUnique({ where: { email } });
      if (!user) return null;
      if (user.emailVerified || !user.emailVerificationRequired) return null;
      return user;
    }), PRIVILEGED_RLS) as { id: string; name: string | null; email: string } | null;
    if (changed) {
      const sent = await sendEmailActionToken(changed, 'VERIFY_EMAIL');
      if (!sent.ok || !sent.accepted) return NextResponse.json({ ok: false, message: 'Não foi possível enviar o email de confirmação. Tente novamente.' }, { status: 503 });
    }
    return NextResponse.json({ ok: true, message: 'Se a conta existir, receberá um email de confirmação.' });
  } catch {
    return NextResponse.json({ ok: false, message: 'Erro ao processar o pedido.' }, { status: 500 });
  }
}
