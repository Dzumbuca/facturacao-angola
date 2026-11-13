import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { assistantRateLimited, chatAssistant } from '@/lib/assistant';

export const runtime = 'nodejs';

const MAX_MESSAGES = 12;

export async function POST(req: Request) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) {
    return NextResponse.json({ code: 'UNAUTHENTICATED', error: 'Sessão inválida.' }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const path = typeof body?.path === 'string' ? body.path.slice(0, 200) : '/';
  const messages = Array.isArray(body?.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (assistantRateLimited(`${tenantId}:${userId}`)) {
    return NextResponse.json({ code: 'AI_RATE_LIMITED', error: 'Demasiados pedidos. Aguarde um minuto.' }, { status: 429 });
  }
  const reply = await chatAssistant({ path, messages });
  return NextResponse.json(reply);
}
