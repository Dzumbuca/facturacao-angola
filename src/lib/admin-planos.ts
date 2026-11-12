'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPrisma = any;
import { requirePlatformPermission } from './admin-auth';
import { validateAdminReason } from './admin-actions-core';

type ActionResult = { ok: boolean; message: string };
const failure = (message = 'Não foi possível concluir a operação.'): ActionResult => ({ ok: false, message });
const success = (message = 'Alteração guardada.'): ActionResult => ({ ok: true, message });

type AdminPlanApp = { slug: string; name: string };

export async function listCommercialPlans() {
  await requirePlatformPermission('companies.update');
  const db = prisma as any;
  const plans = await db.subscriptionPlan.findMany({
    orderBy: [{ priceKz: 'asc' }, { slug: 'asc' }],
    include: { planApplications: { include: { application: true } }, limits: true, capabilities: true },
  });
  return plans.map((plan: AnyPrisma) => ({
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    priceKz: Number(plan.priceKz),
    priceYearly: plan.priceYearly == null ? null : Number(plan.priceYearly),
    isBundle: plan.isBundle,
    isActive: plan.isActive,
    applications: plan.planApplications.map((pa: AnyPrisma) => ({ slug: pa.application.slug, name: pa.application.name, isCore: pa.application.isCore })),
    limits: plan.limits.map((l: AnyPrisma) => ({ metric: l.metric, value: l.value })),
    capabilities: plan.capabilities.map((c: AnyPrisma) => ({ capability: c.capability, enabled: c.enabled })),
  }));
}

export async function listApplications(): Promise<AdminPlanApp[]> {
  await requirePlatformPermission('companies.update');
  const apps = await (prisma as any).platformApplication.findMany({ orderBy: [{ isCore: 'desc' }, { name: 'asc' }] });
  return apps.map((app: AnyPrisma) => ({ slug: app.slug, name: app.name }));
}

export async function upsertCommercialPlan(input: {
  id?: string; slug?: string; name: string; description: string; priceKz: number; billingCycle?: string; isBundle?: boolean;
}): Promise<ActionResult> {
  const actor = await requirePlatformPermission('companies.update');
  const reason = validateAdminReason('Plano comercial alterado');
  if (!actor || !reason) return failure();
  const name = input.name.trim();
  if (!name) return failure('Nome é obrigatório.');
  try {
    await (prisma as any).$transaction(async (tx: any) => {
      if (input.id) {
        const existing = await tx.subscriptionPlan.findUnique({ where: { id: input.id } });
        if (!existing) throw new Error('not-found');
        const update: any = { name, description: input.description, priceKz: input.priceKz, isBundle: !!input.isBundle };
        if (!existing.slug.startsWith('machine-')) {
          // slug nunca muda automaticamente (evita quebrar FK/assinaturas)
          if (input.slug?.trim() && input.slug.trim() !== existing.slug) return; // ignorar mudança silenciosa de slug
        }
        await tx.subscriptionPlan.update({ where: { id: input.id }, data: update });
        await tx.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLAN_UPDATED', resourceType: 'PLAN', resourceId: input.id, reason, metadata: { name, priceKz: input.priceKz } } });
      } else {
        const slug = (input.slug ?? input.name).trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!slug) throw new Error('slug inválido');
        await tx.subscriptionPlan.create({ data: { slug, name, description: input.description, priceKz: input.priceKz, billingCycle: input.billingCycle ?? 'MONTHLY', isBundle: !!input.isBundle } });
        const created = await tx.subscriptionPlan.findUnique({ where: { slug } });
        await tx.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLAN_CREATED', resourceType: 'PLAN', resourceId: created?.id, reason, metadata: { name, slug, priceKz: input.priceKz } } });
      }
    });
    revalidatePath('/admin/planos');
    return success('Plano guardado.');
  } catch (e: any) {
    return failure(e?.message ?? undefined);
  }
}

