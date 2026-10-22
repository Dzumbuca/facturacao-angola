'use server';

import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePlatformPermission, isSuperAdminRole } from '@/lib/admin-auth';
import { allowEmailRequest, sendAndRecordEmail } from '@/lib/email-actions';
import { createPublicEmailUrl, escapeEmailHtml } from '@/lib/email-core';

const db = prisma as any;
const roles = ['ADMIN', 'SUPERADMIN', 'COMPANY_MANAGER', 'USER_MANAGER', 'DOCUMENT_MANAGER', 'AUDITOR', 'SUPPORT'];
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const inviteRoleNames: Record<string, string> = { ADMIN: 'Superadministrador', SUPERADMIN: 'Superadministrador', COMPANY_MANAGER: 'Gestor de empresas', USER_MANAGER: 'Gestor de utilizadores', DOCUMENT_MANAGER: 'Gestor documental', AUDITOR: 'Auditor', SUPPORT: 'Suporte' };
async function sendInvite(invite: any, token: string, actorId: string) {
  const url = createPublicEmailUrl('/accept-platform-invite', token);
  return sendAndRecordEmail({ purpose: 'TEAM_INVITE', to: invite.email, subject: 'Convite para a equipa Machine Facturas', sentByUserId: actorId,
    text: `Olá ${invite.name}, foi convidado para a equipa Machine Facturas como ${inviteRoleNames[invite.platformRole]}. Aceite o convite: ${url}\n\nO link expira em 72 horas.`,
    html: `<p>Olá ${escapeEmailHtml(invite.name)},</p><p>Foi convidado para a equipa Machine Facturas como <strong>${inviteRoleNames[invite.platformRole]}</strong>.</p><p><a href="${url}">Aceitar convite</a></p><p>O link expira em 72 horas.</p>` });
}

export async function createTeamInvite(input: { name?: unknown; email?: unknown; role?: unknown }) {
  try {
    const actor = await requirePlatformPermission('team.invite');
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
    const role = typeof input?.role === 'string' ? input.role : '';
    if (!name || name.length > 120 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !roles.includes(role)) return { ok: false, message: 'Dados do convite inválidos.' };
    if (['ADMIN', 'SUPERADMIN'].includes(role) && !isSuperAdminRole(actor.platformRole)) return { ok: false, message: 'Não tem permissão para convidar um superadministrador.' };
    if (!await allowEmailRequest('team-invite', email, 3)) return { ok: false, message: 'Limite de reenvios atingido para este email. Tente mais tarde.' };
    const token = randomBytes(32).toString('base64url');
    const invite = await db.$transaction(async (tx: any) => {
      const created = await tx.platformTeamInvite.create({ data: { name, email, platformRole: role, permissions: [], tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), createdById: actor.id } });
      await tx.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLATFORM_INVITE_CREATED', resourceType: 'PLATFORM_INVITE', resourceId: created.id, metadata: { platformRole: role } } });
      return created;
    });
    const sent = await sendInvite(invite, token, actor.id);
    revalidatePath('/admin/equipa');
    return sent.ok && sent.accepted ? { ok: true, message: 'Convite criado e aceite pelo servidor SMTP.' } : { ok: false, message: 'Convite guardado, mas o email falhou. Pode tentar reenviar.' };
  } catch { return { ok: false, message: 'Não foi possível criar o convite.' }; }
}

export async function resendTeamInvite(id: string) {
  try {
    const actor = await requirePlatformPermission('team.invite');
    if (!/^[\w-]{20,40}$/.test(id)) return { ok: false, message: 'Convite inválido.' };
    const invite = await db.platformTeamInvite.findUnique({ where: { id } });
    if (!invite || invite.status !== 'PENDING') return { ok: false, message: 'O convite já não está pendente.' };
    if (['ADMIN', 'SUPERADMIN'].includes(invite.platformRole) && !isSuperAdminRole(actor.platformRole)) return { ok: false, message: 'Não tem permissão para reenviar este convite.' };
    if (!await allowEmailRequest('team-invite', invite.email, 3)) return { ok: false, message: 'Limite de reenvios atingido para este email. Tente mais tarde.' };
    const token = randomBytes(32).toString('base64url');
    const renewed = await db.platformTeamInvite.update({ where: { id, status: 'PENDING' }, data: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) } });
    const sent = await sendInvite(renewed, token, actor.id);
    await db.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLATFORM_INVITE_RESENT', resourceType: 'PLATFORM_INVITE', resourceId: id } });
    revalidatePath('/admin/equipa');
    return sent.ok && sent.accepted ? { ok: true, message: 'Convite reenviado.' } : { ok: false, message: 'Não foi possível enviar. O convite continua pendente.' };
  } catch { return { ok: false, message: 'Não foi possível reenviar o convite.' }; }
}

