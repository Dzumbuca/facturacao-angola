import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ overdue: 0, drafts: 0, expiringContracts: 0 });
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const [overdue, drafts, expiringContracts] = await Promise.all([
    prisma.invoice.count({ where: { tenantId, status: 'OVERDUE' } }),
    prisma.invoiceDraft.count({ where: { tenantId, status: 'DRAFT' } }),
    prisma.rhContract.count({ where: { tenantId, endDate: { gte: now, lte: in30 }, status: { in: ['ACTIVO', 'RENOVADO'] } } }),
  ]);
  return NextResponse.json({ overdue, drafts, expiringContracts });
}
