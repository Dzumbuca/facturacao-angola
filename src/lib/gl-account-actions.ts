/**
 * A5 — Server actions for plan of accounts (chart of accounts CRUD)
 *
 * Audited; uses GlAccountHistory table. Validation rules enforced in backend.
 * - Code must be unique per tenant
 * - No cycle in parent hierarchy
 * - Account used in a posted JournalEntry cannot be deleted; can only be inactivated
 * - Synthetic accounts cannot post directly (when used as parent of others)
 */

'use server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';
import { getSessionTenantId } from '@/lib/session';

async function recordAudit(actorUserId: string | null, tenantId: string, accountId: string, action: string, oldValues: any, newValues: any) {
  await prisma.glAccountHistory.create({
    data: { tenantId, accountId, actorUserId, action, oldValues, newValues, changedAt: new Date() },
  });
}

async function hasPostedEntries(tenantId: string, accountId: string) {
  const count = await prisma.journalEntryLine.count({ where: { tenantId, accountId } });
  return count > 0;
}

async function hasChildren(tenantId: string, parentId: string) {
  const count = await prisma.glAccount.count({ where: { tenantId, parentId } });
  return count > 0;
}

export async function createAccount(input: { code: string; name: string; kind: string; nature: string; synthetic: boolean; parentId?: string | null }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;

  const code = (input.code ?? '').trim();
  const name = (input.name ?? '').trim();
  if (code.length < 4 || code.length > 20) throw new Error('CODE_LENGTH');
  if (name.length < 3) throw new Error('NAME_TOO_SHORT');
  if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(input.kind)) throw new Error('INVALID_KIND');
  if (!['DEBIT', 'CREDIT'].includes(input.nature)) throw new Error('INVALID_NATURE');

  return runWithTenant(tenantId, async (tx) => {
    const exists = await tx.glAccount.findFirst({ where: { tenantId, code } });
    if (exists) throw new Error('CODE_ALREADY_EXISTS');

    if (input.parentId) {
      const parent = await tx.glAccount.findFirst({ where: { tenantId, id: input.parentId } });
      if (!parent) throw new Error('PARENT_NOT_FOUND');
      if (parent.kind !== input.kind) throw new Error('KIND_MISMATCH_WITH_PARENT');
      // Check for cycles: parent can't be a descendant of this new node (n/a for create), but check parent isn't a child of itself impossible
    }

    const created = await tx.glAccount.create({
      data: { tenantId, code, name, kind: input.kind, nature: input.nature, synthetic: input.synthetic, parentId: input.parentId ?? null, isActive: true },
    });
    await recordAudit(actorUserId, tenantId, created.id, 'CREATE', null, { code, name, kind: input.kind, nature: input.nature, synthetic: input.synthetic, parentId: input.parentId ?? null });
    revalidatePath('/contabilidade/plano-contas');
    return created;
  });
}

export async function updateAccount(accountId: string, input: { name?: string; kind?: string; nature?: string; synthetic?: boolean; parentId?: string | null }) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;

  return runWithTenant(tenantId, async (tx) => {
    const existing = await tx.glAccount.findFirst({ where: { tenantId, id: accountId } });
    if (!existing) throw new Error('ACCOUNT_NOT_FOUND');
    if (input.kind && !['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].includes(input.kind)) throw new Error('INVALID_KIND');
    if (input.nature && !['DEBIT', 'CREDIT'].includes(input.nature)) throw new Error('INVALID_NATURE');

    // Validate parent (cycle prevention)
    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === accountId) throw new Error('PARENT_IS_SELF');
      // Walk up ancestry from parentId to ensure no cycle through this node
      let cursor: string | null = input.parentId;
      const ancestors = new Set<string>();
      while (cursor) {
        if (ancestors.has(cursor)) throw new Error('CYCLE_DETECTED');
        ancestors.add(cursor);
        if (cursor === accountId) throw new Error('CYCLE_DETECTED');
        const parent: any = await tx.glAccount.findFirst({ where: { tenantId, id: cursor } });
        cursor = parent?.parentId ?? null;
      }
    }

    const data: any = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.kind !== undefined) data.kind = input.kind;
    if (input.nature !== undefined) data.nature = input.nature;
    if (input.synthetic !== undefined) data.synthetic = input.synthetic;
    if (input.parentId !== undefined) data.parentId = input.parentId;

    const updated = await tx.glAccount.update({ where: { tenantId_id: { tenantId, id: accountId } }, data });
    await recordAudit(actorUserId, tenantId, accountId, 'UPDATE', existing, updated);
    revalidatePath('/contabilidade/plano-contas');
    return updated;
  });
}

export async function deactivateAccount(accountId: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;

  return runWithTenant(tenantId, async (tx) => {
    const existing = await tx.glAccount.findFirst({ where: { tenantId, id: accountId } });
    if (!existing) throw new Error('ACCOUNT_NOT_FOUND');
    const inUse = await hasPostedEntries(tenantId, accountId);
    if (inUse) {
      // Preserve history: allowed to inactivate even with entries, but cannot delete
      await tx.glAccount.update({ where: { tenantId_id: { tenantId, id: accountId } }, data: { isActive: false } });
      await recordAudit(actorUserId, tenantId, accountId, 'DEACTIVATE_WITH_ENTRIES', existing, { ...existing, isActive: false });
      revalidatePath('/contabilidade/plano-contas');
      return { ok: true, action: 'inactivated-only' };
    }
    const children = await hasChildren(tenantId, accountId);
    if (children) throw new Error('ACCOUNT_HAS_CHILDREN_DEACTIVATE_FIRST');
    await tx.glAccount.update({ where: { tenantId_id: { tenantId, id: accountId } }, data: { isActive: false } });
    await recordAudit(actorUserId, tenantId, accountId, 'DEACTIVATE', existing, { ...existing, isActive: false });
    revalidatePath('/contabilidade/plano-contas');
    return { ok: true, action: 'inactivated' };
  });
}
