import { NextResponse } from 'next/server';
import PDFDocument from 'pdfkit';
import { auth } from '@/lib/auth';
import { getSessionUserId } from '@/lib/session';
import { assistantRateLimited } from '@/lib/assistant';

export const runtime = 'nodejs';

const MAX_BODY = 15000;

function wrapText(doc: InstanceType<typeof PDFDocument>, value: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n/g, '\n').split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue; }
    const words = paragraph.match(/\S+\s*/g) ?? [paragraph];
    let line = '';
    for (const word of words) {
      const next = line + word;
      if (doc.widthOfString(next.trimEnd()) > width && line) {
        lines.push(line.trimEnd());
        line = word;
      } else line = next;
    }
    if (line) lines.push(line.trimEnd());
  }
  return lines;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = getSessionUserId(session);
  if (!userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : '';
  const text = typeof body?.body === 'string' ? body.body.trim().slice(0, MAX_BODY) : '';
  if (!title || !text) return NextResponse.json({ error: 'Documento inválido.' }, { status: 400 });
  if (assistantRateLimited(`doc:${userId}`, 10, 60_000)) {
    return NextResponse.json({ code: 'AI_RATE_LIMITED', error: 'Demasiados pedidos. Aguarde um minuto.' }, { status: 429 });
  }

  const doc = new PDFDocument({ size: 'A4', margins: { top: 48, bottom: 56, left: 48, right: 48 } });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.rect(0, 0, 595.28, 12).fill('#021f87');
  doc.fillColor('#021f87').font('Helvetica-Bold').fontSize(16).text(title, 48, 52, { width: 499 });
  doc.fillColor('#647184').font('Helvetica').fontSize(8).text('Machine IA · Machine Facturas', 48, doc.y + 4);
  doc.moveDown(1.2);
  doc.fillColor('#171c27').font('Helvetica').fontSize(11);
  for (const line of wrapText(doc, text, 499)) {
    if (!line) { doc.moveDown(0.4); continue; }
    if (/^\s*#{1,3}\s+/.test(line)) {
      doc.fillColor('#021f87').font('Helvetica-Bold').fontSize(13).text(line.replace(/^\s*#{1,3}\s*/, ''));
      doc.fillColor('#171c27').font('Helvetica').fontSize(11);
      continue;
    }
    doc.text(line);
  }
  doc.moveDown(1);
  doc.fillColor('#647184').fontSize(8).text(`Gerado em ${new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Luanda' }).format(new Date())} · machinefaturas.shop`);
  doc.end();
  const pdf = await done;
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${title.replace(/[^\w\- ]/g, '').slice(0, 60) || 'documento'}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
