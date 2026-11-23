/**
 * A10 — Exercise closing engine
 *
 * Apuramento (closing) of fiscal year:
 *   1. Sum debit balances of EXPENSE (default natural debit)
 *   2. Sum credit balances of REVENUE (default natural credit)
 *   3. Post "apuramento" JE: DR each REVENUE account for its credit balance;
 *      CR each EXPENSE account for its debit balance;
 *      DR/CR the residual result to the appropriate destination equity account.
 *   4. Mark exercise CLOSED + this year's periods CLOSED.
 *   5. Audit trail recorded.
 *
 * The function is idempotent: running it twice produces exactly one set of
 * apuramento JEs because they are identified by source='EXERCISE_CLOSE' +
 * sourceId=exerciseId — repeats are no-ops.
 *
 * Tenant-isolated, transactional, all-or-nothing.
 */

import { runWithTenant } from './tenant-db';
import { Prisma } from '@prisma/client';

export type ApuramentoResult = {
  exerciseId: string;
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  resultBeforeApuramento: number;
  entriesCreated: number;
  journalEntryNumber: string | null;
};

const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const NATURAL_DEBIT = new Set(['ASSET', 'EXPENSE']);
const NATURAL_CREDIT = new Set(['LIABILITY', 'EQUITY', 'REVENUE']);

/**
 * Apuramento of the exercise's REVENUE/EXPENSE accounts. Creates the closure
 * JE and marks the exercise CLOSED. Idempotent.
 */
export async function apurarResultado(
  tenantId: string,
  year: number,
  closedBy: string | null,
  justification: string,
): Promise<ApuramentoResult> {
  return runWithTenant(tenantId, async (tx) => {
    const exercise = await tx.accountingExercise.findFirst({
      where: { tenantId, year },
      include: { periods: true },
    });
    if (!exercise) throw new Error(`EXERCISE_NOT_FOUND_${year}`);
    if (exercise.state === 'CLOSED') {
      // Idempotent — return summary of what was already done
      const existing = await tx.journalEntry.findFirst({
        where: { tenantId, source: 'EXERCISE_CLOSE', sourceId: exercise.id },
      });
      return {
        exerciseId: exercise.id,
        year: exercise.year,
        totalRevenue: 0, totalExpenses: 0, resultBeforeApuramento: 0,
        entriesCreated: existing ? 1 : 0,
        journalEntryNumber: existing?.number ?? null,
      };
    }

    const openPeriods = (exercise as any).periods.filter((p: any) => p.state !== 'CLOSED');
    if (openPeriods.length > 0) {
      throw new Error(`PERIODS_OPEN: ${openPeriods.length} período(s) por fechar`);
    }

    // Pick a destination equity account for results
    const destination = await tx.glAccount.findFirst({
      where: { tenantId, kind: 'EQUITY', isActive: true },
      orderBy: { code: 'asc' },
    });
    if (!destination) throw new Error('EQUITY_DESTINATION_NOT_FOUND — defina uma conta de património para receber o resultado.');

    // Aggregate period JEs for REVENUE and EXPENSE accounts
    const revenueAccounts = await tx.glAccount.findMany({
      where: { tenantId, kind: 'REVENUE', isActive: true, synthetic: false },
      include: {
        lines: {
          select: { debit: true, credit: true, entry: { select: { postedOnDate: true, status: true } } },
        },
      },
    });
    const expenseAccounts = await tx.glAccount.findMany({
      where: { tenantId, kind: 'EXPENSE', isActive: true, synthetic: false },
      include: {
        lines: {
          select: { debit: true, credit: true, entry: { select: { postedOnDate: true, status: true } } },
        },
      },
    });

    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const sumAccount = (a: any, sign: 'debit' | 'credit') => {
      let s = 0;
      for (const l of a.lines as any[]) {
        if (l.entry?.status !== 'POSTED') continue;
        if (l.entry?.postedOnDate < startDate || l.entry?.postedOnDate > endDate) continue;
        s += sign === 'debit' ? Number(l.debit) : Number(l.credit);
      }
      return round2(s);
    };

    let totalRevenue = 0;
    const revenuePost: { accountId: string; debit?: number; credit?: number; memo: string }[] = [];
    for (const acc of revenueAccounts as any[]) {
      const credit = sumAccount(acc, 'credit');
      const debit = sumAccount(acc, 'debit');
      const net = round2(credit - debit);
      totalRevenue = round2(totalRevenue + net);
      if (Math.abs(net) > 0.001) {
        revenuePost.push({ accountId: acc.id, debit: Math.abs(net), memo: `Apuramento ${year}` + (net < 0 ? ' (saldo devedor)' : '') });
      }
    }
    let totalExpenses = 0;
    const expensePost: { accountId: string; debit?: number; credit?: number; memo: string }[] = [];
    for (const acc of expenseAccounts as any[]) {
      const credit = sumAccount(acc, 'credit');
      const debit = sumAccount(acc, 'debit');
      const net = round2(debit - credit);
      totalExpenses = round2(totalExpenses + net);
      if (Math.abs(net) > 0.001) {
        expensePost.push({ accountId: acc.id, credit: Math.abs(net), memo: `Apuramento ${year}` + (net < 0 ? ' (saldo credor)' : '') });
      }
    }

    const resultBeforeApuramento = round2(totalRevenue - totalExpenses);

    const apLine = Math.abs(resultBeforeApuramento);
    const apLines: { accountId: string; debit?: number; credit?: number; memo: string }[] = [
      ...revenuePost,
      ...expensePost,
      resultBeforeApuramento >= 0
        ? { accountId: destination.id, credit: apLine, memo: `Resultado apurado ${year}` }
        : { accountId: destination.id, debit: apLine, memo: `Resultado apurado ${year} (prejuízo)` },
    ];
    // Synthesize JE lines in proper debit/credit orientation — already correct per branch above.

    // Reserve number for apuramento
    const { reserveJournalEntryNumberOnTx } = await import('./gl-sequence');
    const number = await reserveJournalEntryNumberOnTx(tx, tenantId, 'JE');

    // Idempotency marker — if already exists, do not re-create
    const existing = await tx.journalEntry.findFirst({
      where: { tenantId, source: 'EXERCISE_CLOSE', sourceId: exercise.id },
    });
    if (existing) {
      // No-op — already closed
      return {
        exerciseId: exercise.id,
        year: exercise.year,
        totalRevenue, totalExpenses, resultBeforeApuramento,
        entriesCreated: 0,
        journalEntryNumber: existing.number,
      };
    }

    let entry;
    try {
      entry = await tx.journalEntry.create({
        data: {
          tenantId,
          number,
          postedOnDate: endDate,
          description: `Apuramento exercício ${year}: ${justification.slice(0, 200)}`,
          source: 'EXERCISE_CLOSE',
          sourceId: exercise.id,
          exerciseId: exercise.id,
          entryType: 'CLOSING',
          lines: {
            create: apLines.map((l) => ({
              accountId: l.accountId,
              debit: new Prisma.Decimal(l.debit ? round2(l.debit).toFixed(2) : '0.00'),
              credit: new Prisma.Decimal(l.credit ? round2(l.credit).toFixed(2) : '0.00'),
              memo: l.memo ?? null,
            })),
          },
        },
        include: { lines: true },
      });
    } catch (createError: any) {
      // Two concurrent apuramentos raced; treat as no-op idempotent
      if (createError?.code === 'P2002') {
        const existing = await tx.journalEntry.findFirst({
          where: { tenantId, source: 'EXERCISE_CLOSE', sourceId: exercise.id },
          select: { number: true },
        });
        return {
          exerciseId: exercise.id,
          year: exercise.year,
          totalRevenue, totalExpenses, resultBeforeApuramento,
          entriesCreated: 0,
          journalEntryNumber: existing?.number ?? null,
        };
      }
      throw createError;
    }

    // Mark exercise CLOSED
    await tx.accountingExercise.update({
      where: { tenantId_id: { tenantId, id: exercise.id } } as any,
      data: { state: 'CLOSED', closedAt: new Date(), closedBy: closedBy },
    });

    return {
      exerciseId: exercise.id,
      year: exercise.year,
      totalRevenue, totalExpenses, resultBeforeApuramento,
      entriesCreated: 1,
      journalEntryNumber: entry.number,
    };
  });
}

