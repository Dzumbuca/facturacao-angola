import { NextResponse } from 'next/server';
import { verifyEmailToken } from '@/lib/email-actions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token : '';
    const verified = await verifyEmailToken(token);
    return NextResponse.json({ success: verified, message: verified ? 'Email confirmado. Já pode iniciar sessão.' : 'Este link é inválido, expirou ou já foi utilizado.' }, { status: verified ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Não foi possível confirmar o email.' }, { status: 500 });
  }
}
