import Link from 'next/link';
import { notFound } from 'next/navigation';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { maskAccount } from '@/lib/rh-service';
import { hasRhPermission } from '@/lib/rh-policy';
import { OffboardDialog } from '@/components/rh/offboard-dialog';
import { DeductionsManager } from '@/components/rh/deductions-manager';

function money(value: unknown) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(Number(value) || 0);
}
function day(value: Date | string | null) {
  return value ? new Date(value).toLocaleDateString('pt-AO') : '—';
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVO: 'Activo', SUSPENSO: 'Suspenso', FERIAS: 'Férias', CESSAO: 'Cessão', INACTIVO: 'Inactivo',
};

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireRhPage();
  const { id } = await params;
  const data = await runWithTenant(access.tenantId, async (tx) => {
    const yearStart = new Date(Date.UTC(new Date().getFullYear(), 0, 1));
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [employee, contracts, salaryChanges, attendance, leaves, documents, offboarding, deductions] = await Promise.all([
      tx.rhEmployee.findFirst({
        where: { id, tenantId: access.tenantId },
        include: { department: { select: { name: true } }, position: { select: { title: true } }, shift: { select: { name: true, startTime: true, endTime: true } } },
      }),
      tx.rhContract.findMany({ where: { tenantId: access.tenantId, employeeId: id }, orderBy: { startDate: 'desc' } }),
      tx.rhSalaryChange.findMany({ where: { tenantId: access.tenantId, employeeId: id }, orderBy: { effectiveDate: 'desc' }, take: 20 }),
      tx.rhTimeEntry.findMany({ where: { tenantId: access.tenantId, employeeId: id, occurredAt: { gte: since } }, orderBy: { occurredAt: 'desc' }, take: 60 }),
      tx.rhLeaveRequest.findMany({ where: { tenantId: access.tenantId, employeeId: id, startDate: { gte: yearStart } }, orderBy: { startDate: 'desc' } }),
      tx.rhDocument.findMany({ where: { tenantId: access.tenantId, employeeId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
      tx.rhOffboarding.findUnique({ where: { employeeId: id } }),
      tx.rhEmployeeDeduction.findMany({ where: { tenantId: access.tenantId, employeeId: id }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] }),
    ]);
    return { employee, contracts, salaryChanges, attendance, leaves, documents, offboarding, deductions };
  }, { userId: access.userId }) as any;

  if (!data.employee) notFound();

  const canWrite = hasRhPermission(access.permissions, 'employees:write');
  const e = data.employee;
  const bankAccount = canWrite ? e.bankAccount : maskAccount(e.bankAccount);
  const bankIban = canWrite ? e.bankIban : maskAccount(e.bankIban);

  return (
    <div className="space-y-5">
      <Link href="/rh/funcionarios" className="text-xs font-semibold text-[#021f87]">← Funcionários</Link>

      {data.offboarding && (
        <div role="status" className="rounded-xl border border-[#f0dcb9] bg-[#fdf6e9] p-4 text-sm text-[#8a5a10]">
          <strong>Desligado.</strong> Motivo: {data.offboarding.reason} · Último dia: {day(data.offboarding.lastDay)}
          {data.offboarding.revokeAccess && ' · Acesso revogado'}
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-[#708195]">{e.employeeNumber} · {STATUS_LABEL[e.status] ?? e.status}</p>
          <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">{e.firstName} {e.lastName}</h1>
          <p className="mt-1 text-sm text-[#607286]">{e.position?.title ?? '—'} · {e.department?.name ?? '—'} · {e.shift ? `${e.shift.name} ${e.shift.startTime}–${e.shift.endTime}` : 'Sem horário'}</p>
        </div>
        {canWrite && !data.offboarding && (
          <OffboardDialog employeeId={id} employeeName={`${e.firstName} ${e.lastName}`} />
        )}
      </div>

      <section className="rounded-xl border border-[#e1e8f0] bg-white p-5">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Dados pessoais e profissionais</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-[#708195]">BI / NIF</dt><dd className="font-semibold">{[e.bi, e.nif].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt className="text-[#708195]">Contactos</dt><dd className="font-semibold">{[e.phone, e.email].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div><dt className="text-[#708195]">Morada</dt><dd className="font-semibold">{e.address ?? '—'}</dd></div>
          <div><dt className="text-[#708195]">Admissão</dt><dd className="font-semibold">{day(e.hireDate)}</dd></div>
          <div><dt className="text-[#708195]">Vínculo</dt><dd className="font-semibold">{e.contractType}</dd></div>
          <div><dt className="text-[#708195]">Salário-base</dt><dd className="font-semibold tabular-nums">{money(e.baseSalary)}</dd></div>
          <div><dt className="text-[#708195]">Banco</dt><dd className="font-semibold">{e.bankName ?? '—'} · {bankAccount ?? '—'}</dd></div>
          <div><dt className="text-[#708195]">IBAN {canWrite ? '' : '(mascarado)'}</dt><dd className="font-mono text-xs">{bankIban ?? '—'}</dd></div>
          <div><dt className="text-[#708195]">PIN do ponto</dt><dd className="font-semibold">{e.hasPin ? 'Definido' : 'Não definido'}</dd></div>
        </dl>
        {!canWrite && <p className="mt-3 text-xs text-[#8a5a00]">Dados bancários completos apenas para perfis com escrita de funcionários.</p>}
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Histórico salarial</h2>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[560px]">
            <thead><tr><th>Efectiva</th><th>Anterior</th><th>Nova</th><th>Motivo</th></tr></thead>
            <tbody>
              {data.salaryChanges.map((row: any) => (
                <tr key={row.id}>
                  <td data-mobile-primary className="tabular-nums">{day(row.effectiveDate)}</td>
                  <td className="tabular-nums">{money(row.oldSalary)}</td>
                  <td className="tabular-nums font-semibold">{money(row.newSalary)}</td>
                  <td>{row.reason ?? '—'}</td>
                </tr>
              ))}
              {data.salaryChanges.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-[#708195]">Sem alterações salariais registadas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Contratos</h2>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[640px]">
            <thead><tr><th>Tipo</th><th>Início</th><th>Fim</th><th>Salário</th><th>Estado</th></tr></thead>
            <tbody>
              {data.contracts.map((contract: any) => (
                <tr key={contract.id}>
                  <td data-mobile-primary className="font-semibold">{contract.type}</td>
                  <td className="tabular-nums">{day(contract.startDate)}</td>
                  <td className="tabular-nums">{day(contract.endDate)}</td>
                  <td className="tabular-nums">{money(contract.salary)}</td>
                  <td>{contract.status}</td>
                </tr>
              ))}
              {data.contracts.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#708195]">Sem contratos registados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <DeductionsManager
        employeeId={id}
        deductions={(data.deductions as any[]).map((d) => ({ ...d, amount: Number(d.amount) }))}
        canWrite={canWrite}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-[#e1e8f0] bg-white">
          <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Assiduidade (30 dias)</h2>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[360px]">
              <thead><tr><th>Data</th><th>Hora</th><th>Marcação</th></tr></thead>
              <tbody>
                {data.attendance.map((entry: any) => (
                  <tr key={entry.id}>
                    <td data-mobile-primary>{day(entry.occurredAt)}</td>
                    <td className="tabular-nums">{new Date(entry.occurredAt).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{entry.type}{entry.lateMinutes > 0 ? ` (+${entry.lateMinutes}m)` : ''}</td>
                  </tr>
                ))}
                {data.attendance.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#708195]">Sem marcações.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-[#e1e8f0] bg-white">
          <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Férias e licenças ({new Date().getFullYear()})</h2>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[360px]">
              <thead><tr><th>Período</th><th>Dias</th><th>Estado</th></tr></thead>
              <tbody>
                {data.leaves.map((leave: any) => (
                  <tr key={leave.id}>
                    <td data-mobile-primary className="tabular-nums">{day(leave.startDate)} → {day(leave.endDate)}</td>
                    <td className="tabular-nums">{leave.days}</td>
                    <td>{leave.status}</td>
                  </tr>
                ))}
                {data.leaves.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#708195]">Sem pedidos este ano.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Documentos</h2>
        <ul className="divide-y divide-[#eef2f6]">
          {data.documents.map((document: any) => (
            <li key={document.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#1c2d3f]">{document.title}</p>
                <p className="text-xs text-[#708195]">{document.status} · {day(document.createdAt)}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/api/rh/documents/${document.id}/pdf`} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#021f87]">PDF</a>
                <a href={`/api/rh/documents/${document.id}/docx`} className="inline-flex min-h-9 items-center rounded-lg border border-[#cdddeb] px-3 text-xs font-semibold text-[#52667a]">DOCX</a>
              </div>
            </li>
          ))}
          {data.documents.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#708195]">Sem documentos.</li>}
        </ul>
      </section>
    </div>
  );
}
