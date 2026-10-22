import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { canRecordPayment, getAllowedPaymentTransition, getInvoicePaymentTotals as calculateInvoicePaymentTotals, getReservedPaymentAmount } from './payment-rules';
import type { PaymentInput } from './payment-validation';

export class PaymentServiceError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function recordPayment(invoiceId: string, input: PaymentInput, tenantId: string, actorId: string | null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx: any) => {
        const duplicate = await tx.payment.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } }, include: { events: true } });
        if (duplicate) return duplicate;

        const invoice = await tx.invoice.findFirst({
          where: { id: invoiceId, tenantId },
          include: { payments: true },
        });
        if (!invoice) throw new PaymentServiceError('Factura não encontrada.', 404);
        if (invoice.type !== 'FT' || invoice.status !== 'ISSUED') throw new PaymentServiceError('Só é possível registar pagamentos em facturas emitidas.', 409);
        const reserved = getReservedPaymentAmount(invoice.payments.map((payment: any) => ({ amount: Number(payment.amount), status: payment.status })));
        if (!canRecordPayment(Number(invoice.total), reserved, input.amount)) throw new PaymentServiceError('O valor excede o saldo ainda disponível.', 409);

        const payment = await tx.payment.create({
          data: {
            tenantId, invoiceId: invoice.id, amount: new Prisma.Decimal(input.amount), currency: input.currency,
            method: input.method, status: 'PENDING', paymentDate: input.paymentDate,
            reference: input.reference, notes: input.notes, idempotencyKey: input.idempotencyKey,
            createdByUserId: actorId,
          },
        });
        await tx.paymentEvent.create({ data: {
          tenantId, paymentId: payment.id, eventType: 'CREATED', previousStatus: null, nextStatus: 'PENDING', actorUserId: actorId,
          snapshot: { amount: input.amount, currency: input.currency, method: input.method, reference: input.reference, paymentDate: input.paymentDate.toISOString() },
        } });
        return payment;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof PaymentServiceError) throw error;
      const prismaError = error as { code?: string };
      if (prismaError.code === 'P2034' && attempt < 2) continue;
      if (prismaError.code === 'P2002') throw new PaymentServiceError('Este pagamento já foi registado ou a referência já existe.', 409);
      throw error;
    }
  }
  throw new PaymentServiceError('Não foi possível registar o pagamento por conflito simultâneo. Tente novamente.', 409);
}

export async function transitionPayment(paymentId: string, nextStatus: 'CONFIRMED' | 'CANCELLED' | 'REVERSED', tenantId: string, actorId: string | null) {
  return prisma.$transaction(async (tx: any) => {
    const payment = await tx.payment.findFirst({ where: { id: paymentId, tenantId }, include: { invoice: true } });
    if (!payment) throw new PaymentServiceError('Pagamento não encontrado.', 404);
    if (!getAllowedPaymentTransition(payment.status, nextStatus)) throw new PaymentServiceError('Transição de estado não permitida.', 409);
    const updated = await tx.payment.updateMany({ where: { id: payment.id, tenantId, status: payment.status }, data: { status: nextStatus } });
    if (updated.count !== 1) throw new PaymentServiceError('O estado foi alterado em simultâneo. Actualize a página.', 409);
    const result = { ...payment, status: nextStatus };
    await tx.paymentEvent.create({ data: {
      tenantId, paymentId: payment.id, eventType: nextStatus, previousStatus: payment.status, nextStatus, actorUserId: actorId,
      snapshot: { amount: Number(payment.amount), invoiceNumber: payment.invoice.number, reference: payment.reference },
    } });
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function getInvoicePaymentTotals(invoiceId: string, tenantId: string) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId }, select: { total: true, payments: { select: { amount: true, status: true } } } });
  if (!invoice) throw new PaymentServiceError('Factura não encontrada.', 404);
  return calculateInvoicePaymentTotals(Number(invoice.total), invoice.payments.map((payment: any) => ({ amount: Number(payment.amount), status: payment.status })));
}
