import { NextResponse } from 'next/server';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhAccess, rhAccessResponse } from '@/lib/rh-access';
import { renderPdf } from '@/lib/rh-documents';

type Context = { params: Promise<{ id: string }> };

function money(value: unknown) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', minimumFractionDigits: 2 }).format(Number(value) || 0);
}

export async function GET(_req: Request, { params }: Context) {
  try {
    const access = await requireRhAccess();
    const { id } = await params;
    const slip = (await runWithTenant(access.tenantId, (tx) => tx.rhPayslip.findFirst({
      where: { id, tenantId: access.tenantId },
      include: {
        employee: { select: { firstName: true, lastName: true, employeeNumber: true } },
        run: { select: { period: true, status: true, ruleset: { select: { name: true } } } },
      },
    }), { userId: access.userId })) as any;
    if (!slip) return NextResponse.json({ error: 'Recibo não encontrado.' }, { status: 404 });

    const lines = [
      `Funcionário: ${slip.employee.firstName} ${slip.employee.lastName} (${slip.employee.employeeNumber})`,
      `Período: ${slip.run.period} · Regras: ${slip.run.ruleset?.name ?? '—'}`,
      '',
      `Salário-base: ${money(slip.baseSalary)}`,
      `Subsídios: ${money(slip.allowances)}`,
      `Horas extraordinárias: ${money(slip.overtime)}`,
      `Faltas (desconto): ${money(slip.absences)}`,
      `Total bruto: ${money(slip.gross)}`,
      `INSS: ${money(slip.inss)}`,
      `IRT: ${money(slip.irt)}`,
      `Outros descontos: ${money(slip.otherDeductions)}`,
      `Salário líquido: ${money(slip.net)}`,
      '',
      `Estado da folha: ${slip.run.status}`,
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
  } catch (error) {
    const { status, body } = rhAccessResponse(error);
    return NextResponse.json(body, { status });
  }
}
