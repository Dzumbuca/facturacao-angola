/**
 * A10 — Retained earnings cycle test
 *
 * Proves the full cycle: activity → apuramento → closure → opening.
 * Verifies the result is purified into the destination EQUITY account, then
 * carried into the next exercise's opening entry.
 *
 * Uses disposable PG.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { apurarResultado, abrirProximoExercicio } from './gl-exercise-closing';
import { postJournalEntry } from './gl-service';

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

describeIfDisposable('A10 — Retained earnings cycle', () => {
  let tenantId = '';
  let year = 0;

  beforeAll(async () => {
    if (!prisma) return;
    const suffix = Date.now().toString();
    tenantId = `a10-re-${suffix}`;
    year = new Date().getUTCFullYear();
    await prisma!.tenant.create({ data: { id: tenantId, name: `A10 RE ${suffix}`, plan: 'PRO', status: 'ACTIVE' } });
    // Create chart: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE
    await prisma!.glAccount.createMany({ data: [
      { tenantId, code: '1000', name: 'Caixa', kind: 'ASSET', nature: 'DEBIT', synthetic: false, isActive: true },
      { tenantId, code: '1200', name: 'Contas a receber', kind: 'ASSET', nature: 'DEBIT', synthetic: false, isActive: true },
      { tenantId, code: '2000', name: 'Contas a pagar', kind: 'LIABILITY', nature: 'CREDIT', synthetic: false, isActive: true },
      { tenantId, code: '3000', name: 'Capital social', kind: 'EQUITY', nature: 'CREDIT', synthetic: false, isActive: true },
      { tenantId, code: '4000', name: 'Vendas', kind: 'REVENUE', nature: 'CREDIT', synthetic: false, isActive: true },
      { tenantId, code: '5000', name: 'CMV', kind: 'EXPENSE', nature: 'DEBIT', synthetic: false, isActive: true },
    ] as any,
    });
    // Exercise + close periods
    const exercise = await prisma!.accountingExercise.upsert({
      where: { tenantId_year: { tenantId, year } },
      create: { tenantId, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
      update: {},
    });
    // Create January + one more so we can post
    const code = `${year}-01`;
    const exists = await prisma!.accountingPeriod.findFirst({ where: { tenantId, exerciseId: exercise.id, code } });
    if (!exists) {
      await prisma!.accountingPeriod.create({
        data: { tenantId, exerciseId: exercise.id, code, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 0, 31, 23, 59, 59)), state: 'OPEN', openedAt: new Date() },
      });
    }
    // Post activity: revenue 1,000,000 C; expense 400,000 D
    await postJournalEntry(tenantId, {
      description: 'Venda A10 teste',
      source: 'TEST',
      sourceId: `${tenantId}-rev`,
      lines: [
        { accountCode: '1200', debit: 1_000_000 },
        { accountCode: '4000', credit: 1_000_000 },
      ],
    });
    await postJournalEntry(tenantId, {
      description: 'CMV A10 teste',
      source: 'TEST',
      sourceId: `${tenantId}-exp`,
      lines: [
        { accountCode: '5000', debit: 400_000 },
        { accountCode: '1000', credit: 400_000 },
      ],
    });
    // Close all periods so we can apurar
    await prisma!.accountingPeriod.updateMany({
      where: { tenantId, exerciseId: exercise.id },
      data: { state: 'CLOSED', closedAt: new Date() },
    });
  }, 60000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('apurar purifica o resultado para a conta de EQUITY e a abertura carrega-o', async () => {
    const r1 = await apurarResultado(tenantId, year, null, 'A10 apuramento test');
    expect(r1.totalRevenue).toBeCloseTo(1_000_000, 1);
    expect(r1.totalExpenses).toBeCloseTo(400_000, 1);
    expect(r1.resultBeforeApuramento).toBeCloseTo(600_000, 1);

    // Check the destination equity account carries the result
    const equity3000 = await prisma!.glAccount.findFirst({ where: { tenantId, code: '3000' } });
    const equityLines = await prisma!.journalEntryLine.findMany({
      where: { tenantId, accountId: equity3000!.id },
    });
    const equityNet = equityLines.reduce((s: number, l: any) => s + Number(l.credit) - Number(l.debit), 0);
    expect(equityNet).toBeCloseTo(600_000, 1);

    // Open next exercise
    const open = await abrirProximoExercicio(tenantId, year + 1, 'Abertura A10 test', null);
    expect(open.openingEntries).toBeGreaterThan(0);

    // Verify the opening JE carries the equity account balance forward
    const openingJE = await prisma!.journalEntry.findFirst({
      where: { tenantId, source: 'EXERCISE_OPEN' },
      include: { lines: true },
    });
    expect(openingJE).toBeDefined();
    const openingEquityLine = openingJE!.lines.find((l: any) => l.accountId === equity3000!.id);
    expect(openingEquityLine).toBeDefined();
    expect(Number(openingEquityLine.credit)).toBeCloseTo(600_000, 1);
  }, 60000);
});
