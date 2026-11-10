import { NextResponse } from 'next/server';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { aiConfigured, aiProviderName, aiRateLimited, draftHrText } from '@/lib/rh-ai';
import { rhAudit } from '@/lib/rh-service';
import { runWithTenant } from '@/lib/tenant-db';

export async function POST(req: Request) {
  try {
    const access = await requireRhAccess('documents:write');
    const body = await req.json().catch(() => ({}));
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
    const context = typeof body.context === 'string' ? body.context.trim() : '';
    const type = typeof body.type === 'string' ? body.type.trim() : '';
    if (!instruction || instruction.length > 2000) return NextResponse.json({ error: 'Pedido inválido (até 2000 caracteres).' }, { status: 400 });
    if (context.length > 6000) return NextResponse.json({ error: 'Contexto demasiado longo.' }, { status: 400 });
    if (aiRateLimited(`${access.tenantId}:${access.userId}`)) {
      return NextResponse.json({ code: 'AI_RATE_LIMITED', error: 'Demasiados pedidos. Aguarde um minuto.' }, { status: 429 });
    }
    if (!aiConfigured()) {
      return NextResponse.json({ code: 'AI_NOT_CONFIGURED', error: 'Assistente IA não configurado. Defina GROQ_API_KEY (gratuito) ou OPENROUTER_API_KEY.' }, { status: 503 });
    }

    const result = await draftHrText({ instruction, context, type });
    await runWithTenant(access.tenantId, (tx) => rhAudit(tx, {
      tenantId: access.tenantId, actorUserId: access.userId, action: 'RH_AI_DRAFT', entity: 'RhDocument',
      metadata: { provider: result.provider, type },
    }), { userId: access.userId });

    return NextResponse.json({ text: result.text, provider: result.provider ?? aiProviderName() });
  } catch (error: any) {
    if (error?.code === 'AI_NOT_CONFIGURED' || error?.message === 'AI_NOT_CONFIGURED') {
      return NextResponse.json({ code: 'AI_NOT_CONFIGURED', error: 'Assistente IA não configurado.' }, { status: 503 });
    }
    if (typeof error?.message === 'string' && error.message.startsWith('AI_HTTP_429')) {
      return NextResponse.json({ code: 'AI_QUOTA', error: 'Quota gratuita temporariamente esgotada. Tente mais tarde.' }, { status: 429 });
    }
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
