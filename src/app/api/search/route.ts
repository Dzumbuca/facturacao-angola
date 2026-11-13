import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type SearchItem = { type: 'invoice' | 'customer' | 'product' | 'employee'; label: string; sub: string; href: string };

export async function GET(request: Request) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ items: [] });
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ items: [] });

  const [invoices, customers, products, employees] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, OR: [{ number: { contains: q, mode: 'insensitive' } }, { customer: { is: { name: { contains: q, mode: 'insensitive' } } } }] },
      take: 6,
      orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, total: true, customer: { select: { name: true } } },
    }),
    prisma.customer.findMany({
      where: { tenantId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { nif: { contains: q, mode: 'insensitive' } }] },
      take: 6,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, nif: true },
    }),
    prisma.product.findMany({
      where: { tenantId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }] },
      take: 6,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, code: true, price: true },
    }),
    prisma.rhEmployee.findMany({
      where: { tenantId, OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { employeeNumber: { contains: q, mode: 'insensitive' } }, { bi: { contains: q, mode: 'insensitive' } }] },
      take: 6,
      orderBy: { firstName: 'asc' },
      select: { id: true, firstName: true, lastName: true, employeeNumber: true, position: { select: { title: true } } },
    }),
  ]);

  const money = (v: any) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(Number(v ?? 0));
  const items: SearchItem[] = [
    ...invoices.map((i: any) => ({ type: 'invoice' as const, label: i.number ?? i.id.slice(0, 8), sub: `${i.customer?.name ?? 'Cliente'} · ${money(i.total)}`, href: `/invoices/${i.id}` })),
    ...customers.map((c: any) => ({ type: 'customer' as const, label: c.name, sub: c.nif ? `NIF ${c.nif}` : 'Cliente', href: '/customers' })),
    ...products.map((p: any) => ({ type: 'product' as const, label: p.name, sub: p.code ? `Código ${p.code} · ${money(p.price)}` : money(p.price), href: '/produtos' })),
    ...employees.map((e: any) => ({ type: 'employee' as const, label: `${e.firstName} ${e.lastName}`, sub: e.position?.title ?? (e.employeeNumber ? `Nº ${e.employeeNumber}` : 'Funcionário'), href: '/rh/funcionarios' })),
  ].slice(0, 12);

  return NextResponse.json({ items });
}
