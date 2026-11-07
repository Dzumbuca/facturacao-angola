'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePlatformPermission, isSuperAdminRole, type PlatformPermission } from '@/lib/admin-auth';
import { isLastActivePlatformAdminChange, validateAdminReason } from './admin-actions-core';
import { nextPlanExpiry } from './plan';

const db = prisma as any;
type ActionResult = { ok: boolean; message: string };
const failure: ActionResult = { ok: false, message: 'Não foi possível concluir a operação.' };
const success: ActionResult = { ok: true, message: 'Alteração guardada.' };
const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0 && id.length <= 100;

async function actor(permission: PlatformPermission) {
  try { return await requirePlatformPermission(permission); } catch { return null; }
}

export async function setTenantStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('companies.suspend');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || !['ACTIVE', 'SUSPENDED'].includes(status) || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.findUnique({ where: { id }, select: { id: true, status: true } });
      if (!tenant) throw new Error('not-found');
      if (tenant.status === status) return;
      await tx.tenant.update({ where: { id }, data: { status, suspendedAt: status === 'SUSPENDED' ? new Date() : null, suspensionReason: status === 'SUSPENDED' ? reason : null } });
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: status === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_REACTIVATED', resourceType: 'TENANT', resourceId: id, reason, metadata: { previousStatus: tenant.status, nextStatus: status } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/empresas'); revalidatePath(`/admin/empresas/${id}`);
    return success;
  } catch { return failure; }
}

// Altera o plano comercial de uma empresa (FREE vê anúncios; PRO não vê).
export async function setTenantPlan(id: string, plan: 'FREE' | 'PRO', rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('companies.suspend');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || !['FREE', 'PRO'].includes(plan) || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.findUnique({ where: { id }, select: { id: true, plan: true } });
      if (!tenant) throw new Error('not-found');
      if (tenant.plan === plan) return;
      await tx.tenant.update({ where: { id }, data: { plan } });
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: 'TENANT_PLAN_CHANGED', resourceType: 'TENANT', resourceId: id, reason, metadata: { previousPlan: tenant.plan, nextPlan: plan } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/empresas'); revalidatePath(`/admin/empresas/${id}`);
    return success;
  } catch { return failure; }
}

// Activa/desactiva o módulo WMS (armazém e stock) para uma empresa.
export async function setTenantWmsEnabled(id: string, enabled: boolean, rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('companies.update');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || typeof enabled !== 'boolean' || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.findUnique({ where: { id }, select: { id: true } });
      if (!tenant) throw new Error('not-found');
      const app = await tx.platformApplication.findUnique({ where: { slug: 'wms' } });
      if (!app) throw new Error('app-missing');
      const existing = await tx.tenantApplication.findUnique({
        where: { tenantId_applicationId: { tenantId: id, applicationId: app.id } },
      });
      await tx.tenantApplication.upsert({
        where: { tenantId_applicationId: { tenantId: id, applicationId: app.id } },
        update: { enabled, enabledAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
        create: { tenantId: id, applicationId: app.id, enabled, enabledAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: currentActor.id,
          action: enabled ? 'TENANT_WMS_ENABLED' : 'TENANT_WMS_DISABLED',
          resourceType: 'TENANT',
          resourceId: id,
          reason,
          metadata: { previous: !!existing?.enabled, next: enabled },
        },
      });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/empresas'); revalidatePath(`/admin/empresas/${id}`);
    revalidatePath('/stock'); revalidatePath('/apps');
    return success;
  } catch { return failure; }
}

// Atribui um pacote comercial (subscrição) e sincroniza o módulo WMS.
// 'none' remove a subscrição e mantém o tenant legado (grandfathering).
export type TenantPackage = 'gratis' | 'basico' | 'profissional' | 'empresarial' | 'none';
export async function setTenantPackage(id: string, packageSlug: TenantPackage, rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('companies.update');
  const reason = validateAdminReason(rawReason);
  const allowed: TenantPackage[] = ['gratis', 'basico', 'profissional', 'empresarial', 'none'];
  if (!currentActor || !validId(id) || !allowed.includes(packageSlug) || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const tenant = await tx.tenant.findUnique({ where: { id }, select: { id: true } });
      if (!tenant) throw new Error('not-found');
      await tx.tenantSubscription.deleteMany({ where: { tenantId: id } });
      if (packageSlug !== 'none') {
        const plan = await tx.subscriptionPlan.findUnique({ where: { slug: packageSlug } });
        if (!plan) throw new Error('plan-missing');
        await tx.tenantSubscription.create({
          data: { tenantId: id, planId: plan.id, status: 'ACTIVE', startsAt: new Date(), endsAt: null, autoRenew: false },
        });
      }
      const app = await tx.platformApplication.findUnique({ where: { slug: 'wms' } });
      const wmsEnabled = packageSlug === 'none' ? true : packageSlug !== 'gratis';
      if (app) {
        await tx.tenantApplication.upsert({
          where: { tenantId_applicationId: { tenantId: id, applicationId: app.id } },
          update: { enabled: wmsEnabled, enabledAt: wmsEnabled ? new Date() : null, disabledAt: wmsEnabled ? null : new Date() },
          create: { tenantId: id, applicationId: app.id, enabled: wmsEnabled, enabledAt: wmsEnabled ? new Date() : null, disabledAt: wmsEnabled ? null : new Date() },
        });
      }
      await tx.adminAuditLog.create({
        data: {
          actorUserId: currentActor.id,
          action: 'TENANT_PACKAGE_CHANGED',
          resourceType: 'TENANT',
          resourceId: id,
          reason,
          metadata: { package: packageSlug, wmsEnabled },
        },
      });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/empresas'); revalidatePath(`/admin/empresas/${id}`);
    revalidatePath('/stock'); revalidatePath('/apps');
    return success;
  } catch { return failure; }
}

