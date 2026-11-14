import Link from 'next/link';
import { notFound } from 'next/navigation';
import { runWithTenant } from '@/lib/tenant-db';
import { requireRhPage } from '@/lib/rh-page';
import { maskAccount } from '@/lib/rh-service';
import { hasRhPermission } from '@/lib/rh-policy';
import { OffboardDialog } from '@/components/rh/offboard-dialog';
import { DeductionsManager } from '@/components/rh/deductions-manager';
import { SignedImage } from '@/components/rh/signed-image';

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
      <Link href="/rh/funcionarios" className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--blue)]">← Funcionários</Link>
      <p className="text-[11px] text-[var(--text-muted)]">Funcionário · <span className="font-mono">{e.employeeNumber}</span></p>

      {data.offboarding && (
        <div role="status" className="rounded-xl border border-[#f0dcb9] bg-[#fdf6e9] p-4 text-sm text-[#8a5a10]">
          <strong>Desligado.</strong> Motivo: {data.offboarding.reason} · Último dia: {day(data.offboarding.lastDay)}
          {data.offboarding.revokeAccess && ' · Acesso revogado'}
        </div>
      )}

      <div className="rounded-2xl border border-[#e1e8f0] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <SignedImage
            path={e.photoUrl}
            alt={`${e.firstName} ${e.lastName}`}
            className="h-14 w-14 shrink-0 rounded-full border border-[#e1e8f0] object-cover ring-2 ring-[#e6ecf5] sm:h-16 sm:w-16"
            fallback={<div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#021f87] text-sm font-bold text-white ring-2 ring-[#e6ecf5] sm:h-16 sm:w-16 sm:text-lg">{e.firstName.charAt(0).toUpperCase()}{e.lastName.charAt(0).toUpperCase()}</div>}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-snug break-words text-[#1c2d3f] sm:text-xl">{e.firstName} {e.lastName}</h1>
            <p className="mt-0.5 text-[11px] leading-relaxed break-all text-[#708195]">{e.email ?? '—'}</p>
            <p className="mt-1 text-xs text-[#607286] break-words">{e.position?.title ?? '—'} · {e.department?.name ?? '—'}</p>
            <p className="mt-0.5 text-[10px] text-[#8a99ab]">{e.shift ? `${e.shift.name} ${e.shift.startTime}–${e.shift.endTime}` : 'Sem horário'}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-[10px] font-mono text-[#8a99ab]">{e.employeeNumber}</span>
            {(() => {
              const tone = e.status === 'ACTIVO' ? { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' } : e.status === 'SUSPENSO' ? { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' } : e.status === 'INACTIVO' ? { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' } : { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' };
              return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone.bg} ${tone.text}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{STATUS_LABEL[e.status] ?? e.status}</span>;
            })()}
          </div>
        </div>

        {canWrite && !data.offboarding && (
          <div className="mt-4 flex gap-2 border-t border-[#eef2f6] pt-4">
            <Link href="/rh/funcionarios" aria-label="Editar funcionário na lista" className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e1e8f0] bg-white px-3 text-xs font-semibold text-[#1c2d3f] transition hover:border-[#021f87] hover:text-[#021f87]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L10 16l-4 1 1-4 9.5-9.5z"/></svg>Editar</Link>
            <Link href="/rh/contratos" aria-label="Ver contratos do funcionário" className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#e1e8f0] bg-white px-3 text-xs font-semibold text-[#1c2d3f] transition hover:border-[#021f87] hover:text-[#021f87]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>Contrato</Link>
            <Link href="/rh/ferias" aria-label="Ver férias do funcionário" className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#021f87] px-3 text-xs font-semibold text-white transition hover:bg-[#011566]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width={14} height={14} aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>Férias</Link>
          </div>
        )}
        {data.offboarding && (
          <div className="mt-4 border-t border-[#eef2f6] pt-4">
            <OffboardDialog employeeId={id} employeeName={`${e.firstName} ${e.lastName}`} />
          </div>
        )}
      </div>

      <section className="rounded-xl border border-[#e1e8f0] bg-white p-5">
        <h2 className="text-sm font-bold text-[#1c2d3f]">Dados pessoais e profissionais</h2>
        <dl className="mt-3 divide-y divide-[#eef2f6] text-sm">
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">BI / NIF</dt><dd className="min-w-0 break-all text-right font-semibold text-[#1c2d3f]">{[e.bi, e.nif].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Contactos</dt><dd className="min-w-0 break-all text-right font-semibold text-[#1c2d3f]">{[e.phone, e.email].filter(Boolean).join(' · ') || '—'}</dd></div>
          <div className="flex items-start justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Morada</dt><dd className="min-w-0 break-words text-right font-semibold text-[#1c2d3f]">{e.address ?? '—'}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Cargo</dt><dd className="min-w-0 break-words text-right font-semibold text-[#1c2d3f]">{e.position?.title ?? '—'}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Departamento</dt><dd className="min-w-0 break-words text-right font-semibold text-[#1c2d3f]">{e.department?.name ?? '—'}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Admissão</dt><dd className="min-w-0 break-words text-right font-semibold tabular-nums text-[#1c2d3f]">{day(e.hireDate)}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Vínculo</dt><dd className="min-w-0 break-words text-right font-semibold text-[#1c2d3f]">{e.contractType}</dd></div>
          <div className="-mx-1 my-1 flex items-center justify-between gap-4 rounded-xl bg-[#f5f8fc] px-4 py-3"><dt className="shrink-0 text-[10px] font-bold uppercase tracking-[.12em] text-[#708195]">Salário-base</dt><dd className="min-w-0 break-words text-right text-base font-extrabold tabular-nums text-[#021f87]">{money(e.baseSalary)}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">Banco</dt><dd className="min-w-0 break-words text-right font-semibold text-[#1c2d3f]">{e.bankName ?? '—'} · {bankAccount ?? '—'}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">IBAN {canWrite ? '' : '(mascarado)'}</dt><dd className="min-w-0 break-all text-right font-mono text-[11px] text-[#1c2d3f]">{bankIban ?? '—'}</dd></div>
          <div className="flex items-center justify-between gap-4 py-2.5"><dt className="shrink-0 text-xs font-medium text-[#708195]">PIN do ponto</dt><dd className="min-w-0 break-words text-right font-semibold text-[#1c2d3f]">{e.hasPin ? 'Definido' : 'Não definido'}</dd></div>
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
