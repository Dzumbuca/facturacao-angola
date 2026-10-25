import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PrintButton } from './print-button';

type Props = { params: Promise<{ token: string }> };

const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) return { title: 'Recibo — Machine Facturas', robots: { index: false } };
  const receipt = await prisma.paymentReceipt.findUnique({
    where: { shareToken: token },
    select: { number: true, shareExpiresAt: true, payment: { select: { invoice: { select: { tenant: { select: { name: true } } } } } } },
  });
  if (!receipt || (receipt.shareExpiresAt && receipt.shareExpiresAt.getTime() < Date.now())) {
    return { title: 'Link expirado — Machine Facturas', robots: { index: false } };
  }
  return { title: `${receipt.number} · ${receipt.payment.invoice.tenant.name} — Machine Facturas`, robots: { index: false } };
}

export default async function SharedReceiptPage({ params }: Props) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) {
    return <ExpiredShell message="Link inválido. Pede à empresa um novo recibo." />;
  }
  const receipt = await prisma.paymentReceipt.findUnique({
    where: { shareToken: token },
    include: {
      payment: {
        include: {
          invoice: {
            include: {
              customer: { select: { name: true, nif: true } },
              tenant: { select: { name: true, legalName: true, nif: true, address: true, email: true, phone: true } },
            },
          },
        },
      },
    },
  });
  if (!receipt) return <ExpiredShell message="Recibo não encontrado. Pede à empresa um novo recibo." />;
  if (receipt.shareExpiresAt.getTime() < Date.now()) return <ExpiredShell message="Este link expirou (validade de 1 ano). Pede à empresa um novo recibo." />;
  if (receipt.payment.status !== 'CONFIRMED') return <ExpiredShell message="Este pagamento já não está confirmado — o recibo deixou de ser válido." />;

  const payment = receipt.payment;
  const invoice = payment.invoice;
  const methodLabels: Record<string, string> = { BANK_TRANSFER: 'Transferência bancária', MULTICAIXA_EXPRESS: 'Multicaixa Express', MULTICAIXA_REFERENCE: 'Referência Multicaixa', CASH: 'Numerário', OTHER: 'Outro método' };

  return <main className="min-h-screen bg-[#f3f6fa] px-4 py-8 text-[#1c2d3f] md:px-6 md:py-12">
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/inicio" className="text-xs font-semibold text-[#708195] hover:text-[#2878d0]">← machinefaturas.shop</Link>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-2xl border border-[#e2e9f1] bg-white shadow-[0_8px_30px_rgba(25,52,80,.06)]">
        <header className="border-b-4 border-[#227958] bg-white p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" width="800" height="600" className="h-12 w-auto max-w-[96px] rounded-lg bg-white object-contain px-2 py-1.5" />
              <div>
                <p className="text-base font-extrabold text-[#102b46]">{invoice.tenant.legalName || invoice.tenant.name}</p>
                <p className="text-xs text-[#708195]">NIF {invoice.tenant.nif || '—'}{invoice.tenant.phone ? ` · ${invoice.tenant.phone}` : ''}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#227958]">Recibo de pagamento</p>
              <p className="mt-1 text-2xl font-black tabular-nums text-[#1c2d3f]">{receipt.number}</p>
              <p className="text-xs text-[#708195]">{new Date(payment.paymentDate).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</p>
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8">
          <p className="text-lg leading-8 text-[#1c2d3f]">
            Recebemos de <strong>{invoice.customer.name}</strong>{invoice.customer.nif ? ` (NIF ${invoice.customer.nif})` : ''} a quantia de{' '}
            <strong className="text-xl text-[#227958]">{money(Number(payment.amount))}</strong>, referente à factura{' '}
            <strong className="tabular-nums">{invoice.number}</strong>, por <strong>{methodLabels[payment.method] ?? payment.method}</strong>
            {payment.reference ? ` (ref. ${payment.reference})` : ''}.
          </p>
          <div className="mt-6 grid gap-4 rounded-xl bg-[#f7f9fc] p-4 text-sm sm:grid-cols-3">
            <div><p className="text-xs font-semibold uppercase text-[#708195]">Método</p><p className="mt-1 font-semibold">{methodLabels[payment.method] ?? payment.method}</p></div>
            <div><p className="text-xs font-semibold uppercase text-[#708195]">Data do pagamento</p><p className="mt-1 font-semibold">{new Date(payment.paymentDate).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</p></div>
            <div><p className="text-xs font-semibold uppercase text-[#708195]">Factura</p><p className="mt-1 font-semibold tabular-nums">{invoice.number}</p></div>
          </div>
        </div>

        <footer className="border-t border-[#e2e9f1] bg-[#f7f9fc] px-6 py-4 text-xs leading-5 text-[#708195] md:px-8">
          <p>Obrigado pela preferência. Este recibo foi emitido electronicamente via <Link href="/inicio" className="font-semibold text-[#2878d0]">Machine Facturas</Link>.</p>
        </footer>
      </article>

      <p className="mt-6 text-center text-xs text-[#8a95a5] print:hidden">Link privado e válido por 1 ano após a emissão.</p>
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
