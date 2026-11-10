import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { renderPdf } from '@/lib/rh-documents';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const document = (await runWithTenant(access.tenantId, (tx) => tx.rhDocument.findFirst({
      where: { id, tenantId: access.tenantId },
      select: { id: true, title: true, content: true, status: true },
    }), { userId: access.userId })) as { id: string; title: string; content: string; status: string } | null;
    if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });

    const pdf = await renderPdf({ title: document.title, content: document.content, status: document.status });
    const safeName = document.title.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'documento';
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
