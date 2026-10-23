import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };

// Comprovativo de pagamento de plano — apenas para administradores da plataforma
export async function GET(_request: NextRequest, { params }: Context) {
  try {
    const session = await auth();
    const sessionUser = session?.user as any;
    if (!sessionUser?.id) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });

    const me = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: { platformRole: true } });
    if (!me || !['ADMIN', 'SUPERADMIN'].includes(me.platformRole)) {
      return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 });
    }

    const { id } = await params;
    const payment = await prisma.planPayment.findUnique({ where: { id }, select: { proofData: true, proofName: true } });
    if (!payment?.proofData) return NextResponse.json({ error: 'Comprovativo não encontrado.' }, { status: 404 });

    const [meta, b64] = payment.proofData.split(';base64,');
    const mime = meta.replace('data:', '') || 'application/octet-stream';
    const safeName = (payment.proofName ?? 'comprovativo').replace(/[^A-Za-z0-9._-]/g, '_');

    return new NextResponse(Buffer.from(b64, 'base64'), {
      headers: { 'content-type': mime, 'content-disposition': `inline; filename="${safeName}"` },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao carregar o comprovativo.' }, { status: 500 });
  }
}
