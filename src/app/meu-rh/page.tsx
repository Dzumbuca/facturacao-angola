import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId, getSessionUserId } from '@/lib/session';
import { isApplicationEnabled } from '@/lib/platform-apps';
import { runWithTenant } from '@/lib/tenant-db';
import { MyJustifications } from '@/components/rh/my-justifications';
import { SelfAssessmentSection } from '@/components/rh/self-assessment-section';
import { Assistant } from '@/components/assistant/assistant';

function money(value: unknown) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(Number(value) || 0);
}
function day(value: Date) {
  return value.toLocaleDateString('pt-AO');
}

export default async function MyRhPage() {
  const session = await auth();
  const tenantId = getSessionTenantId(session);
  const userId = getSessionUserId(session);
  if (!tenantId || !userId) redirect('/login?callbackUrl=/meu-rh');
  if (!(await isApplicationEnabled(tenantId, 'rh'))) redirect('/apps?rh=bloqueado');

  const data = await runWithTenant(tenantId, async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
    if (!user?.email) return { user, employee: null };
    const employee = await tx.rhEmployee.findFirst({
      where: { tenantId, email: { equals: user.email, mode: 'insensitive' } },
      include: { department: { select: { name: true } }, position: { select: { title: true } }, shift: { select: { name: true, startTime: true, endTime: true } } },
    });
    if (!employee) return { user, employee: null };
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 86_400_000);
    const yearStart = new Date(Date.UTC(now.getFullYear(), 0, 1));
    const [attendance, payslips, leaves, documents, justifications, notifications, announcements, openCycles] = await Promise.all([
      tx.rhTimeEntry.findMany({ where: { tenantId, employeeId: employee.id, occurredAt: { gte: since } }, orderBy: { occurredAt: 'desc' }, take: 60 }),
      tx.rhPayslip.findMany({ where: { tenantId, employeeId: employee.id }, include: { run: { select: { period: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: 12 }),
      tx.rhLeaveRequest.findMany({ where: { tenantId, employeeId: employee.id, startDate: { gte: yearStart } }, orderBy: { startDate: 'desc' }, take: 20 }),
      tx.rhDocument.findMany({ where: { tenantId, employeeId: employee.id, status: 'EMITIDO' }, select: { id: true, title: true, issuedAt: true }, orderBy: { issuedAt: 'desc' }, take: 10 }),
      tx.rhAbsenceJustification.findMany({ where: { tenantId, employeeId: employee.id }, orderBy: { date: 'desc' }, take: 30 }),
      tx.rhNotification.findMany({ where: { tenantId, userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      tx.rhAnnouncement.findMany({ where: { tenantId, publishedAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: { publishedAt: 'desc' }, take: 10 }),
      tx.rhPerformanceCycle.findMany({ where: { tenantId, status: 'ABERTO' }, select: { id: true, name: true, startsAt: true, endsAt: true }, orderBy: { createdAt: 'desc' } }),
    ]);
    const selfAssessments = openCycles.length
      ? await tx.rhPerformanceReviewSelfAssessment.findMany({ where: { tenantId, cycleId: { in: openCycles.map((c: any) => c.id) }, employeeId: employee.id } })
      : [];
    return { user, employee, attendance, payslips, leaves, documents, justifications, notifications, announcements, openCycles, selfAssessments };
  }, { userId });

  const { employee, payslips = [], attendance = [], leaves = [], documents = [], justifications = [], notifications = [], announcements = [], openCycles = [], selfAssessments = [] } = data as any;
  const existingSelfAssessment = Object.fromEntries((selfAssessments as any[]).map((row) => [row.cycleId, { selfScore: row.selfScore, comments: row.comments }]));
  if (!employee) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-xl border border-[#e1e8f0] bg-white p-6">
          <h1 className="text-xl font-bold text-[#1c2d3f]">Meu RH</h1>
          <p className="mt-2 text-sm text-[#607286]">O seu utilizador ainda não está ligado a um funcionário. Peça ao RH para usar o mesmo email no cadastro.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 px-4 py-8">
      <div>
        <p className="text-sm text-[#708195]">Machine RH</p>
        <h1 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Olá, {employee.firstName}</h1>
        <p className="mt-1 text-sm text-[#607286]">{employee.position?.title ?? '—'} · {employee.department?.name ?? '—'} · {employee.employeeNumber}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[#e1e8f0] bg-white p-4"><p className="text-xs text-[#708195]">Horário</p><p className="mt-1 text-sm font-bold">{employee.shift ? `${employee.shift.name} ${employee.shift.startTime}–${employee.shift.endTime}` : '—'}</p></div>
        <div className="rounded-xl border border-[#e1e8f0] bg-white p-4"><p className="text-xs text-[#708195]">Salário-base</p><p className="mt-1 text-sm font-bold tabular-nums">{money(employee.baseSalary)}</p></div>
        <div className="rounded-xl border border-[#e1e8f0] bg-white p-4"><p className="text-xs text-[#708195]">Admissão</p><p className="mt-1 text-sm font-bold">{day(employee.hireDate)}</p></div>
        <div className="rounded-xl border border-[#e1e8f0] bg-white p-4"><p className="text-xs text-[#708195]">Estado</p><p className="mt-1 text-sm font-bold">{employee.status}</p></div>
      </div>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Recibos</h2>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[420px]"><thead><tr><th>Período</th><th>Líquido</th><th>Estado</th><th>Recibo</th></tr></thead>
            <tbody>{payslips.map((slip: any) => <tr key={slip.id}><td data-mobile-primary className="tabular-nums">{slip.run.period}</td><td className="tabular-nums">{money(slip.net)}</td><td>{slip.run.status}</td><td data-mobile-actions><a href={`/api/meu-rh/payslips/${slip.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#021f87]">PDF</a></td></tr>)}
              {payslips.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#708195]">Sem recibos.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Marcações (30 dias)</h2>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[420px]"><thead><tr><th>Data</th><th>Hora</th><th>Marcação</th></tr></thead>
            <tbody>{attendance.map((entry: any) => <tr key={entry.id}><td data-mobile-primary>{day(entry.occurredAt)}</td><td className="tabular-nums">{entry.occurredAt.toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}</td><td>{entry.type}</td></tr>)}
              {attendance.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#708195]">Sem marcações.</td></tr>}</tbody></table>
        </div>
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Férias e licenças</h2>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[420px]"><thead><tr><th>Período</th><th>Dias</th><th>Estado</th></tr></thead>
            <tbody>{leaves.map((leave: any) => <tr key={leave.id}><td data-mobile-primary className="tabular-nums">{day(leave.startDate)} → {day(leave.endDate)}</td><td className="tabular-nums">{leave.days}</td><td>{leave.status}</td></tr>)}
              {leaves.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-[#708195]">Sem pedidos.</td></tr>}</tbody></table>
</div>
      </section>

      <MyJustifications
        items={justifications.map((item: any) => ({ ...item, date: item.date.toISOString(), decisionNote: item.decisionNote ?? null }))}
        canSubmit
      />

      {announcements.length > 0 && (
        <section className="rounded-xl border border-[#f0dcb9] bg-[#fffdf5]">
          <h2 className="border-b border-[#f0e3b9] px-4 py-3 text-sm font-bold text-[#5a4500]">Comunicados internos</h2>
          <ul className="divide-y divide-[#f0e3b9]">
            {announcements.map((item: any) => (
              <li key={item.id} className="px-4 py-3">
                <p className="text-sm font-semibold text-[#3a2f00]">{item.title}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-[#5a4500]">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openCycles.length > 0 && (
        <SelfAssessmentSection
          cycles={openCycles.map((cycle: any) => ({ ...cycle, startsAt: cycle.startsAt.toISOString(), endsAt: cycle.endsAt ? cycle.endsAt.toISOString() : null }))}
          existing={existingSelfAssessment}
        />
      )}

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Notificações</h2>
        <ul className="divide-y divide-[#eef2f6]">
          {notifications.map((item: any) => (
            <li key={item.id} className={`px-4 py-3 ${item.readAt ? '' : 'bg-[#f7faff]'}`}>
              <p className="text-sm font-semibold text-[#1c2d3f]">{item.title}</p>
              <p className="mt-0.5 text-xs text-[#52667a]">{item.body}</p>
              <p className="mt-1 text-[11px] text-[#8a99ab]">{new Date(item.createdAt).toLocaleString('pt-AO')} · {item.readAt ? 'lida' : 'não lida'}</p>
            </li>
          ))}
          {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#708195]">Sem notificações.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-[#e1e8f0] bg-white">
        <h2 className="border-b border-[#eef2f6] px-4 py-3 text-sm font-bold text-[#1c2d3f]">Documentos emitidos</h2>
        <ul className="divide-y divide-[#eef2f6]">
          {documents.map((document: any) => (
            <li key={document.id} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-medium text-[#1c2d3f]">{document.title}</span>
              <a href={`/api/meu-rh/documents/${document.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#021f87]">PDF</a>
            </li>
          ))}
          {documents.length === 0 && <li className="px-4 py-8 text-center text-sm text-[#708195]">Sem documentos.</li>}
        </ul>
      </section>
          <Assistant />
    </main>
  );
}