export async function setUserStatus(id: string, status: 'ACTIVE' | 'SUSPENDED', rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('users.suspend');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || !['ACTIVE', 'SUSPENDED'].includes(status) || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id }, select: { id: true, status: true, platformRole: true, tenantId: true } });
      if (!user) throw new Error('not-found');
      if ((user.platformRole === 'ADMIN' || user.platformRole === 'SUPERADMIN') && !isSuperAdminRole(currentActor.platformRole)) throw new Error('protected-platform-admin');
      if (currentActor.platformRole === 'USER_MANAGER' && (!currentActor.tenantId || user.tenantId !== currentActor.tenantId)) throw new Error('outside-scope');
      if (isLastActivePlatformAdminChange({ currentRole: user.platformRole, currentStatus: user.status, nextRole: user.platformRole, nextStatus: status, activeAdminCount: await tx.user.count({ where: { platformRole: { in: ['ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' } }) })) throw new Error('last-admin');
      await tx.user.update({ where: { id }, data: { status, suspendedAt: status === 'SUSPENDED' ? new Date() : null, suspensionReason: status === 'SUSPENDED' ? reason : null, sessionVersion: { increment: 1 } } });
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', resourceType: 'USER', resourceId: id, reason, metadata: { previousStatus: user.status, nextStatus: status } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/utilizadores'); revalidatePath(`/admin/utilizadores/${id}`);
    return success;
  } catch { return failure; }
}

export async function setTenantRole(id: string, role: 'USER' | 'COMPANY_ADMIN' | 'BILLING' | 'VIEWER', rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('users.update_role');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || !['USER', 'COMPANY_ADMIN', 'BILLING', 'VIEWER'].includes(role) || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id }, select: { tenantRole: true, tenantId: true } });
      if (!user) throw new Error('not-found');
      if (currentActor.platformRole === 'USER_MANAGER' && (!currentActor.tenantId || user.tenantId !== currentActor.tenantId)) throw new Error('outside-scope');
      await tx.user.update({ where: { id }, data: { tenantRole: role } });
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: 'TENANT_ROLE_CHANGED', resourceType: 'USER', resourceId: id, reason, metadata: { previousRole: user.tenantRole, nextRole: role } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/utilizadores'); revalidatePath(`/admin/utilizadores/${id}`);
    return success;
  } catch { return failure; }
}

export async function setPlatformRole(id: string, role: 'NONE' | 'ADMIN' | 'SUPERADMIN' | 'COMPANY_MANAGER' | 'USER_MANAGER' | 'DOCUMENT_MANAGER' | 'AUDITOR' | 'SUPPORT', rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('team.update_role');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || !['NONE', 'ADMIN', 'SUPERADMIN', 'COMPANY_MANAGER', 'USER_MANAGER', 'DOCUMENT_MANAGER', 'AUDITOR', 'SUPPORT'].includes(role) || !reason || id === currentActor.id || ((role === 'ADMIN' || role === 'SUPERADMIN') && !isSuperAdminRole(currentActor.platformRole))) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const user = await tx.user.findUnique({ where: { id }, select: { platformRole: true, status: true } });
      if (!user) throw new Error('not-found');
      const nextStatus = user.status;
      if (isLastActivePlatformAdminChange({ currentRole: user.platformRole, currentStatus: user.status, nextRole: role, nextStatus, activeAdminCount: await tx.user.count({ where: { platformRole: { in: ['ADMIN', 'SUPERADMIN'] }, status: 'ACTIVE' } }) })) throw new Error('last-admin');
      await tx.user.update({ where: { id }, data: { platformRole: role } });
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: 'PLATFORM_ROLE_CHANGED', resourceType: 'USER', resourceId: id, reason, metadata: { previousRole: user.platformRole, nextRole: role } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/utilizadores'); revalidatePath(`/admin/utilizadores/${id}`);
    return success;
  } catch { return failure; }
}

