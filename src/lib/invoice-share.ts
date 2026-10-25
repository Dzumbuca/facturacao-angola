'use server';

import { randomBytes } from 'node:crypto';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const SHARE_DAYS = 30;

// Cria (ou renova) o link público de uma factura emitida.
// Rascunhos não podem ser partilhados. O token é opaco e expira em 30 dias.
export async function createInvoiceShare(invoiceId: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  const session = await auth();
  const tenantId = (session?.user as any)?.tenantId;
  if (!tenantId) return { ok: false, error: 'Sessão inválida.' };

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId, status: { not: 'DRAFT' } },
    select: { id: true },
  });
  if (!invoice) return { ok: false, error: 'Factura não encontrada (ou é um rascunho — emite primeiro).' };

  const token = randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + SHARE_DAYS * 86_400_000);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { shareToken: token, shareExpiresAt: expires } });

  const base = process.env.APP_URL?.replace(/\/$/, '') ?? 'https://machinefaturas.shop';
  return { ok: true, url: `${base}/f/${token}` };
}
