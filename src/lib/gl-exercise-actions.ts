'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSessionTenantId } from '@/lib/session';
import { apurarResultado, abrirProximoExercicio } from '@/lib/gl-exercise-closing';
import { preValidateExercise } from './gl-exercise-precheck';

export async function closeExerciseAndApurar(exerciseId: string, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 10) throw new Error('Motivo obrigatório (mín. 10 caracteres).');

  const exercise = await prisma.accountingExercise.findFirst({
    where: { tenantId, id: exerciseId },
    select: { year: true },
  });
  if (!exercise) throw new Error('EXERCISE_NOT_FOUND');
  const year = exercise.year;

  // Pre-validation first
  const blockers = (await preValidateExercise(tenantId, year)).filter((b: any) => b.severity === 'BLOCKER');
  if (blockers.length > 0) {
    throw new Error(`Exercício tem ${blockers.length} bloqueador(es): ${blockers.slice(0, 3).map((b: any) => b.code).join(', ')}`);
  }

  const result = await apurarResultado(tenantId, year, actorUserId, justification);
  revalidatePath('/contabilidade');
  return result;
}

export async function openNextExercise(nextYear: number, justification: string) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) throw new Error('Not authenticated.');
  const session = await auth();
  const actorUserId = (session?.user as any)?.id ?? null;
  if (!justification || justification.trim().length < 10) throw new Error('Motivo obrigatório (mín. 10 caracteres).');

  return abrirProximoExercicio(tenantId, nextYear, justification, actorUserId);
}
