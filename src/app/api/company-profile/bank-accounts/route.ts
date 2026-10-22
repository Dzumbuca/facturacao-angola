import { NextRequest, NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { validateBankAccountInput } from '@/lib/bank-account-validation';

export async function GET() {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const bankAccounts = await prisma.companyBankAccount.findMany({ where: { tenantId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] });
  return NextResponse.json({ bankAccounts });
}

export async function POST(request: NextRequest) {
  const access = await getTenantWriteAccess('company_settings');
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const validation = validateBankAccountInput(await request.json().catch(() => null));
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const bankAccount = await prisma.$transaction(async (tx: any) => {
      if (validation.value.isPrimary) await tx.companyBankAccount.updateMany({ where: { tenantId, isActive: true, isPrimary: true }, data: { isPrimary: false } });
      return tx.companyBankAccount.create({ data: { tenantId, ...validation.value } });
    }, { isolationLevel: 'Serializable' });
    return NextResponse.json({ bankAccount }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar conta bancária:', error);
    return NextResponse.json({ error: 'Não foi possível guardar a conta bancária.' }, { status: 500 });
  }
}
