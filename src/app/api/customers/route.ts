import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';

export async function GET() {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const customers = await prisma.customer.findMany({ where: { tenantId } });
    return NextResponse.json(customers);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar clientes' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const { name, nif, address, email } = await req.json();
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId,
        name: name.trim(),
        nif,
        address,
        email,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 });
  }
}
