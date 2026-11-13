import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionUserId } from '@/lib/session';
import { assistantRateLimited } from '@/lib/assistant';
import { renderAssistantDocx } from '@/lib/documents/assistant-docx';
import { renderAssistantPdf } from '@/lib/documents/assistant-pdf';
import { documentFileName, type DocumentIdentity } from '@/lib/document-blocks';

export const runtime = 'nodejs';
const MAX_BODY = 15000;

function parseIdentity(raw: unknown): DocumentIdentity | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const value = raw as Record<string, unknown>;
  return {
    name: typeof value.name === 'string' ? value.name.slice(0, 200) : undefined,
    legalName: typeof value.legalName === 'string' ? value.legalName.slice(0, 200) : undefined,
    nif: typeof value.nif === 'string' ? value.nif.slice(0, 40) : undefined,
    address: typeof value.address === 'string' ? value.address.slice(0, 300) : undefined,
    phone: typeof value.phone === 'string' ? value.phone.slice(0, 60) : undefined,
    email: typeof value.email === 'string' ? value.email.slice(0, 120) : undefined,
    website: typeof value.website === 'string' ? value.website.slice(0, 200) : undefined,
    logoDataUrl: typeof value.logoDataUrl === 'string' && value.logoDataUrl.startsWith('data:image/') ? value.logoDataUrl.slice(0, 400_000) : null,
    includeLogo: value.includeLogo === true,
  };
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = getSessionUserId(session);
  if (!userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const text = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_BODY) : '';
  const format = body?.format === 'docx' ? 'docx' : 'pdf';
  const identity = parseIdentity(body?.identity);
  if (!title || !text) return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 });
  if (assistantRateLimited(`doc:${userId}`, 10, 60_000)) {
    return NextResponse.json({ code: 'AI_RATE_LIMITED', error: 'Demasiados pedidos. Aguarde um minuto.' }, { status: 429 });
  }

  try {
    if (format === 'docx') {
      const docx = await renderAssistantDocx({ title, body: text, identity });
      return new NextResponse(new Uint8Array(docx), {
        status: 200,
        headers: {
          'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'content-disposition': `attachment; filename="${documentFileName(title, 'docx')}"`,
          'cache-control': 'no-store',
        },
      });
    }
    const pdf = await renderAssistantPdf({ title, body: text, identity });
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${documentFileName(title, 'pdf')}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('assistant document', error);
    return NextResponse.json({ error: 'Não foi possível gerar o documento.' }, { status: 500 });
  }
}
