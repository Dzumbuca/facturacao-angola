'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSessionTenantId } from '@/lib/session';
import { apurarResultado, abrirProximoExercicio } from '@/lib/gl-exercise-closing';
import { preValidateExercise } from './gl-exercise-precheck';

// A11 — in-process gates for apuramento/opening per exercise per tenant.
// Complements the JE source/sourceId unique constraint (DB-level).
const closeLocks = new Map<string, Promise<any>>();
const openLocks = new Map<string, Promise<any>>();

export async function closeExerciseAndApurar(exerciseId: string, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 10) throw new Error('Motivo obrigatório (mín. 10 caracteres).');

  const lockKey = `${tenantId}:close:${exerciseId}`;
  const previous = closeLocks.get(lockKey);
  if (previous) { try { await previous; } catch { /* previous settled */ } }

  const myLock = (async () => {
    const exercise = await prisma.accountingExercise.findFirst({
      where: { tenantId, id: exerciseId },
      select: { year: true },
    });
    if (!exercise) throw new Error('EXERCISE_NOT_FOUND');
    const year = exercise.year;

    const blockers = (await preValidateExercise(tenantId, year)).filter((b: any) => b.severity === 'BLOCKER');
    if (blockers.length > 0) {
      throw new Error(`Exercício tem ${blockers.length} bloqueador(es): ${blockers.slice(0, 3).map((b: any) => b.code).join(', ')}`);
    }

    const result = await apurarResultado(tenantId, year, actorUserId, justification);
    revalidatePath('/contabilidade');
    return result;
  })();
  closeLocks.set(lockKey, myLock);
  try { return await myLock; } finally { closeLocks.delete(lockKey); }
}

export async function openNextExercise(nextYear: number, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 10) throw new Error('Motivo obrigatório (mín. 10 caracteres).');

  const lockKey = `${tenantId}:open:${nextYear}`;
  const previous = openLocks.get(lockKey);
  if (previous) { try { await previous; } catch { /* previous settled */ } }

  const myLock = abrirProximoExercicio(tenantId, nextYear, justification, actorUserId);
  openLocks.set(lockKey, myLock);
  try { return await myLock; } finally { openLocks.delete(lockKey); }
}
