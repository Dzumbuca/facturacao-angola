import 'server-only';
import { randomBytes } from 'node:crypto';
import { prisma } from './prisma';

const db = prisma as any;
const RECEIPT_VALIDITY_DAYS = 365;

// Garante que um pagamento confirmado tem recibo com número sequencial anual
// (REC 2026/0001) e link público válido. Renova o token se estiver a expirar.
export async function ensureReceiptForPaymentTx(tx: any, tenantId: string, paymentId: string): Promise<string> {
  const existing = await tx.paymentReceipt.findUnique({ where: { paymentId }, select: { shareToken: true, shareExpiresAt: true } });
  if (existing) {
    if (existing.shareExpiresAt.getTime() > Date.now() + 7 * 86_400_000) return existing.shareToken as string;
    const renewed = randomBytes(24).toString('base64url');
    await tx.paymentReceipt.update({
      where: { paymentId },
      data: { shareToken: renewed, shareExpiresAt: new Date(Date.now() + RECEIPT_VALIDITY_DAYS * 86_400_000) },
    });
    return renewed;
  }

  const year = new Date().getFullYear();
  const count = await db.paymentReceipt.count({ where: { tenantId, number: { startsWith: `REC ${year}/` } } });
  const number = `REC ${year}/${String(count + 1).padStart(4, '0')}`;
  const token = randomBytes(24).toString('base64url');
  await tx.paymentReceipt.create({
    data: { paymentId, tenantId, number, shareToken: token, shareExpiresAt: new Date(Date.now() + RECEIPT_VALIDITY_DAYS * 86_400_000) },
  });
  return token;
}
