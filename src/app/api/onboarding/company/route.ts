import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isValidNif, normalizeNif } from '@/lib/nif';

// Cria o espaço (tenant) da empresa para um utilizador autenticado que ainda
// não tenha empresa — fluxo de contas criadas com o Google. O NIF é opcional
// e pode ser preenchido depois no perfil da empresa. A ligação utilizador ↔
// empresa é condicional (tenantId ainda nulo) para impedir, mesmo em pedidos
// simultâneos, que o mesmo utilizador crie duas empresas.
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
    const nif = normalizeNif(body?.nif);
    if (nif && !isValidNif(nif)) {
      return NextResponse.json({ error: 'O NIF indicado tem um formato inválido. Verifique ou deixe vazio para preencher depois.' }, { status: 400 });
    }

    const user = await (prisma.user as any).findUnique({ where: { id: userId }, select: { tenantId: true } });
    if (!user) {
      return NextResponse.json({ error: 'Utilizador não encontrado.' }, { status: 404 });
    }
    if (user.tenantId) {
      return NextResponse.json({ success: true });
    }

    try {
      await (prisma as any).$transaction(async (tx: any) => {
        const tenant = await tx.tenant.create({ data: { name: tenantName, nif: nif || null } });
        // Guard condicional: só liga a empresa se o utilizador continuar sem
        // empresa. Se outro pedido ganhou a corrida, o throw desfaz (rollback)
        // a empresa criada aqui e a resposta é idempotente.
        const linked = await tx.user.updateMany({
          where: { id: userId, tenantId: null },
          data: { tenantId: tenant.id, tenantRole: 'COMPANY_ADMIN' },
        });
        if (linked.count === 0) throw new Error('ONBOARDING_ALREADY_DONE');
      });
    } catch (transactionError) {
      if ((transactionError as Error)?.message === 'ONBOARDING_ALREADY_DONE') {
        return NextResponse.json({ success: true });
      }
      throw transactionError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao criar espaço da empresa.');
    return NextResponse.json({ error: 'Não foi possível criar o espaço da empresa. Tente novamente.' }, { status: 500 });
  }
}
