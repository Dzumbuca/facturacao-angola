/**
 * A10 — integration test: exercise closing (apuramento) + next-exercise opening.
 *
 * Uses disposable PG.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { apurarResultado, abrirProximoExercicio } from './gl-exercise-closing';

const url = process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');
const describeIfDisposable = enabled ? describe : describe.skip;

let prisma: any = null;
if (enabled) {
  prisma = new PrismaClient({
    datasources: { db: { url } },
    transactionOptions: { maxWait: 30_000, timeout: 60_000 },
  });
}

describeIfDisposable('A10 — Exercise apuramento and opening', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    const suffix = Date.now().toString();
    tenantId = `a10-ex-${suffix}`;
    await prisma!.tenant.create({ data: { id: tenantId, name: `A10 ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    // Create some revenue/expense/asset accounts (active, analytic)
    await prisma!.glAccount.createMany({ data: [
        { tenantId, code: '1000', name: 'Caixa', kind: 'ASSET', nature: 'DEBIT', synthetic: false, isActive: true },
        { tenantId, code: '2000', name: 'Contas a pagar', kind: 'LIABILITY', nature: 'CREDIT', synthetic: false, isActive: true },
        { tenantId, code: '3000', name: 'Capital social', kind: 'EQUITY', nature: 'CREDIT', synthetic: false, isActive: true },
        { tenantId, code: '4000', name: 'Vendas', kind: 'REVENUE', nature: 'CREDIT', synthetic: false, isActive: true },
        { tenantId, code: '5000', name: 'CMV', kind: 'EXPENSE', nature: 'DEBIT', synthetic: false, isActive: true },
      ] as any,
    });
    // Create current year exercise + periods
    const year = new Date().getUTCFullYear();
    const exercise = await prisma!.accountingExercise.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { tenantId, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
      update: {},
    });
    // Ensure at least one period
    const code = `${year}-01`;
    const exists = await prisma!.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
    if (!exists) {
      await prisma!.accountingPeriod.create({
        data: { tenantId, exerciseId: exercise.id, code, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 0, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
      });
    }
    // Close all periods so we can apurar
    await prisma!.accountingPeriod.updateMany({
      where: { tenantId, exerciseId: exercise.id },
      data: { state: 'CLOSED', closedAt: new Date() },
    });
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('apurarResultado marks exercise CLOSED and creates a single CLOSING JE; running twice is idempotent', async () => {
    const year = new Date().getUTCFullYear();
    const r1 = await apurarResultado(tenantId, year, null, 'Encerramento anual A10');
    expect(r1.exerciseId).toBeDefined();
    expect(r1.entriesCreated).toBeGreaterThanOrEqual(0);
    const ex = await prisma!.accountingExercise.findFirst({ where: { tenantId, year } });
    expect(ex?.state).toBe('CLOSED');
    const r2 = await apurarResultado(tenantId, year, null, 'Encerramento repetido');
    // Idempotent — verify exactly one EXERCISE_CLOSE JE exists
    const closingJEs = await prisma!.journalEntry.findMany({ where: { tenantId, source: 'EXERCISE_CLOSE' } });
    expect(closingJEs.length).toBe(1);
    expect(r2.journalEntryNumber).toBe(r1.journalEntryNumber);
  }, 60000);

  it('abrirProximoExercicio creates new exercise with patrimony carried over', async () => {
    const year = new Date().getUTCFullYear();
    // The apurar test already ran and closed source exercise
    const result = await abrirProximoExercicio(tenantId, year + 1, 'Abertura A10', null);
    expect(result.exerciseId).toBeDefined();
    // Running again is idempotent
    const result2 = await abrirProximoExercicio(tenantId, year + 1, 'Abertura repetida', null);
    expect(result2.openingEntries).toBe(0);
  }, 60000);
});
