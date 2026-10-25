import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PrintButton } from './print-button';

type Props = { params: Promise<{ token: string }> };

const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);
const stateLabels: Record<string, string> = { ISSUED: 'Emitida', PAID: 'Paga', PARTIALLY_PAID: 'Parcialmente paga', OVERDUE: 'Vencida', CANCELLED: 'Anulada' };
const stateStyles: Record<string, string> = {
  ISSUED: 'border-[#c9def2] bg-[#eef6ff] text-[#2878d0]',
  PAID: 'border-[#cbe8dc] bg-[#eff9f4] text-[#227958]',
  PARTIALLY_PAID: 'border-[#f0dcb9] bg-[#fdf6e9] text-[#8a5a10]',
  OVERDUE: 'border-[#f0c9c9] bg-red-50 text-[#a83939]',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-600',
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) return { title: 'Factura — Machine Facturas' };
  const invoice = await prisma.invoice.findUnique({
    where: { shareToken: token },
    select: { number: true, type: true, total: true, shareExpiresAt: true, tenant: { select: { name: true } } },
  });
  if (!invoice || (invoice.shareExpiresAt && invoice.shareExpiresAt.getTime() < Date.now())) {
    return { title: 'Link expirado — Machine Facturas', robots: { index: false } };
  }
  return {
    title: `${invoice.type} ${invoice.number} · ${invoice.tenant.name} — Machine Facturas`,
    robots: { index: false },
  };
}

export default async function SharedInvoicePage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) {
    return <ExpiredShell message="Link inválido. Pede à empresa um novo link." />;
  }
  const invoice = await prisma.invoice.findUnique({
    where: { shareToken: token },
    include: {
      customer: true,
      items: { orderBy: { id: 'asc' } },
      tenant: { select: { name: true, legalName: true, nif: true, address: true, email: true, phone: true } },
      payments: { where: { status: 'CONFIRMED' }, select: { amount: true } },
    },
  });
  if (!invoice) return <ExpiredShell message="Factura não encontrada. O link pode ter sido revogado." />;
  if (invoice.status === 'DRAFT') return <ExpiredShell message="Esta factura ainda é um rascunho e não pode ser partilhada." />;
  if (invoice.shareExpiresAt && invoice.shareExpiresAt.getTime() < Date.now()) {
    return <ExpiredShell message="Este link expirou (validade de 30 dias). Pede à empresa um novo link." />;
  }

  const confirmed = invoice.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const state = invoice.status;
  const isCancelled = state === 'CANCELLED';

  return <main className="min-h-screen bg-[#f3f6fa] px-4 py-8 text-[#1c2d3f] md:px-6 md:py-12">
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/inicio" className="text-xs font-semibold text-[#708195] hover:text-[#2878d0]">← machinefaturas.shop</Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_8px_30px_rgba(25,52,80,.06)]">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e2e9f1] bg-[#102b46] p-6 text-white md:p-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" width="800" height="600" className="h-12 w-auto max-w-[96px] rounded-lg bg-white object-contain px-2 py-1.5" />
            <div>
              <p className="text-base font-extrabold">{invoice.tenant.legalName || invoice.tenant.name}</p>
              <p className="text-xs text-blue-100/90">NIF {invoice.tenant.nif || '—'}{invoice.tenant.phone ? ` · ${invoice.tenant.phone}` : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[.16em] text-blue-100/90">{invoice.type} · Documento comercial</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{invoice.number}</p>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${stateStyles[state] ?? ''}`}>{stateLabels[state] ?? state}</span>
          </div>
        </header>

        <div className="grid gap-5 p-6 md:grid-cols-2 md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Adquirente</p>
            <p className="mt-1 font-bold text-[#1c2d3f]">{invoice.customer.name}</p>
            <p className="text-sm text-[#5b6f85]">{invoice.customer.nif ? `NIF ${invoice.customer.nif}` : 'Sem NIF'}</p>
            {invoice.customer.email && <p className="text-sm text-[#5b6f85]">{invoice.customer.email}</p>}
          </div>
          <div className="md:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Datas</p>
            <p className="mt-1 text-sm text-[#46586c]">Emissão: <strong>{invoice.issuedAt.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</strong></p>
            {invoice.dueAt && <p className="text-sm text-[#46586c]">Vencimento: <strong>{invoice.dueAt.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</strong></p>}
          </div>
        </div>

        <div className="overflow-x-auto px-6 pb-2 md:px-8">
          <table className="data-table min-w-[560px]">
            <thead><tr><th>Artigo</th><th className="text-right">Qtd.</th><th className="text-right">Preço unit.</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {invoice.items.map((item: any) => <tr key={item.id}>
                <td className="font-medium text-[#263c52]">{item.description}</td>
                <td className="text-right tabular-nums">{Number(item.quantity)}</td>
                <td className="text-right tabular-nums">{money(Number(item.unitPrice))}</td>
                <td className="text-right font-semibold tabular-nums">{money(Number(item.total))}</td>
              </tr>)}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5 p-6 text-right text-sm md:p-8">
          <p className="text-[#607286]">Subtotal: {money(Number(invoice.subTotal))}</p>
          {Number(invoice.discountAmount) > 0 && <p className="text-[#607286]">Desconto: −{money(Number(invoice.discountAmount))}</p>}
          <p className="text-[#607286]">IVA: {money(Number(invoice.taxTotal))}</p>
          <p className="border-t border-[#e2e9f1] pt-2 text-xl font-black text-[#1c2d3f]">Total: {money(Number(invoice.total))}</p>
          {confirmed > 0 && <p className="text-[#227958]">Pago: {money(confirmed)} · Falta: {money(Math.max(0, Number(invoice.total) - confirmed))}</p>}
        </div>

        {invoice.observations && <p className="border-t border-[#e2e9f1] px-6 py-4 text-sm leading-6 text-[#607286] md:px-8"><strong>Observações:</strong> {invoice.observations}</p>}

        <footer className="border-t border-[#e2e9f1] bg-[#f7f9fc] px-6 py-4 text-xs leading-5 text-[#708195] md:px-8">
          {isCancelled
            ? 'Este documento foi anulado.'
            : <>Documento emitido electronicamente com <strong>assinatura digital (padrão AGT)</strong> — código de controlo <span className="font-mono font-bold text-[#263c52]">{invoice.hash?.substring(0, 8) ?? '—'}</span>. A validade fiscal pode ser confirmada junto da AGT.</>}
          <p className="mt-1">Emitido via <Link href="/inicio" className="font-semibold text-[#2878d0]">Machine Facturas</Link> · {new Date().toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</p>
        </footer>
      </article>

      <p className="mt-6 text-center text-xs text-[#8a95a5] print:hidden">Este link é privado e expira 30 dias após a emissão. Não o partilhes fora do destinatário.</p>
    </div>
  </main>;
}

function ExpiredShell({ message }: { message: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f3f6fa] px-4 text-center">
    <div className="max-w-sm rounded-2xl border border-[#e2e9f1] bg-white p-8">
      <p className="text-3xl">⏳</p>
      <h1 className="mt-3 text-lg font-bold text-[#1c2d3f]">Link não disponível</h1>
      <p className="mt-2 text-sm leading-6 text-[#5b6f85]">{message}</p>
      <Link href="/inicio" className="mt-5 inline-flex rounded-lg bg-[#2878d0] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#216bbd]">Ir para Machine Facturas</Link>
    </div>
  </main>;
}
