/**
 * A9 — Exercise close pre-validation
 *
 * Returns structured blockers that must be resolved before an exercise
 * can be closed. Designed to be reused by both UI and closeExercise.
 */

import { runWithTenant } from './tenant-db';

export type Blocker = {
  code: string;
  severity: 'BLOCKER' | 'WARNING';
  message: string;
  docId?: string;
  value?: number;
};

export async function preValidateExercise(tenantId: string, year: number): Promise<Blocker[]> {
  return runWithTenant(tenantId, async (tx) => {
    const blockers: Blocker[] = [];

    // 1. Períodos pendentes (state=OPEN) dentro do exercício
    const exercise = await tx.accountingExercise.findFirst({ where: { tenantId, year } });
    if (!exercise) {
      blockers.push({ code: 'EXERCISE_NOT_FOUND', severity: 'BLOCKER', message: `Exercício ${year} não existe.` });
      return blockers;
    }
    const openPeriods = await tx.accountingPeriod.count({
      where: { tenantId, exerciseId: exercise.id, state: 'OPEN' },
    });
    if (openPeriods > 0) {
      blockers.push({
        code: 'PERIODS_OPEN',
        severity: 'BLOCKER',
        message: `${openPeriods} período(s) em aberto no exercício ${year}. Feche todos os períodos antes de encerrar.`,
      });
    }

    // 2. Lançamentos desequilibrados (débito ≠ crédito) — devem ser detectados
    const unbalanced = await tx.$queryRaw<{ entryId: string; difference: number }[]>`
      SELECT l."entryId", (SUM(l."debit") - SUM(l."credit"))::float AS difference
      FROM "JournalEntryLine" l
      WHERE l."tenantId" = ${tenantId}
      GROUP BY l."entryId"
      HAVING ABS(SUM(l."debit") - SUM(l."credit")) > 0.01
    `;
    for (const u of unbalanced) {
      blockers.push({
        code: 'JE_UNBALANCED',
        severity: 'BLOCKER',
        message: `Lançamento ${u.entryId}: débitos ≠ créditos (diferença ${u.difference}).`,
        docId: u.entryId,
        value: Number(u.difference),
      });
    }

    // 3. Facturas sem lançamento contabilístico (FT issued sem JE corresponding)
    const orphaned = await tx.$queryRaw<{ id: string; number: string; total: number }[]>`
      SELECT i."id", i."number", i.total::float AS total
      FROM "Invoice" i
      WHERE i."tenantId" = ${tenantId}
        AND i.type = 'FT'
        AND i.status = 'ISSUED'
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = i."tenantId"
            AND je."source" = 'INVOICE' AND je."sourceId" = i."id"
        )
    `;
    for (const o of orphaned) {
      blockers.push({
        code: 'FT_WITHOUT_JE',
        severity: 'BLOCKER',
        message: `Factura ${o.number} emitida sem lançamento contabilístico.`,
        docId: o.id,
        value: Number(o.total ?? 0),
      });
    }

    // 4. Divergências abertas no ReconciliationIssue
    const openReconciliation = await tx.reconciliationIssue.count({
      where: { tenantId, state: 'OPEN' },
    });
    if (openReconciliation > 0) {
      blockers.push({
        code: 'RECONCILIATION_OPEN_ISSUES',
        severity: 'BLOCKER',
        message: `${openReconciliation} divergência(s) de reconciliação ainda abertas. Resolva antes de fechar o exercício.`,
      });
    }

    // 5. Contas não classificadas (kind vazio / inválido) que tenham linhas no exercício
    const unclassifiedInUse = await tx.$queryRaw<{ code: string; name: string }[]>`
      SELECT DISTINCT g.code, g.name
      FROM "GlAccount" g
      JOIN "JournalEntryLine" l ON l."accountId" = g.id AND l."tenantId" = g."tenantId"
      WHERE g."tenantId" = ${tenantId}
        AND g.kind NOT IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')
    `;
    for (const u of unclassifiedInUse) {
      blockers.push({
        code: 'UNCLASSIFIED_ACCOUNT',
        severity: 'WARNING',
        message: `Conta ${u.code} — ${u.name} sem classificação válida (ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE).`,
      });
    }

    // 6. Lançamentos em exercícios não coincidentes (audit_period vs exercise)
    const misaligned = await tx.$queryRaw<{ id: string }[]>`
      SELECT je."id"
      FROM "JournalEntry" je
      WHERE je."tenantId" = ${tenantId}
        AND je."periodId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "AccountingPeriod" p WHERE p."id" = je."periodId" AND p."tenantId" = je."tenantId"
        )
      LIMIT 1
    `;
    for (const m of misaligned) {
      blockers.push({
        code: 'ENTRY_PERIOD_ORPHAN',
        severity: 'BLOCKER',
        message: `Lançamento ${m.id} referencia um período inexistente. Contacte o contabilista.`,
        docId: m.id,
      });
    }

    return blockers;
  });
}
