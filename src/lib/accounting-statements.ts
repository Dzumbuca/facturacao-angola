/**
 * A10 — Computed statements (Balanço / DRE) per exercise from the ledger.
 *
 * Shared by the statements page and the PDF/CSV export routes, so both
 * present the same values.
 */

import { prisma } from './prisma';

export type StatementTotals = {
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expenses: number;
  result: number;
  balanceOK: boolean;
};

const NATURAL_DEBIT = new Set(['ASSET', 'EXPENSE']);

export async function computeStatements(tenantId: string, exerciseYear: number): Promise<StatementTotals> {
  const accounts = await prisma.glAccount.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, kind: true, synthetic: true },
  });
  const start = new Date(Date.UTC(exerciseYear, 0, 1));
  const end = new Date(Date.UTC(exerciseYear, 11, 31, 23, 59, 59));

  const periodLines = await prisma.journalEntryLine.findMany({
    where: { tenantId, entry: { status: 'POSTED', postedOnDate: { gte: start, lte: end } } },
    select: { accountId: true, debit: true, credit: true },
  });
  const openingLines = await prisma.journalEntryLine.findMany({
    where: { tenantId, entry: { status: 'POSTED', postedOnDate: { lt: start } } },
    select: { accountId: true, debit: true, credit: true },
  });

  const periodMap = new Map<string, { debit: number; credit: number }>();
  for (const l of periodLines) {
    const cur = periodMap.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    periodMap.set(l.accountId, cur);
  }
  const openingMap = new Map<string, { debit: number; credit: number }>();
  for (const l of openingLines) {
    const cur = openingMap.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += Number(l.debit); cur.credit += Number(l.credit);
    openingMap.set(l.accountId, cur);
  }

  let assets = 0, liabilities = 0, equity = 0, revenue = 0, expenses = 0;
  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

  for (const a of accounts as any[]) {
    if (a.synthetic) continue;
    const kind = String(a.kind ?? '').toUpperCase();
    const naturalDebit = NATURAL_DEBIT.has(kind);
    const op = (openingMap.get(a.id)?.debit ?? 0) - (openingMap.get(a.id)?.credit ?? 0);
    const p = (periodMap.get(a.id)?.debit ?? 0) - (periodMap.get(a.id)?.credit ?? 0);
    const net = op + p;
    const sign = naturalDebit ? net : -net;
    if (kind === 'ASSET') assets += sign;
    else if (kind === 'LIABILITY') liabilities += sign;
    else if (kind === 'EQUITY') equity += sign;
    else if (kind === 'REVENUE') revenue += sign;
    else if (kind === 'EXPENSE') expenses += sign;
  }

  const result = round2(revenue - expenses);
  const assetR = round2(assets), liabR = round2(liabilities), equityR = round2(equity);
  const balanceOK = Math.abs(assetR - (liabR + equityR + result)) < 0.10;

  return {
    assets: assetR, liabilities: liabR, equity: equityR,
    revenue: round2(revenue), expenses: round2(expenses), result,
    balanceOK,
  };
}
