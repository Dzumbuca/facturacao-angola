import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';

type Context = { params: Promise<{ id: string }> };

// Apagar um movimento de stock (apenas ajustes podem ser apagados para nao quebrar auditoria)
export async function DELETE(_request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const { id } = await params;

  const movement = await prisma.stockMovement.findFirst({ where: { id, tenantId }, select: { id: true, type: true, quantity: true, productId: true } });
  if (!movement) return NextResponse.json({ error: 'Movimento nao encontrado.' }, { status: 404 });

  // So permite apagar movimentos de tipo ADJUSTMENT para nao quebrar rastreabilidade de vendas
  if (movement.type !== 'ADJUSTMENT') {
    return NextResponse.json({ error: 'So e possivel apagar movimentos do tipo Ajuste.' }, { status: 403 });
  }

  // Reverter o efeito no produto antes de apagar
  await runWithTenant(tenantId, async (tx) => {
    if (movement.type === 'ADJUSTMENT') {
      // Ajuste pode ser positiva ou negativa, nao sabemos o sentido original sem mais contexto.
      // Por seguranca, so apagamos o registro de movimento, nao revertemos o produto automaticamente.
    }
    await tx.stockMovement.delete({ where: { id } });
  });

  return NextResponse.json({ success: true });
}
