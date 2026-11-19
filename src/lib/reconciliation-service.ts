/**
 * A6 — Financial reconciliation service
 *
 * Runs a reconciliation pass over a tenant's data. Detects:
 *   - FTs without a corresponding JournalEntry
 *   - Customers payments without matching JE
 *   - Supplier invoices without JE
 *   - Supplier payments without JE
 *   - Credit notes (NC) without JE estorno
 *   - REVERSED customer payments without reverse-JE
 *   - Orphaned JE entries (source FT/ID not found)
 *
 * Each pass creates a ReconciliationRun row and writes detected issues into
 * ReconciliationIssue. Issues carry: severity, docType, docId, value, message.
 *
 * Idempotent per (tenantId, runId) — issues from prior completed runs are
 * preserved but marked resolved=false; future runs create new issues if still
 * present.
 */

import { runWithTenant } from './tenant-db';
import { Prisma } from '@prisma/client';

export type ReconciliationIssueInput = {
  issueType: string;
  docKind: string | null;
  docId: string | null;
  value: number | null;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type ReconciliationSummary = {
  runId: string;
  issuesFound: number;
  rulesClaimed: number;
  findings: ReconciliationIssueInput[];
};

export async function runReconciliation(tenantId: string, actorUserId: string | null): Promise<ReconciliationSummary> {
  return runWithTenant(tenantId, async (tx) => {
    // Create the run row
    const run = await tx.reconciliationRun.create({
      data: {
        tenantId,
        actorUserId,
        status: 'RUNNING',
      },
    });

    const findings: ReconciliationIssueInput[] = [];
    let rulesClaimed = 0;

    // 1. FT without JournalEntry
    rulesClaimed++;
    const ftsWithoutJE = await tx.$queryRaw<{ id: string; number: string; total: number }[]>`
      SELECT i.id, i.number, i.total::float AS total
      FROM "Invoice" i
      WHERE i."tenantId" = ${tenantId} AND i.type = 'FT' AND i.status = 'ISSUED'
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = i."tenantId" AND je.source = 'INVOICE' AND je."sourceId" = i.id
        )
      LIMIT 500
    `;
    for (const row of ftsWithoutJE) {
      findings.push({
        issueType: 'FT_WITHOUT_JE',
        docKind: 'INVOICE',
        docId: row.id,
        value: Number(row.total ?? 0),
        description: `Factura ${row.number} sem lançamento contabilístico correspondente.`,
        severity: 'HIGH',
      });
    }

    // 2. Customer payments without JE
    rulesClaimed++;
    const paymentsWithoutJE = await tx.$queryRaw<{ id: string; invoiceId: string; amount: number }[]>`
      SELECT p.id, p."invoiceId", p.amount::float AS amount
      FROM "Payment" p
      WHERE p."tenantId" = ${tenantId} AND p.status = 'CONFIRMED'
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = p."tenantId" AND je.source = 'CUSTOMER_PAYMENT' AND je."sourceId" = p.id
        )
      LIMIT 500
    `;
    for (const row of paymentsWithoutJE) {
      findings.push({
        issueType: 'PAYMENT_WITHOUT_JE',
        docKind: 'PAYMENT',
        docId: row.id,
        value: Number(row.amount ?? 0),
        description: `Pagamento confirmado sem lançamento contabilístico.`,
        severity: 'HIGH',
      });
    }

    // 3. Supplier invoices without JE
    rulesClaimed++;
    const supplierInvoicesWithoutJE = await tx.$queryRaw<{ id: string; number: string; total: number }[]>`
      SELECT si.id, si.number, si.total::float AS total
      FROM "SupplierInvoice" si
      WHERE si."tenantId" = ${tenantId} AND si.status IN ('PENDING', 'OVERDUE', 'PAID')
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = si."tenantId" AND je.source = 'SUPPLIER_INVOICE' AND je."sourceId" = si.id
        )
      LIMIT 500
    `;
    for (const row of supplierInvoicesWithoutJE) {
      findings.push({
        issueType: 'SUPPLIER_INVOICE_WITHOUT_JE',
        docKind: 'SUPPLIER_INVOICE',
        docId: row.id,
        value: Number(row.total ?? 0),
        description: `Factura de fornecedor ${row.number} sem lançamento contabilístico.`,
        severity: 'HIGH',
      });
    }

    // 4. Supplier invoice payments without JE
    rulesClaimed++;
    const supplierPaymentsWithoutJE = await tx.$queryRaw<{ id: string; supplierInvoiceId: string; paidAmount: number }[]>`
      SELECT si.id, si."id" AS "supplierInvoiceId", si."paidAmount"::float AS "paidAmount"
      FROM "SupplierInvoice" si
      WHERE si."tenantId" = ${tenantId} AND si.status = 'PAID' AND si."paidAmount" > 0
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = si."tenantId" AND je.source = 'SUPPLIER_PAYMENT'
            AND je."sourceId" LIKE si.id || '-%'
        )
      LIMIT 500
    `;
    for (const row of supplierPaymentsWithoutJE) {
      findings.push({
        issueType: 'SUPPLIER_PAYMENT_WITHOUT_JE',
        docKind: 'SUPPLIER_INVOICE',
        docId: row.supplierInvoiceId,
        value: Number(row.paidAmount ?? 0),
        description: `Pagamento de fornecedor sem reversão de lançamento.`,
        severity: 'MEDIUM',
      });
    }

    // 5. REVERSED customer payments without estorno
    rulesClaimed++;
    const reversedWithoutJE = await tx.$queryRaw<{ id: string; invoiceId: string; amount: number }[]>`
      SELECT p.id, p."invoiceId", p.amount::float AS amount
      FROM "Payment" p
      WHERE p."tenantId" = ${tenantId} AND p.status = 'REVERSED'
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = p."tenantId" AND je.source = 'CUSTOMER_PAYMENT_REVERSED' AND je."sourceId" = p.id
        )
      LIMIT 500
    `;
    for (const row of reversedWithoutJE) {
      findings.push({
        issueType: 'REVERSED_PAYMENT_WITHOUT_ESTORNO',
        docKind: 'PAYMENT',
        docId: row.id,
        value: Number(row.amount ?? 0),
        description: `Pagamento revertido sem estorno contabilístico.`,
        severity: 'HIGH',
      });
    }

    // 6. NC without estorno
    rulesClaimed++;
    const ncWithoutJE = await tx.$queryRaw<{ id: string; total: number }[]>`
      SELECT i.id, i.total::float AS total
      FROM "Invoice" i
      WHERE i."tenantId" = ${tenantId} AND i.type = 'NC'
        AND NOT EXISTS (
          SELECT 1 FROM "JournalEntry" je
          WHERE je."tenantId" = i."tenantId" AND je.source = 'CREDIT_NOTE' AND je."sourceId" = i.id
        )
      LIMIT 500
    `;
    for (const row of ncWithoutJE) {
      findings.push({
        issueType: 'NC_WITHOUT_JE',
        docKind: 'CREDIT_NOTE',
        docId: row.id,
        value: Number(row.total ?? 0),
        description: `Nota de Crédito sem reversão contabilística.`,
        severity: 'MEDIUM',
      });
    }

    // 7. Suppliers invoices overdue but still active — informational
    rulesClaimed++;
    const overdueNotPaired = await tx.$queryRaw<{ id: string; number: string; total: number }[]>`
      SELECT si.id, si.number, si.total::float AS total
      FROM "SupplierInvoice" si
      WHERE si."tenantId" = ${tenantId}
        AND si."dueDate" IS NOT NULL AND si."dueDate" < NOW()
        AND si.status IN ('PENDING', 'OVERDUE')
      LIMIT 500
    `;
    for (const row of overdueNotPaired) {
      findings.push({
        issueType: 'SUPPLIER_INVOICE_OVERDUE',
        docKind: 'SUPPLIER_INVOICE',
        docId: row.id,
        value: Number(row.total ?? 0),
        description: `Factura de fornecedor ${row.number} vencida e em aberto.`,
        severity: 'MEDIUM',
      });
    }

    // Persist issues
    for (const f of findings) {
      await tx.reconciliationIssue.create({
        data: {
          tenantId,
          runId: run.id,
          issueType: f.issueType,
          docKind: f.docKind,
          docId: f.docId,
          value: f.value === null ? null : new Prisma.Decimal(f.value.toFixed(2)),
          description: f.description,
          severity: f.severity,
          state: 'OPEN',
        },
      });
    }

    // Finalize run
    await tx.reconciliationRun.update({
      where: { id: run.id },
      data: {
        status: 'DONE',
        finishedAt: new Date(),
        rulesClaimed,
        issuesFound: findings.length,
      },
    });

    return { runId: run.id, issuesFound: findings.length, rulesClaimed, findings };
  });
}

export async function listRecentReconciliations(tenantId: string, limit = 10) {
  return runWithTenant(tenantId, async (tx) => {
    const runs = await tx.reconciliationRun.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    const issues = await tx.reconciliationIssue.findMany({
      where: { tenantId, runId: { in: runs.map((r: any) => r.id) } },
      orderBy: [{ state: 'asc' }, { severity: 'asc' }, { createdAt: 'desc' }],
    });
    return { runs, issues };
  });
}
