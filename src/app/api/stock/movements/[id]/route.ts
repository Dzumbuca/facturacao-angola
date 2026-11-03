import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';

type Context = { params: Promise<{ id: string }> };

// Apagar um movimento de stock — DESACTIVADO.
// Nao e possivel apagar movimentos de stock de forma segura porque nao ha
// forma de determinar o sentido original (entrada ou saida) de um ajuste,
// pelo que nao e possivel reverter o efeito no stock do produto sem quebrar
// a consistencia dos dados. A eliminacao permanecera desactivada ate que o
// schema seja alterado para registar o sinal da quantidade.
export async function DELETE(_request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { id } = await params;

  const movement = await prisma.stockMovement.findFirst({ where: { id, tenantId }, select: { id: true, type: true } });
  if (!movement) return NextResponse.json({ error: 'Movimento nao encontrado.' }, { status: 404 });

  return NextResponse.json(
    { error: 'Não é possível apagar movimentos de stock. Esta operação quebraria a consistência do inventário.' },
    { status: 403 },
  );
}
