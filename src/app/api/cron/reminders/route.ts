import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendAndRecordEmail } from '@/lib/email-actions';
import { escapeEmailHtml } from '@/lib/email-core';

// Cron diário (Vercel): envia lembretes de cobrança para facturas emitidas em atraso.
// Regras: no máximo 1 lembrete por factura a cada 7 dias; apenas adquirentes com email;
// link público fresco (30 dias) incluído no email.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);

  const overdue = await prisma.invoice.findMany({
    where: {
      type: 'FT',
      status: 'ISSUED',
      dueAt: { lt: now },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lte: weekAgo } }],
      customer: { email: { not: null } },
      tenant: { status: 'ACTIVE' },
    },
    include: {
      customer: { select: { name: true, email: true } },
      tenant: { select: { name: true } },
    },
    orderBy: { dueAt: 'asc' },
    take: 20,
  });

  let sent = 0;
  const results: { invoice: string; to: string; status: string }[] = [];

  for (const invoice of overdue) {
    const email = invoice.customer.email!.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;

    const token = randomBytes(24).toString('base64url');
    const expires = new Date(now.getTime() + 30 * 86_400_000);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { shareToken: token, shareExpiresAt: expires, lastReminderAt: now } });

    const base = process.env.APP_URL?.replace(/\/$/, '') ?? 'https://machinefaturas.shop';
    const link = `${base}/f/${token}`;
    const greeting = escapeEmailHtml(invoice.customer.name || 'Cliente');
    const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1c2d3f">
      <h1 style="color:#102b46">${escapeEmailHtml(invoice.tenant.name)}</h1>
      <p>Olá ${greeting},</p>
      <p>A factura <strong>${escapeEmailHtml(invoice.number ?? invoice.id)}</strong>, no valor de <strong>${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Number(invoice.total))}</strong>, venceu em <strong>${invoice.dueAt!.toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</strong> e aguarda pagamento.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 20px;background:#2878d0;color:#fff;text-decoration:none;border-radius:6px">Ver a factura</a></p>
      <p>Pedimos o pagamento por Multicaixa Express. Se já pagou, ignore esta mensagem.</p>
      <p style="font-size:12px;color:#8a95a5">Enviado via Machine Facturas.</p>
    </div>`;

    const sentEmail = await sendAndRecordEmail({
      purpose: 'PAYMENT_REMINDER',
      to: email,
      subject: `Lembrete: factura ${invoice.number ?? ''} em atraso — ${invoice.tenant.name}`,
      text: `Olá ${invoice.customer.name || 'Cliente'}, a factura ${invoice.number ?? ''} no valor de ${new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(Number(invoice.total))} venceu em ${invoice.dueAt!.toLocaleDateString('pt-AO')} e aguarda pagamento. Consulte: ${link}. Se já pagou, ignore esta mensagem.`,
      html,
      userId: null,
      tenantId: invoice.tenantId,
    });

    const ok = sentEmail.ok && sentEmail.accepted;
    if (ok) sent += 1;
    results.push({ invoice: invoice.number ?? invoice.id, to: email, status: ok ? 'ACCEPTED' : String(('code' in sentEmail && sentEmail.code) || 'FAILED') });
  }

  return NextResponse.json({ sent, scanned: overdue.length, results });
}