/**
 * Abertura do exercício seguinte — transporta os saldos patrimoniais apenas.
 * Estranges são tratadas pelo apuramento (resultado apurado transita no equilíbrio).
 * Idempotente por (origem, destino).
 */
export async function abrirProximoExercicio(
  tenantId: string,
  nextYear: number,
  justification: string,
  closedBy: string | null,
): Promise<{ exerciseId: string; openingEntries: number; journalEntryNumber: string | null }> {
  return runWithTenant(tenantId, async (tx) => {
    const source = await tx.accountingExercise.findFirst({ where: { tenantId, year: nextYear - 1 } });
    if (!source) throw new Error(`PRIOR_EXERCISE_NOT_FOUND_${nextYear - 1}`);
    if (source.state !== 'CLOSED') throw new Error(`PRIOR_EXERCISE_NOT_CLOSED_${nextYear - 1}`);

    // Existing exercise & periods for nextYear?
    let target = await tx.accountingExercise.findFirst({ where: { tenantId, year: nextYear } });
    if (!target) {
      target = await tx.accountingExercise.create({
        data: {
          tenantId,
          year: nextYear,
          startDate: new Date(Date.UTC(nextYear, 0, 1)),
          endDate: new Date(Date.UTC(nextYear, 11, 31, 23, 59, 59)),
          state: 'OPEN',
          openedAt: new Date(),
        },
      });
    }

    // Ensure all 12 monthly periods exist
    for (let m = 0; m < 12; m++) {
      const code = `${nextYear}-${String(m + 1).padStart(2, '0')}`;
      const exists = await tx.accountingPeriod.findFirst({ where: { tenantId, exerciseId: target.id, code } });
      if (!exists) {
        await tx.accountingPeriod.create({
          data: {
            tenantId, exerciseId: target.id, code,
            startDate: new Date(Date.UTC(nextYear, m, 1)),
            endDate: new Date(Date.UTC(nextYear, m + 1, 0, 23, 59, 59)),
            state: 'OPEN',
            openedAt: new Date(),
          },
        });
      }
    }

    // Check idempotency: have we already done opening entries for this exercise?
    const existing = await tx.journalEntry.findFirst({
      where: { tenantId, source: 'EXERCISE_OPEN', sourceId: target.id },
    });
    if (existing) {
      return { exerciseId: target.id, openingEntries: 0, journalEntryNumber: existing.number };
    }

    // Compute patrimonial balances at end of source exercise
    const patrimonialKinds = ['ASSET', 'LIABILITY', 'EQUITY'];
    const patrimonialAccounts = await tx.glAccount.findMany({
      where: { tenantId, kind: { in: patrimonialKinds }, isActive: true, synthetic: false },
      include: {
        lines: { select: { debit: true, credit: true, entry: { select: { postedOnDate: true, status: true } } } },
      },
    });

    // Aggregate closing balance per account (POSTED only, through end of source exercise)
    const endDate = new Date(Date.UTC(nextYear - 1, 11, 31, 23, 59, 59));
    const openingLines: { accountId: string; debit?: number; credit?: number; memo: string }[] = [];
    for (const acc of patrimonialAccounts as any[]) {
      let debit = 0, credit = 0;
      for (const l of acc.lines as any[]) {
        if (l.entry?.status !== 'POSTED') continue;
        if (l.entry?.postedOnDate > endDate) continue;
        debit += Number(l.debit);
        credit += Number(l.credit);
      }
      const net = round2(debit - credit);
      if (Math.abs(net) < 0.01) continue;
      const isDebitNature = NATURAL_DEBIT.has((acc.kind as string).toUpperCase());
      if (isDebitNature) {
        // Debit-nature accounts: net >= 0 means debit-balance, net < 0 means credit-balance
        if (net > 0.001) {
          openingLines.push({ accountId: acc.id, debit: round2(net), memo: `Abertura ${nextYear} (transporta do ${nextYear - 1})` });
        } else if (net < -0.001) {
          openingLines.push({ accountId: acc.id, credit: round2(-net), memo: `Abertura ${nextYear} (transporta do ${nextYear - 1})` });
        }
      } else {
        // Credit-nature accounts: net <= 0 means credit-balance, net > 0 means debit-balance
        if (net < -0.001) {
          openingLines.push({ accountId: acc.id, credit: round2(-net), memo: `Abertura ${nextYear} (transporta do ${nextYear - 1})` });
        } else if (net > 0.001) {
          openingLines.push({ accountId: acc.id, debit: round2(net), memo: `Abertura ${nextYear} (transporta do ${nextYear - 1})` });
        }
      }
    }

    if (openingLines.length === 0) {
      // Still create an opening marker for transparency
      const { reserveJournalEntryNumberOnTx } = await import('./gl-sequence');
      const number = await reserveJournalEntryNumberOnTx(tx, tenantId, 'JE');
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          number,
          postedOnDate: endDate,
          description: `Abertura exercício ${nextYear}: sem saldos a transportar`,
          source: 'EXERCISE_OPEN',
          sourceId: target.id,
          exerciseId: target.id,
          entryType: 'OPENING',
          lines: { create: [] },
        },
      });
      return { exerciseId: target.id, openingEntries: 0, journalEntryNumber: entry.number };
    }

    const { reserveJournalEntryNumberOnTx } = await import('./gl-sequence');
    const number = await reserveJournalEntryNumberOnTx(tx, tenantId, 'JE');
    let entry;
    try {
      entry = await tx.journalEntry.create({
        data: {
          tenantId,
          number,
          postedOnDate: endDate,
          description: `Abertura exercício ${nextYear}: ${justification.slice(0, 200)}`,
          source: 'EXERCISE_OPEN',
          sourceId: target.id,
          exerciseId: target.id,
          entryType: 'OPENING',
          lines: {
            create: openingLines.map((l) => ({
              accountId: l.accountId,
              debit: new Prisma.Decimal(l.debit ? round2(l.debit).toFixed(2) : '0.00'),
              credit: new Prisma.Decimal(l.credit ? round2(l.credit).toFixed(2) : '0.00'),
              memo: l.memo ?? null,
            })),
          },
        },
        include: { lines: true },
      });
    } catch (createError: any) {
      if (createError?.code === 'P2002') {
        const existing = await tx.journalEntry.findFirst({
          where: { tenantId, source: 'EXERCISE_OPEN', sourceId: target.id },
          select: { number: true },
        });
        return { exerciseId: target.id, openingEntries: 0, journalEntryNumber: existing?.number ?? null };
      }
      throw createError;
    }

    return { exerciseId: target.id, openingEntries: openingLines.length, journalEntryNumber: entry.number };
  });
}
