import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canRecordPayment, getReservedPaymentAmount } from '@/lib/payment-rules';

const ALLOWED_PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_PROOF_BYTES = 3 * 1024 * 1024;
const MAX_NOTE = 2000;
const MAX_REFERENCE = 160;
const MAX_AMOUNT = 1_000_000_000;

const ALLOWED_METHODS = new Set(['BANK_TRANSFER', 'MULTICAIXA_EXPRESS', 'MULTICAIXA_REFERENCE', 'CASH', 'DEPOSIT', 'OTHER']);

// Rota pública: cliente reporta um pagamento feito a partir do link da factura.
// Segurança: o token da factura é a capacidade (192 bits, partilhado só com o devedor);
// nenhum privilégio adicional é necessário além do link. Limites básicos para evitar abuso.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });

    const token = String(form.get('token') ?? '').trim();
    if (!/^[A-Za-z0-9_-]{20,60}$/.test(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 400 });

    const amount = Number(form.get('amount'));
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ error: 'O valor deve ser positivo e ter no máximo duas casas decimais.' }, { status: 400 });
    }
    if (amount > MAX_AMOUNT) return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });

    const method = String(form.get('method') ?? '').trim();
    if (!ALLOWED_METHODS.has(method)) return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 });

    const reference = typeof form.get('reference') === 'string' ? String(form.get('reference')).trim().slice(0, MAX_REFERENCE) : '';
    const notes = typeof form.get('notes') === 'string' ? String(form.get('notes')).trim().slice(0, MAX_NOTE) : '';
    const paymentDateRaw = form.get('paymentDate');
    const paymentDate = paymentDateRaw ? new Date(String(paymentDateRaw)) : new Date();
    if (!Number.isFinite(paymentDate.getTime())) return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });

    const proofFile = form.get('proof');
    let proofName: string | null = null;
    let proofData: string | null = null;
    if (proofFile instanceof File && proofFile.size > 0) {
      if (proofFile.size > MAX_PROOF_BYTES) return NextResponse.json({ error: 'O comprovativo deve ter no máximo 3 MB.' }, { status: 400 });
      if (!ALLOWED_PROOF_TYPES.includes(proofFile.type)) {
        return NextResponse.json({ error: 'O comprovativo deve ser uma imagem (JPG, PNG, WebP) ou PDF.' }, { status: 400 });
      }
      const buffer = Buffer.from(await proofFile.arrayBuffer());
      proofName = proofFile.name.slice(0, 160).replace(/[\\/:*?"<>|]/g, '_');
      proofData = `data:${proofFile.type};base64,${buffer.toString('base64')}`;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { shareToken: token },
      select: {
        id: true,
        tenantId: true,
        type: true,
        status: true,
        total: true,
        shareExpiresAt: true,
        payments: { select: { amount: true, status: true } },
      },
    });
    if (!invoice) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 });
    if (invoice.shareExpiresAt && invoice.shareExpiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Link expirado.' }, { status: 410 });
    }
    if (invoice.type !== 'FT' || invoice.status !== 'ISSUED') {
      return NextResponse.json({ error: 'Esta factura não está disponível para reportar pagamento.' }, { status: 409 });
    }

    const reserved = getReservedPaymentAmount(invoice.payments.map((payment: any) => ({ amount: Number(payment.amount), status: payment.status })));
    if (!canRecordPayment(Number(invoice.total), reserved, amount)) {
      return NextResponse.json({ error: 'O valor excede o saldo disponível.' }, { status: 409 });
    }

    const idempotencyKey = String(form.get('idempotencyKey') ?? '').trim();
    if (!idempotencyKey || idempotencyKey.length > 120) {
      return NextResponse.json({ error: 'A chave de submissão é obrigatória.' }, { status: 400 });
    }

    const duplicate = await prisma.payment.findUnique({ where: { tenantId_idempotencyKey: { tenantId: invoice.tenantId, idempotencyKey } }, select: { id: true } });
    if (duplicate) return NextResponse.json({ error: 'Esta submissão já foi registada.' }, { status: 409 });

    const payment = await prisma.payment.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        amount,
        currency: 'AOA',
        method,
        status: 'PENDING',
        paymentDate,
        reference: reference || null,
        notes: notes || null,
        idempotencyKey,
        createdByUserId: null,
        proofName,
        proofData,
      },
      select: { id: true, status: true, amount: true },
    });
    await prisma.paymentEvent.create({
      data: {
        tenantId: invoice.tenantId,
        paymentId: payment.id,
        eventType: 'REPORTED',
        previousStatus: null,
        nextStatus: 'PENDING',
        actorUserId: null,
        snapshot: { amount, currency: 'AOA', method, reference: reference || null, paymentDate: paymentDate.toISOString() },
      },
    });

    return NextResponse.json({ ok: true, payment: { id: payment.id, status: payment.status } }, { status: 201 });
  } catch (error) {
    console.error('Erro ao reportar pagamento via link público:', error);
    return NextResponse.json({ error: 'Não foi possível registar o pagamento. Tente novamente.' }, { status: 500 });
  }
}
