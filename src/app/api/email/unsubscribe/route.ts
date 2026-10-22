import { NextResponse } from 'next/server';
import { unsubscribeFromMarketing } from '@/lib/email-actions';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let token = url.searchParams.get('token') || '';
    if (!token) {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) token = String((await request.json())?.token ?? '');
      else token = new URLSearchParams(await request.text()).get('token') || '';
    }
    const success = await unsubscribeFromMarketing(token);
    return NextResponse.json({ success, message: success ? 'A subscrição foi cancelada. Não enviaremos novas campanhas comerciais.' : 'O link de cancelamento é inválido.' }, { status: success ? 200 : 400 });
  } catch {
    return NextResponse.json({ success: false, message: 'Não foi possível processar o cancelamento.' }, { status: 500 });
  }
}
