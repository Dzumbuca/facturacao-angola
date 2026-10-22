import { NextRequest, NextResponse } from 'next/server';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { validateBankAccountInput } from '@/lib/bank-account-validation';

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Context) {
  const access = await getTenantWriteAccess('company_settings');
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const validation = validateBankAccountInput(await request.json().catch(() => null));
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const { id } = await params;
    const bankAccount = await prisma.$transaction(async (tx: any) => {
      const exists = await tx.companyBankAccount.findFirst({ where: { id, tenantId }, select: { id: true } });
      if (!exists) return null;
      if (validation.value.isPrimary) await tx.companyBankAccount.updateMany({ where: { tenantId, isActive: true, isPrimary: true, id: { not: id } }, data: { isPrimary: false } });
      await tx.companyBankAccount.update({ where: { id }, data: { ...validation.value, tenantId } });
      return tx.companyBankAccount.findFirst({ where: { id, tenantId } });
    }, { isolationLevel: 'Serializable' });
    if (!bankAccount) return NextResponse.json({ error: 'Conta bancária não encontrada.' }, { status: 404 });
    return NextResponse.json({ bankAccount });
  } catch (error) {
    console.error('Erro ao actualizar conta bancária:', error);
    return NextResponse.json({ error: 'Não foi possível actualizar a conta bancária.' }, { status: 500 });
  }
}