export async function cancelTeamInvite(id: string) {
  try {
    const actor = await requirePlatformPermission('team.invite');
    if (!/^[\w-]{20,40}$/.test(id)) return { ok: false, message: 'Convite inválido.' };
    const changed = await db.platformTeamInvite.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REVOKED', revokedAt: new Date() } });
    if (!changed.count) return { ok: false, message: 'O convite já não está pendente.' };
    await db.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLATFORM_INVITE_REVOKED', resourceType: 'PLATFORM_INVITE', resourceId: id } });
    revalidatePath('/admin/equipa');
    return { ok: true, message: 'Convite cancelado.' };
  } catch { return { ok: false, message: 'Não foi possível cancelar o convite.' }; }
}

export async function previewTeamInvite(rawToken: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawToken)) return null;
  const invite = await db.platformTeamInvite.findUnique({ where: { tokenHash: tokenHash(rawToken) }, select: { id: true, name: true, email: true, platformRole: true, status: true, expiresAt: true } });
  if (!invite || invite.status !== 'PENDING' || invite.expiresAt <= new Date()) return null;
  const user = await db.user.findUnique({ where: { email: invite.email }, select: { id: true, status: true } });
  return { name: invite.name, email: invite.email, role: inviteRoleNames[invite.platformRole] || invite.platformRole, existingAccount: Boolean(user), blocked: user?.status === 'SUSPENDED' };
}

export async function acceptTeamInvite(input: { token?: unknown; name?: unknown; password?: unknown }) {
  try {
    const rawToken = typeof input?.token === 'string' ? input.token : '';
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const password = typeof input?.password === 'string' ? input.password : '';
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(rawToken) || (name && name.length > 120) || (password && (password.length < 8 || password.length > 128))) return { ok: false, message: 'Convite inválido ou expirado.' };
    const bcrypt = (await import('bcrypt')).default;
    const passwordHash = password ? await bcrypt.hash(password, 12) : null;
    const now = new Date();
    await db.$transaction(async (tx: any) => {
      const invite = await tx.platformTeamInvite.findUnique({ where: { tokenHash: tokenHash(rawToken) } });
      if (!invite || invite.status !== 'PENDING' || invite.expiresAt <= now) throw new Error('invite-invalid');
      let user = await tx.user.findUnique({ where: { email: invite.email } });
      if (user?.status === 'SUSPENDED') throw new Error('account-suspended');
      if (!user) {
        if (!passwordHash) throw new Error('password-required');
        user = await tx.user.create({ data: { name: name || invite.name, email: invite.email, password: passwordHash, emailVerified: now, emailVerificationRequired: false, platformRole: invite.platformRole, platformPermissions: invite.permissions, sessionVersion: 0 } });
      } else if (!isSuperAdminRole(user.platformRole) || isSuperAdminRole(invite.platformRole)) {
        await tx.user.update({ where: { id: user.id }, data: { platformRole: invite.platformRole, platformPermissions: invite.permissions, emailVerified: user.emailVerified ?? now, sessionVersion: { increment: 1 } } });
      }
      const accepted = await tx.platformTeamInvite.updateMany({ where: { id: invite.id, status: 'PENDING', expiresAt: { gt: now } }, data: { status: 'ACCEPTED', acceptedAt: now } });
      if (accepted.count !== 1) throw new Error('invite-already-used');
      await tx.adminAuditLog.create({ data: { actorUserId: user.id, actorType: 'USER', action: 'PLATFORM_INVITE_ACCEPTED', resourceType: 'PLATFORM_INVITE', resourceId: invite.id } });
    }, { isolationLevel: 'Serializable' });
    return { ok: true, message: 'Convite aceite. Já pode iniciar sessão.' };
  } catch (error) {
    const message = (error as Error)?.message;
    return { ok: false, message: message === 'password-required' ? 'Defina uma palavra-passe para criar a conta.' : message === 'account-suspended' ? 'A conta está suspensa. Contacte o suporte.' : 'Convite inválido, expirado ou já utilizado.' };
  }
}
