import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PaymentForm } from './payment-form';

const statusLabels: Record<string, string> = { PENDENTE: 'Em análise', CONFIRMADO: 'Confirmado ✓', REJEITADO: 'Rejeitado' };
const statusStyles: Record<string, string> = {
  PENDENTE: 'border-[#f0dcb9] bg-[#fdf6e9] text-[#8a5a10]',
  CONFIRMADO: 'border-[#cbe8dc] bg-[#eff9f4] text-[#227958]',
  REJEITADO: 'border-[#f0c9c9] bg-red-50 text-[#a83939]',
};

export default async function PagamentoPage() {
  const session = await auth();
  const sessionUser = session?.user as any;
  const tenantId = typeof sessionUser?.tenantId === 'string' ? sessionUser.tenantId : null;
  if (!tenantId) return <p>Empresa não configurada.</p>;

  const payments = await prisma.planPayment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, amountKz: true, months: true, status: true, adminNote: true, createdAt: true },
  });

  return <div className="space-y-6">
    <div>
      <p className="text-sm text-[#708195]">Plano da empresa</p>
      <h2 className="mt-1 text-2xl font-bold text-[#1c2d3f]">Subir para um plano pago</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#708195]">
        Paga por <strong>Multicaixa Express</strong>, anexa o comprovativo aqui e a tua conta é activada
        logo que a equipa confirme. Sem cartão, sem registo externo.
      </p>
    </div>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 md:p-6">
      <h3 className="text-lg font-bold text-[#1c2d3f]">1. Faz a transferência</h3>
      <p className="mt-2 text-sm leading-6 text-[#5b6f85]">
        Abre o <strong>Multicaixa Express</strong> → Transferir → usa o número abaixo. O valor depende do plano e da duração que escolheres no formulário.
      </p>
      <div className="mt-4 rounded-xl bg-gradient-to-br from-[#2878d0] to-[#102b46] p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-100">Multicaixa Express · número de destino</p>
        <p className="mt-1 text-3xl font-black tabular-nums">937 555 618</p>
        <p className="mt-2 text-xs text-blue-100">Beneficiário: Machine Facturas (Essência & Luz)</p>
      </div>
    </section>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 md:p-6">
      <h3 className="text-lg font-bold text-[#1c2d3f]">2. Envia o comprovativo</h3>
      <div className="mt-4"><PaymentForm /></div>
    </section>

    <section className="rounded-2xl border border-[#e2e9f1] bg-white p-5 md:p-6">
      <h3 className="text-lg font-bold text-[#1c2d3f]">Os teus envios</h3>
      {payments.length ? <ul className="mt-4 space-y-3">
        {payments.map((payment: any) => <li key={payment.id} className="rounded-xl border border-[#e2e9f1] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-[#1c2d3f]">
              {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(Number(payment.amountKz))}
              <span className="ml-1.5 text-xs font-normal text-[#708195]">· {payment.months} {payment.months === 1 ? 'mês' : 'meses'}</span>
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[payment.status] ?? ''}`}>{statusLabels[payment.status] ?? payment.status}</span>
          </div>
          <p className="mt-1.5 text-xs text-[#708195]">Enviado em {new Date(payment.createdAt).toLocaleString('pt-AO', { timeZone: 'Africa/Luanda' })}</p>
          {payment.adminNote && <p className="mt-1.5 rounded-lg bg-[#f7f9fc] px-3 py-2 text-sm text-[#5b6f85]">Nota da equipa: {payment.adminNote}</p>}
        </li>)}
      </ul> : <p className="mt-4 text-sm text-[#708195]">Ainda não enviaste nenhum comprovativo.</p>}
    </section>
  </div>;
}
