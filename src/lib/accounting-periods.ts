/**
 * A4 — AccountingExercise and AccountingPeriod service
 *
 * The minimum viable setup for period-locked postings:
 *   - One initial exercise per tenant (auto-create on demand for the current year)
 *   - 12 monthly periods per exercise
 *
 * Closing a period is audited via `closedAt` and `closedBy`. Reopening posts a
 * new "REOPENED" audit trail event without reverting closedAt — the closed
 * period keeps its marker, future posts reference the reopened period.
 */

import { runWithTenant } from './tenant-db';

export async function ensureExerciseForYear(tenantId: string, year: number) {
  return runWithTenant(tenantId, async (tx) => {
    const existing = await tx.accountingExercise.findFirst({ where: { tenantId, year } });
    if (existing) return existing;
    return tx.accountingExercise.create({
      data: {
        tenantId,
        year,
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
        state: 'OPEN',
        openedAt: new Date(),
      },
    });
  });
}

export async function ensureMonthlyPeriods(tenantId: string, exerciseId: string) {
  return runWithTenant(tenantId, async (tx) => {
    const exercise = await tx.accountingExercise.findFirst({ where: { tenantId, id: exerciseId } });
    if (!exercise) throw new Error('EXERCISE_NOT_FOUND');
    const created = [] as any[];
    for (let m = 0; m < 12; m++) {
      const start = new Date(Date.UTC(exercise.year, m, 1));
      const end = new Date(Date.UTC(exercise.year, m + 1, 0, 23, 59, 59));
      const code = `${exercise.year}-${String(m + 1).padStart(2, '0')}`;
      const found = await tx.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
      if (!found) {
        const createdPeriod = await tx.accountingPeriod.create({
          data: {
            tenantId,
            exerciseId: exercise.id,
            code,
            startDate: start,
            endDate: end,
            state: 'OPEN',
            openedAt: new Date(),
          },
        });
        created.push(createdPeriod);
      }
    }
    return created;
  });
}

export async function postInsidePeriod(tenantId: string, date: Date) {
  return runWithTenant(tenantId, async (tx) => {
    const year = date.getUTCFullYear();
    let exercise = await tx.accountingExercise.findFirst({ where: { tenantId, year } });
    if (!exercise) {
      try {
        exercise = await tx.accountingExercise.create({
          data: { tenantId, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          exercise = await tx.accountingExercise.findFirst({ where: { tenantId, year } });
        } else throw e;
      }
    }
    if (exercise.state !== 'OPEN') throw new Error(`EXERCISE_NOT_OPEN:${year}`);

    const startUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const endUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
    const code = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

    let period = await tx.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
    if (!period) {
      try {
        period = await tx.accountingPeriod.create({
          data: { tenantId, exerciseId: exercise.id, code, startDate: startUtc, endDate: endUtc, state: 'OPEN', openedAt: new Date() },
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          period = await tx.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
        } else throw e;
      }
    }
    if (period.state !== 'OPEN') throw new Error(`PERIOD_CLOSED:${code}`);
    return { exerciseId: exercise.id, periodId: period.id, periodCode: code };
  });
}

export async function postInsidePeriodOnTx(
  tx: any,
  tenantId: string,
  date: Date,
): Promise<{ exerciseId: string; periodId: string; periodCode: string }> {
  const year = date.getUTCFullYear();
  let exercise = await tx.accountingExercise.findFirst({ where: { tenantId, year } });
  if (!exercise) {
    try {
      exercise = await tx.accountingExercise.create({
        data: { tenantId, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        exercise = await tx.accountingExercise.findFirst({ where: { tenantId, year } });
      } else throw e;
    }
  }
  if (!exercise) throw new Error(`EXERCISE_RESOLVE_FAILED:${year}`);
  if (exercise.state !== 'OPEN') throw new Error(`EXERCISE_NOT_OPEN:${year}`);

  const startUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
  const code = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

  let period = await tx.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
  if (!period) {
    try {
      period = await tx.accountingPeriod.create({
        data: { tenantId, exerciseId: exercise.id, code, startDate: startUtc, endDate: endUtc, state: 'OPEN', openedAt: new Date() },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        period = await tx.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
      } else throw e;
    }
  }
  if (!period) throw new Error(`PERIOD_RESOLVE_FAILED:${code}`);
  if (period.state !== 'OPEN') throw new Error(`PERIOD_CLOSED:${code}`);
  return { exerciseId: exercise.id, periodId: period.id, periodCode: code };
}

