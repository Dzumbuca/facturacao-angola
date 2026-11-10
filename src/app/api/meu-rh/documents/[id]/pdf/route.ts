import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { runWithTenant } from '@/lib/tenant-db';
import { renderPdf } from '@/lib/rh-documents';

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Context) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!(await isApplicationEnabled(tenantId, 'rh'))) return NextResponse.json({ error: 'Módulo inactivo.' }, { status: 403 });

  const { id } = await params;
  const document = await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return null;
    const employee = await tx.rhEmployee.findFirst({ where: { tenantId, email: { equals: user.email, mode: 'insensitive' } }, select: { id: true } });
    if (!employee) return null;
    return tx.rhDocument.findFirst({
      where: { id, tenantId, employeeId: employee.id, status: 'EMITIDO' },
      select: { title: true, content: true, status: true },
    });
  }, { userId });

  if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 });
  const pdf = await renderPdf(document);
  const safeName = document.title.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60) || 'documento';
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${safeName}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}
