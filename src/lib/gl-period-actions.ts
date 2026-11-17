/**
 * A5 — Server-side actions for accounting periods (open/close/reopen)
 *
 * Operators (contabilistas) interact via these inside the dashboard UI.
 * The companion client page enforces confirmation + audit log entries.
 */

'use server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { runWithTenant } from '@/lib/tenant-db';
import { getSessionTenantId } from '@/lib/session';
import { ensureExerciseForYear, ensureMonthlyPeriods } from './accounting-periods';

const audit = async (
  tx: any,
  tenantId: string,
  actorUserId: string | null,
  action: string,
  target: string,
  justification: string | null,
) => {
  // Include a no-op ModelTap to satisfy future audit infra
  // For now record into GlAccountHistory-like table via BusinessDocumentEvent-pattern isn't ideal;
  // we persist into JournalEntry-style audit via raw SQL? Skipping for now — log to console.
  console.log('[AUDIT]', { tenantId, action, target, justification, actorUserId });
};

export async function createExercise(year: number) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  return ensureExerciseForYear(tenantId, year);
}

export async function closeExercise(exerciseId: string, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 5) throw new Error('Motivo obrigatório para fechar o exercício.');

  return runWithTenant(tenantId, async (tx) => {
    // Pre-flight: verify balance — fetch all JE lines and check debit == credit
    const lines: { debit: number; credit: number }[] = await (tx as any).$queryRawUnsafe(
      `SELECT COALESCE(SUM(l."debit"),0)::float AS debit, COALESCE(SUM(l."credit"),0)::float AS credit FROM "JournalEntryLine" l WHERE l."tenantId" = $1`,
      tenantId,
    );
    const totalD = Number(lines[0]?.debit ?? 0);
    const totalC = Number(lines[0]?.credit ?? 0);
    if (Math.abs(totalD - totalC) > 0.01) {
      throw new Error(`Exercício com diferença de ${totalD - totalC}. Contacte o contabilista antes de fechar.`);
    }

    const ex = await tx.accountingExercise.update({
      where: { tenantId_id: { tenantId, id: exerciseId } } as any,
      data: { state: 'CLOSED', closedAt: new Date(), closedBy: actorUserId },
    });
    await audit(tx, tenantId, actorUserId, 'EXERCISE_CLOSED', exerciseId, justification);
    revalidatePath('/contabilidade');
    return ex;
  });
}

export async function closePeriod(periodId: string, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 5) throw new Error('Motivo obrigatório para fechar o período.');

  return runWithTenant(tenantId, async (tx) => {
    const period = await tx.accountingPeriod.update({
      where: { tenantId_id: { tenantId, id: periodId } } as any,
      data: { state: 'CLOSED', closedAt: new Date(), closedBy: actorUserId },
    });
    await audit(tx, tenantId, actorUserId, 'PERIOD_CLOSED', periodId, justification);
    revalidatePath('/contabilidade');
    return period;
  });
}

export async function reopenPeriod(periodId: string, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 10) throw new Error('Motivo obrigatório (mín. 10 caracteres) para reabrir o período.');

  return runWithTenant(tenantId, async (tx) => {
    const period = await tx.accountingPeriod.update({
      where: { tenantId_id: { tenantId, id: periodId } } as any,
      data: { state: 'OPEN', openedAt: new Date(), openedBy: actorUserId },
    });
    await audit(tx, tenantId, actorUserId, 'PERIOD_REOPENED', periodId, justification);
    revalidatePath('/contabilidade');
    return period;
  });
}
