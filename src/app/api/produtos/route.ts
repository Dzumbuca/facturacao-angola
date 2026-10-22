import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';

// Listar produtos isolados por tenant
export async function GET(req: Request) {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const produtos = await prisma.product.findMany({ where: { tenantId } });

    return NextResponse.json(produtos);
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar produtos' }, { status: 500 });
  }
}

// Criar produto isolado por tenant
export async function POST(req: Request) {
  try {
    const access = await getTenantWriteAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;
    const { codigo, nome, preco, stock, categoria } = await req.json();
    if (typeof nome !== 'string' || !nome.trim() || !Number.isFinite(Number(preco)) || Number(preco) < 0) {
      return NextResponse.json({ error: 'Nome e preço válidos são obrigatórios' }, { status: 400 });
    }

    const produto = await prisma.product.create({
      data: {
        tenantId,
        name: nome.trim(),
        codigo: codigo || 'SEM-COD',
        price: Number(preco),
        stock: Number.isInteger(Number(stock)) && Number(stock) >= 0 ? Number(stock) : 0,
        categoria: categoria || 'GERAL',
      },
    });

    return NextResponse.json({
      success: true,
      id: produto.id,
      produto: { ...produto, price: Number(produto.price) },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar produto' }, { status: 500 });
  }
}
