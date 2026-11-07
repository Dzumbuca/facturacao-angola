import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runWithRlsContext } from '@/lib/tenant-db';
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

    const result = await runWithRlsContext(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { tenantId: true } });
      if (!user) return { status: 404 as const, error: 'Utilizador não encontrado.' };
      if (user.tenantId) return { status: 200 as const, success: true };
      try {
        await tx.$transaction(async (inner: any) => {
          const tenant = await inner.tenant.create({ data: { name: tenantName, nif: nif || null } });
          // Guard condicional: só liga a empresa se o utilizador continuar sem empresa.
          const linked = await inner.user.updateMany({
            where: { id: userId, tenantId: null },
            data: { tenantId: tenant.id, tenantRole: 'COMPANY_ADMIN' },
          });
          if (linked.count === 0) throw new Error('ONBOARDING_ALREADY_DONE');
        });
      } catch (transactionError) {
        if ((transactionError as Error)?.message === 'ONBOARDING_ALREADY_DONE') return { status: 200 as const, success: true };
        throw transactionError;
      }
      return { status: 200 as const, success: true };
    }, { userId, tenantId: null, isAdmin: false });

    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erro ao criar espaço da empresa.');
    return NextResponse.json({ error: 'Não foi possível criar o espaço da empresa. Tente novamente.' }, { status: 500 });
  }
}