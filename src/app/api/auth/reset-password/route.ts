import { NextResponse } from 'next/server';
import { resetPasswordWithToken } from '@/lib/email-actions';
import { clientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const limiter = rateLimit(`reset-password:${clientIp(request)}`, 10, 60_000);
  if (!limiter.ok) return tooManyRequestsResponse(limiter.retryAfterSeconds);
  try {
    const body = await request.json();
    const token = typeof body?.token === 'string' ? body.token : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (password.length < 8 || password.length > 128) return NextResponse.json({ success: false, message: 'A palavra-passe deve ter entre 8 e 128 caracteres.' }, { status: 400 });
    const success = await resetPasswordWithToken(token, password);
    return NextResponse.json({ success, message: success ? 'Palavra-passe alterada. Já pode iniciar sessão.' : 'Este link é inválido, expirou ou já foi utilizado.' }, { status: success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Não foi possível alterar a palavra-passe.' }, { status: 500 });
  }
}