export async function setPlanActive(planId: string, active: boolean): Promise<ActionResult> {
  const actor = await requirePlatformPermission('companies.update');
  if (!actor || !planId) return failure();
  const plan = await (prisma as any).subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return failure('Plano não encontrado.');
  if (plan.slug === 'free') return failure('O plano Free não pode ser desactivado.');
  try {
    await (prisma as any).subscriptionPlan.update({ where: { id: planId }, data: { isActive: active } });
    await prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action: active ? 'PLAN_ACTIVATED' : 'PLAN_DEACTIVATED', resourceType: 'PLAN', resourceId: planId, reason: 'Alteração de disponibilidade', metadata: { slug: plan.slug, active } } });
    revalidatePath('/admin/planos');
    return success(active ? 'Plano reactivado.' : 'Plano desactivado.');
  } catch {
    return failure();
  }
}

export async function togglePlanModule(planId: string, applicationSlug: string, enabled: boolean): Promise<ActionResult> {
  const actor = await requirePlatformPermission('companies.update');
  if (!actor || !planId || !applicationSlug) return failure();
  const [plan, app] = await Promise.all([
    prisma.subscriptionPlan.findUnique({ where: { id: planId }, select: { slug: true } }),
    prisma.platformApplication.findUnique({ where: { slug: applicationSlug } }),
  ]);
  if (!plan || !app) return failure('Plano ou aplicação não encontrados.');
  if (app.isCore && !enabled) return failure('O módulo Facturas não pode ser removido de nenhum plano.');
  try {
    await (prisma as any).$transaction(async (tx: any) => {
      if (enabled) {
        await tx.planApplication.create({ data: { planId, applicationId: app.id } }).catch(() => null);
      } else {
        await tx.planApplication.delete({ where: { planId_applicationId: { planId, applicationId: app.id } } }).catch(() => null);
      }
      await tx.adminAuditLog.create({ data: { actorUserId: actor.id, action: enabled ? 'PLAN_MODULE_ADDED' : 'PLAN_MODULE_REMOVED', resourceType: 'PLAN', resourceId: planId, reason: 'Aplicação adicionada/removida do plano', metadata: { slug: plan.slug, application: app.slug, enabled } } });
    });
    revalidatePath('/admin/planos');
    return success(enabled ? 'Módulo adicionado.' : 'Módulo removido.');
  } catch {
    return failure();
  }
}

export async function setPlanLimit(planId: string, metric: string, value: number | null): Promise<ActionResult> {
  const actor = await requirePlatformPermission('companies.update');
  if (!actor || !planId || !metric) return failure();
  if (value !== null && (Number.isNaN(value) || value < 0)) return failure('Limite inválido.');
  try {
    await (prisma as any).planLimit.upsert({ where: { planId_metric: { planId, metric } }, update: { value }, create: { planId, metric, value } });
    await prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLAN_LIMIT_SET', resourceType: 'PLAN', resourceId: planId, reason: 'Limite actualizado', metadata: { metric, value } } });
    revalidatePath('/admin/planos');
    return success('Limite actualizado.');
  } catch {
    return failure();
  }
}

export async function setPlanCapability(planId: string, capability: string, enabled: boolean): Promise<ActionResult> {
  const actor = await requirePlatformPermission('companies.update');
  if (!actor || !planId || !capability) return failure();
  try {
    await (prisma as any).planCapability.upsert({ where: { planId_capability: { planId, capability } }, update: { enabled }, create: { planId, capability, enabled } });
    await prisma.adminAuditLog.create({ data: { actorUserId: actor.id, action: 'PLAN_CAPABILITY_SET', resourceType: 'PLAN', resourceId: planId, reason: 'Permissão do plano actualizada', metadata: { capability, enabled } } });
    revalidatePath('/admin/planos');
    return success('Permissão actualizada.');
  } catch {
    return failure();
  }
}
