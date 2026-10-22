import 'server-only';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';
import { createPublicEmailUrl, escapeEmailHtml, sendSmtpEmail, type EmailActionPurpose } from './email-core';

const db = prisma as any;
const tokenLifetime = { VERIFY_EMAIL: 24 * 60 * 60 * 1000, PASSWORD_RESET: 60 * 60 * 1000 } as const;
export const hashEmailToken = (token: string) => createHash('sha256').update(token).digest('hex');
export const createUnsubscribeToken = (preferenceId: string) => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('Email token signing key unavailable');
  return createHmac('sha256', secret).update(`marketing-unsubscribe:${preferenceId}`).digest('base64url');
};
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function allowEmailRequest(scope: string, email: string, limit = 5) {
  const normalized = email.trim().toLowerCase();
  const keyHash = hashEmailToken(`${scope}:${normalized}`);
  const now = new Date();
  const cutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const rows = await db.$queryRawUnsafe(
    `INSERT INTO "EmailRequestLimit" ("keyHash", "windowStartedAt", "requestCount", "updatedAt") VALUES ($1, $2, 1, $2)
     ON CONFLICT ("keyHash") DO UPDATE SET
       "windowStartedAt" = CASE WHEN "EmailRequestLimit"."windowStartedAt" <= $3 THEN $2 ELSE "EmailRequestLimit"."windowStartedAt" END,
       "requestCount" = CASE WHEN "EmailRequestLimit"."windowStartedAt" <= $3 THEN 1 ELSE "EmailRequestLimit"."requestCount" + 1 END,
       "updatedAt" = $2
     RETURNING "requestCount"`, keyHash, now, cutoff,
  );
  return Number(rows[0]?.requestCount ?? limit + 1) <= limit;
}

export async function sendAndRecordEmail(input: {
  purpose: string; to: string; subject: string; text: string; html?: string;
  headers?: Record<string, string>;
  userId?: string | null; tenantId?: string | null; invoiceId?: string | null; sentByUserId?: string | null;
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>;
}) {
  const sent = await sendSmtpEmail(input);
  await db.emailDelivery.create({ data: {
    purpose: input.purpose, recipient: input.to, subject: input.subject,
    status: sent.ok && sent.accepted ? 'ACCEPTED' : 'FAILED',
    errorCode: sent.ok ? (sent.accepted ? null : 'SMTP_NOT_ACCEPTED') : sent.code,
    userId: input.userId ?? null, tenantId: input.tenantId ?? null, invoiceId: input.invoiceId ?? null,
    sentByUserId: input.sentByUserId ?? null,
  } });
  return sent;
}

export async function sendEmailActionToken(user: { id: string; name: string | null; email: string }, purpose: EmailActionPurpose) {
  const email = user.email.trim().toLowerCase();
  if (!validEmail(email)) return { ok: false as const, code: 'INVALID_RECIPIENT' };
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  await db.$transaction(async (tx: any) => {
    await tx.emailActionToken.updateMany({ where: { userId: user.id, purpose, consumedAt: null }, data: { consumedAt: now } });
    await tx.emailActionToken.create({ data: { userId: user.id, purpose, tokenHash: hashEmailToken(token), expiresAt: new Date(now.getTime() + tokenLifetime[purpose]) } });
  });
  const path = purpose === 'VERIFY_EMAIL' ? '/verify-email' : '/reset-password';
  const url = createPublicEmailUrl(path, token);
  const greeting = escapeEmailHtml(user.name?.trim() || 'Utilizador');
  const subject = purpose === 'VERIFY_EMAIL' ? 'Confirme o seu email — Machine Facturas' : 'Recuperação de acesso — Machine Facturas';
  const actionLabel = purpose === 'VERIFY_EMAIL' ? 'Confirmar email' : 'Definir nova palavra-passe';
  const message = await sendAndRecordEmail({
    purpose, to: email, subject, userId: user.id,
    text: `Olá ${user.name?.trim() || 'Utilizador'},\n\n${actionLabel}: ${url}\n\nO link expira em ${purpose === 'VERIFY_EMAIL' ? '24 horas' : '1 hora'} e só pode ser usado uma vez. Se não pediu esta mensagem, ignore-a.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#1c2d3f"><h1 style="color:#102b46">Machine Facturas</h1><p>Olá ${greeting},</p><p>${purpose === 'VERIFY_EMAIL' ? 'Confirme o seu endereço de email para activar a conta.' : 'Foi pedido um link para definir uma nova palavra-passe.'}</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#2878d0;color:#fff;text-decoration:none;border-radius:6px">${actionLabel}</a></p><p>O link expira em ${purpose === 'VERIFY_EMAIL' ? '24 horas' : '1 hora'} e só pode ser usado uma vez.</p><p>Se não pediu esta mensagem, ignore-a.</p></div>`,
  });
  return message;
}

