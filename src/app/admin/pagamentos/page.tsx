import { getAdminPlanPayments } from '@/lib/admin-data';
import { AdminStatusBadge, AdminErrorState } from '@/components/admin-ui';
import { PlanPaymentReviewForm } from '@/components/plan-payment-review';

type Params = Promise<Record<string, string | string[] | undefined>>;

const planFromAmount = (amount: number, months: number) => (months > 0 && Math.round(amount / months) === 19900 ? 'Pro' : 'Básico');

export default async function AdminPagamentosPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const status = typeof params.status === 'string' && ['CONFIRMADO', 'REJEITADO'].includes(params.status) ? params.status : 'PENDENTE';
  try {
    const payments = await getAdminPlanPayments(status);
    const kz = (value: number | string) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(Number(value));
    return <div>
      <h1 className="text-3xl font-bold">Pagamentos de planos</h1>
      <p className="mt-2 text-slate-600">Comprovativos Multicaixa Express enviados pelas empresas. Confirmar activa o plano Pro automaticamente.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { label: 'Pendentes', value: undefined },
          { label: 'Confirmados', value: 'CONFIRMADO' },
          { label: 'Rejeitados', value: 'REJEITADO' },
        ].map((tab) => <a
          key={tab.label}
          href={tab.value ? `/admin/pagamentos?status=${tab.value}` : '/admin/pagamentos'}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${(status ?? 'PENDENTE') === (tab.value ?? 'PENDENTE') ? 'border-[#021f87] bg-[#021f87] text-white' : 'border-slate-300 text-slate-600 hover:border-[#021f87] hover:text-[#021f87]'}`}
        >{tab.label}</a>)}
      </div>
      <section className="mt-5 space-y-4">
        {payments.map((v: any) => <article key={v.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{v.tenant?.name ?? 'Empresa'}</p>
              <p className="text-sm text-slate-600">{kz(v.amountKz)} · {planFromAmount(Number(v.amountKz), v.months)} · {v.months} {v.months === 1 ? 'mês' : 'meses'}</p>
              <p className="text-xs text-slate-500">Pagador: {v.payerName} ({v.payerPhone}) · {new Date(v.createdAt).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}</p>
            </div>
            <AdminStatusBadge status={v.status === 'PENDENTE' ? 'PENDING' : v.status === 'CONFIRMADO' ? 'ACTIVE' : 'SUSPENDED'} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <a href={`/api/plan/payment/proof/${v.id}`} target="_blank" rel="noopener" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-[#021f87] hover:border-[#021f87]">Ver comprovativo</a>
          </div>
          {v.status === 'PENDENTE' && <PlanPaymentReviewForm id={v.id} done={false} />}
          {v.status !== 'PENDENTE' && v.adminNote && <p className="mt-2 text-sm text-slate-500">Nota: {v.adminNote}</p>}
        </article>)}
        {!payments.length && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Nenhum pagamento nesta lista.</p>}
      </section>
    </div>;
  } catch { return <AdminErrorState title="Pagamentos de planos" />; }
}