export async function updatePlatformConfig(input: { platformName?: unknown; supportEmail?: unknown; supportPhone?: unknown; supportWebsite?: unknown; platformDescription?: unknown; responsibleEntity?: unknown; adHtml?: unknown }, rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('settings.update');
  const reason = validateAdminReason(rawReason);
  const platformName = typeof input?.platformName === 'string' ? input.platformName.trim() : '';
  const supportEmail = typeof input?.supportEmail === 'string' ? input.supportEmail.trim().toLowerCase() : '';
  const supportPhone = typeof input?.supportPhone === 'string' ? input.supportPhone.trim() : '';
  const supportWebsite = typeof input?.supportWebsite === 'string' ? input.supportWebsite.trim() : '';
  const platformDescription = typeof input?.platformDescription === 'string' ? input.platformDescription.trim() : '';
  const responsibleEntity = typeof input?.responsibleEntity === 'string' ? input.responsibleEntity.trim() : '';
  const adHtml = typeof input?.adHtml === 'string' ? input.adHtml.trim() : '';
  let validWebsite = true;
  if (supportWebsite) { try { const url = new URL(supportWebsite); validWebsite = url.protocol === 'https:' || url.protocol === 'http:'; } catch { validWebsite = false; } }
  if (!currentActor || !reason || platformName.length < 2 || platformName.length > 80 || supportEmail.length > 254 || (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) || supportPhone.length > 40 || !validWebsite || supportWebsite.length > 200 || platformDescription.length > 500 || responsibleEntity.length > 160 || adHtml.length > 4000) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const select = { platformName: true, supportEmail: true, supportPhone: true, supportWebsite: true, platformDescription: true, responsibleEntity: true, adHtml: true };
      const previous = await tx.platformConfig.upsert({ where: { id: 'global' }, create: { id: 'global' }, update: {}, select });
      const next = { platformName, supportEmail: supportEmail || null, supportPhone: supportPhone || null, supportWebsite: supportWebsite || null, platformDescription: platformDescription || null, responsibleEntity: responsibleEntity || null, adHtml: adHtml || null };
      await tx.platformConfig.update({ where: { id: 'global' }, data: { ...next, updatedByUserId: currentActor.id } });
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: 'PLATFORM_CONFIG_UPDATED', resourceType: 'PLATFORM_CONFIG', resourceId: 'global', reason, metadata: { previous, next } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin'); revalidatePath('/admin/configuracoes'); revalidatePath('/admin');
    return success;
  } catch { return failure; }
}

// Revisa um comprovativo de pagamento de plano. CONFIRMADO activa o plano Pro da empresa.
export async function reviewPlanPayment(id: string, decision: 'CONFIRMADO' | 'REJEITADO', rawReason: string): Promise<ActionResult> {
  const currentActor = await actor('companies.suspend');
  const reason = validateAdminReason(rawReason);
  if (!currentActor || !validId(id) || !['CONFIRMADO', 'REJEITADO'].includes(decision) || !reason) return failure;
  try {
    await db.$transaction(async (tx: any) => {
      const payment = await tx.planPayment.findUnique({ where: { id }, select: { id: true, status: true, tenantId: true, months: true } });
      if (!payment) throw new Error('not-found');
      if (payment.status !== 'PENDENTE') return;
      await tx.planPayment.update({ where: { id }, data: { status: decision, adminNote: reason, reviewedAt: new Date() } });
      if (decision === 'CONFIRMADO') {
        const tenant = await tx.tenant.findUnique({ where: { id: payment.tenantId }, select: { planExpiry: true } });
        const expiry = nextPlanExpiry(tenant?.planExpiry, payment.months);
        await tx.tenant.update({ where: { id: payment.tenantId }, data: { plan: 'PRO', planExpiry: expiry } });
      }
      await tx.adminAuditLog.create({ data: { actorUserId: currentActor.id, action: 'PLAN_PAYMENT_REVIEWED', resourceType: 'PLAN_PAYMENT', resourceId: id, reason, metadata: { decision, previousStatus: payment.status, months: payment.months } } });
    }, { isolationLevel: 'Serializable' });
    revalidatePath('/admin/pagamentos'); revalidatePath('/admin');
    return decision === 'CONFIRMADO' ? { ok: true, message: 'Pagamento confirmado e plano Pro activado.' } : { ok: true, message: 'Pagamento rejeitado.' };
  } catch { return failure; }
}
