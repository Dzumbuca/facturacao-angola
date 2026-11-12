import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { runWithTenant } from '@/lib/tenant-db';
import { renderPdf } from '@/lib/rh-documents';

type Context = { params: Promise<{ id: string }> };

function money(value: unknown) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', minimumFractionDigits: 2 }).format(Number(value) || 0);
}

export async function GET(_req: Request, { params }: Context) {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
  if (!(await isApplicationEnabled(tenantId, 'rh'))) return NextResponse.json({ error: 'Módulo inactivo.' }, { status: 403 });

  const { id } = await params;
  const slip = (await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user?.email) return null;
    const employee = await tx.rhEmployee.findFirst({ where: { tenantId, email: { equals: user.email, mode: 'insensitive' } }, select: { id: true } });
    if (!employee) return null;
    return tx.rhPayslip.findFirst({
      where: { id, tenantId, employeeId: employee.id },
      include: { run: { select: { period: true, status: true } } },
    });
  }, { userId })) as any;

  if (!slip) return NextResponse.json({ error: 'Recibo não encontrado.' }, { status: 404 });
  const lines = [
    `Funcionário: ${slip.employee.firstName} ${slip.employee.lastName} (${slip.employee.employeeNumber})`,
    `Período: ${slip.run.period}`,
    '',
    `Salário-base: ${money(slip.baseSalary)}`,
    `Subsídios: ${money(slip.allowances)}`,
    `Total bruto: ${money(slip.gross)}`,
    `INSS: ${money(slip.inss)}`,
    `IRT: ${money(slip.irt)}`,
    `Outros descontos: ${money(slip.otherDeductions)}`,
    `Salário líquido: ${money(slip.net)}`,
    '',
    `Estado: ${slip.run.status}`,
  ];
  const pdf = await renderPdf({
    title: `Recibo de vencimento — ${slip.run.period}`,
    content: lines.join('\n'),
    status: slip.run.status === 'PAGO' ? 'EMITIDO' : 'RASCUNHO',
    watermarkNote: 'Recibo ainda não pago — folha em processamento.',
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="recibo-${slip.run.period}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}
