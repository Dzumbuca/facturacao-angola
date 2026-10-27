import { NextRequest, NextResponse } from 'next/server';
import { nomeFicheiroPdf, validarDocumentoPdf } from '@/lib/business-docs';
import { gerarDocumentoPdf } from '@/lib/business-docs-pdf';
import { clientIp, rateLimit, tooManyRequestsResponse } from '@/lib/rate-limit';

// Endpoint público das ferramentas de documentos: sem base de dados, sem
// autenticação. Defende-se com validação rigorosa do payload e limite de tamanho.
const LIMITE_BYTES = 512 * 1024;

async function lerJsonLimitado(req: Request): Promise<unknown> {
  if (!req.body) throw new SyntaxError('Corpo ausente.');
  const reader = req.body.getReader();
  const partes: Uint8Array[] = [];
  let tamanho = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    tamanho += value.byteLength;
    if (tamanho > LIMITE_BYTES) {
      await reader.cancel();
      throw new RangeError('Documento demasiado grande.');
    }
    partes.push(value);
  }

  const bytes = new Uint8Array(tamanho);
  let offset = 0;
  for (const parte of partes) {
    bytes.set(parte, offset);
    offset += parte.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function POST(req: NextRequest) {
  const limite = rateLimit(`documento-pdf:${clientIp(req)}`, 10, 60_000);
  if (!limite.ok) return tooManyRequestsResponse(limite.retryAfterSeconds);

  const tamanho = Number(req.headers.get('content-length') ?? 0);
  if (tamanho > LIMITE_BYTES) {
    return NextResponse.json({ error: 'Documento demasiado grande.' }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = await lerJsonLimitado(req);
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: 'Documento demasiado grande.' }, { status: 413 });
    }
    return NextResponse.json({ error: 'Pedido inválido (JSON malformado).' }, { status: 400 });
  }

  const validado = validarDocumentoPdf(payload);
  if (!validado.ok) {
    return NextResponse.json({ error: validado.erro }, { status: 400 });
  }

  try {
    const pdf = await gerarDocumentoPdf(validado.documento);
    return new NextResponse(pdf as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nomeFicheiroPdf(validado.documento)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Erro ao gerar PDF de ferramenta:', error);
    return NextResponse.json({ error: 'Não foi possível gerar o PDF. Tente novamente.' }, { status: 500 });
  }
}
