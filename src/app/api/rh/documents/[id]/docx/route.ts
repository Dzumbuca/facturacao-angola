import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { renderDocx } from '@/lib/rh-docx';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const document = (await runWithTenant(access.tenantId, (tx) => tx.rhDocument.findFirst({
      where: { id, tenantId: access.tenantId },
      select: { title: true, content: true, status: true },
    }), { userId: access.userId })) as { title: string; content: string; status: string } | null;
    if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });

    const file = await renderDocx(document);
    const safeName = document.title.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'documento';
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}.docx"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