export async function verifyEmailToken(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) return false;
  const now = new Date();
  const verified = await db.$transaction(async (tx: any) => {
    const tokenHash = hashEmailToken(rawToken);
    const consumed = await tx.emailActionToken.updateMany({ where: { tokenHash, purpose: 'VERIFY_EMAIL', consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (consumed.count !== 1) return false;
    const token = await tx.emailActionToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    if (!token) return false;
    await tx.user.update({ where: { id: token.userId }, data: { emailVerified: now, emailVerificationRequired: false, sessionVersion: { increment: 1 } } });
    await tx.adminAuditLog.create({ data: { actorUserId: token.userId, actorType: 'USER', action: 'EMAIL_VERIFIED', resourceType: 'USER', resourceId: token.userId, result: 'SUCCESS' } });
    return true;
  }, { isolationLevel: 'Serializable' });
  if (!verified) return false;
  try {
    const token = await db.emailActionToken.findUnique({ where: { tokenHash: hashEmailToken(rawToken) }, select: { user: { select: { id: true, name: true, email: true } } } });
    const user = token?.user;
    if (user?.email) await sendAndRecordEmail({ purpose: 'ACCOUNT_WELCOME', to: user.email, userId: user.id, subject: 'Email confirmado — Machine Facturas', text: `Olá ${user.name || 'Utilizador'}, o seu email foi confirmado e a conta está activa. Já pode iniciar sessão.`, html: `<p>Olá ${escapeEmailHtml(user.name || 'Utilizador')},</p><p>O seu email foi confirmado e a conta está activa. Já pode iniciar sessão.</p>` });
  } catch { /* Confirmation must remain complete even if this notification fails. */ }
  return true;
}

export async function resetPasswordWithToken(rawToken: string, newPassword: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawToken) || newPassword.length < 8 || newPassword.length > 128) return false;
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const now = new Date();
  const changed = await db.$transaction(async (tx: any) => {
    const tokenHash = hashEmailToken(rawToken);
    const consumed = await tx.emailActionToken.updateMany({ where: { tokenHash, purpose: 'PASSWORD_RESET', consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (consumed.count !== 1) return false;
    const token = await tx.emailActionToken.findUnique({ where: { tokenHash }, select: { userId: true } });
    if (!token) return false;
    await tx.user.update({ where: { id: token.userId }, data: { password: passwordHash, sessionVersion: { increment: 1 } } });
    await tx.adminAuditLog.create({ data: { actorUserId: token.userId, actorType: 'USER', action: 'PASSWORD_RESET', resourceType: 'USER', resourceId: token.userId, result: 'SUCCESS' } });
    return true;
  }, { isolationLevel: 'Serializable' });
  if (!changed) return false;
  try {
    const user = await db.emailActionToken.findUnique({ where: { tokenHash: hashEmailToken(rawToken) }, select: { user: { select: { id: true, name: true, email: true } } } });
    if (user?.user?.email) await sendAndRecordEmail({ purpose: 'PASSWORD_CHANGED', to: user.user.email, userId: user.user.id, subject: 'Palavra-passe alterada — Machine Facturas', text: `Olá ${user.user.name || 'Utilizador'}, a palavra-passe da sua conta foi alterada. Se não fez esta alteração, contacte o suporte.`, html: `<p>Olá ${escapeEmailHtml(user.user.name || 'Utilizador')},</p><p>A palavra-passe da sua conta foi alterada.</p><p>Se não fez esta alteração, contacte o suporte.</p>` });
  } catch { /* Password update must not be rolled back by a notification failure. */ }
  return true;
}

export async function unsubscribeFromMarketing(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) return false;
  const preference = await db.marketingPreference.findUnique({ where: { unsubscribeTokenHash: hashEmailToken(rawToken) }, select: { id: true, subscribed: true } });
  if (!preference) return false;
  if (!preference.subscribed) return true;
  await db.marketingPreference.update({ where: { id: preference.id }, data: { subscribed: false, unsubscribedAt: new Date() } });
  return true;
}
