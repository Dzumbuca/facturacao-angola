import Link from 'next/link';
import { notFound } from 'next/navigation';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';

function money(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(Number(value) || 0);
}

export default async function PayrollRunPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireRhPage();
  const { id } = await params;
  const run = await runWithTenant(access.tenantId, (tx) => tx.rhPayrollRun.findFirst({
    where: { id, tenantId: access.tenantId },
    include: {
      ruleset: { select: { name: true } },
      payslips: { include: { employee: { select: { firstName: true, lastName: true, employeeNumber: true } } }, orderBy: { employeeId: 'asc' } },
    },
  }), { userId: access.userId }) as any;
  if (!run) notFound();

  return (
    <div className="space-y-5">
      <Link href="/rh/processamento-salarial" className="text-xs font-semibold text-[#021f87]">← Processamento salarial</Link>
      <div>
        <p className="text-sm text-[#708195]">Folha de salários</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">{run.period}</h1>
        <p className="mt-1 text-sm text-[#607286]">Regras: {run.ruleset?.name ?? '—'} · Estado: {run.status}</p>
      <a href={`/api/rh/payroll/runs/${id}/export`} className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] bg-white px-3 text-xs font-semibold text-[#021f87]">Exportar CSV</a>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Bruto', run.totalGross], ['INSS', run.totalInss], ['IRT', run.totalIrt], ['Líquido', run.totalNet],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-[#e1e8f0] bg-white p-4">
            <p className="text-xs text-[#708195]">{label}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{money(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#e1e8f0] bg-white">
        <table className="data-table min-w-[760px]">
          <thead><tr><th>Funcionário</th><th>Base</th><th>Subsídios</th><th>Bruto</th><th>INSS</th><th>IRT</th><th>Líquido</th><th>Recibo</th></tr></thead>
          <tbody>
            {run.payslips.map((slip: any) => (
              <tr key={slip.id}>
                <td data-mobile-primary><span className="block font-semibold text-[#1c2d3f]">{slip.employee.firstName} {slip.employee.lastName}</span><span className="block text-xs text-[#708195]">{slip.employee.employeeNumber}</span></td>
                <td className="tabular-nums">{money(Number(slip.baseSalary))}</td>
                <td className="tabular-nums">{money(Number(slip.allowances))}</td>
                <td className="tabular-nums">{money(Number(slip.gross))}</td>
                <td className="tabular-nums">{money(Number(slip.inss))}</td>
                <td className="tabular-nums">{money(Number(slip.irt))}</td>
                <td className="tabular-nums font-semibold">{money(Number(slip.net))}</td>
                <td data-mobile-actions><a href={`/api/rh/payroll/payslips/${slip.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">PDF</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
