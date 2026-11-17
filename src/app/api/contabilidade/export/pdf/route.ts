import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { computeStatements } from '@/lib/accounting-statements';
import { generateAccountingStatementPdf } from '@/lib/accounting-statement-pdf';

export async function GET(req: NextRequest) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const year = sp.get('year') ? Number(sp.get('year')) : new Date().getUTCFullYear();

  const tenant = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } });
  const tenantName = tenant?.name ?? 'Empresa';
  const nif: string | null = null;

  const totals = await computeStatements(tenantId, year);
  const { assets, liabilities, equity, revenue, expenses, result, balanceOK } = totals;

  const pdf = await generateAccountingStatementPdf({
    companyName: tenantName,
    companyNif: nif,
    exerciseYear: year,
    issuedAt: new Date(),
    assets, liabilities, equity, revenue, expenses, result, balanceOK,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="balanco-dre-${year}-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
