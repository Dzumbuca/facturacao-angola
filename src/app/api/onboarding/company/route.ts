import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Cria o espaço (tenant) da empresa para um utilizador autenticado que ainda
// não tenha empresa — fluxo de contas criadas com o Google.
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Sessão inválida. Inicie sessão novamente.' }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const tenantName = typeof body?.tenantName === 'string' ? body.tenantName.trim() : '';
    if (!tenantName || tenantName.length > 160) {
      return NextResponse.json({ error: 'Indique o nome da empresa (até 160 caracteres).' }, { status: 400 });
    }

    const user = await (prisma.user as any).findUnique({ where: { id: userId }, select: { tenantId: true } });
    if (!user) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (user.tenantId) {
      return NextResponse.json({ success: true });
    }

    await (prisma as any).$transaction(async (tx: any) => {
      const tenant = await tx.tenant.create({ data: { name: tenantName, nif: null } });
      await tx.user.update({
        where: { id: userId },
        data: { tenantId: tenant.id, tenantRole: 'COMPANY_ADMIN' },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao criar espaço da empresa.');
    return NextResponse.json({ error: 'Não foi possível criar o espaço da empresa. Tente novamente.' }, { status: 500 });
  }
}
