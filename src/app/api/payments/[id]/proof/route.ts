import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { id } = await params;

  const payment = await prisma.payment.findFirst({
    where: { id, tenantId },
    select: { proofName: true, proofData: true },
  });
  if (!payment?.proofData) return NextResponse.json({ error: 'Comprovativo não encontrado.' }, { status: 404 });

  const [meta, b64] = payment.proofData.split(';base64,');
  const mime = meta.replace('data:', '') || 'application/octet-stream';
  const safeName = (payment.proofName ?? 'comprovativo').replace(/[^A-Za-z0-9._-]/g, '_');

  return new NextResponse(Buffer.from(b64, 'base64'), {
    headers: {
      'content-type': mime,
      'content-disposition': `inline; filename="${safeName}"`,
      'cache-control': 'private, no-store',
    },
  });
}
