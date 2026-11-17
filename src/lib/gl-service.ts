/**
 * A3 — General Ledger (partidas dobradas) service
 *
 * Minimal correct subset:
 *   - Chart of accounts: configurable per tenant
 *   - Journal entries with debit/credit invariant enforced
 *   - Idempotent journal posting via source (sourceId)
 *   - Atomic commitment (rolled back on mismatch)
 *
 * Honest disclaimers:
 *   - This is NOT conformidade com o Plano Geral de Contabilidade angolano
 *   - This is NOT um módulo contabilístico completo
 *   - Este módulo é um ledger mínimo de partidas dobradas para rastrear
 *     os efeitos financeiros das operações documentais (FT, pagamentos,
 *     contas a pagar). A configuração dos códigos contabilísticos é
 *     responsabilidade da empresa.
 *   - Documentação canônica: o utilizador deve confirmar o plano de contas
 *     com o seu contabilista antes de usar em produção.
 */

import { Prisma } from '@prisma/client';
import { runWithTenant } from './tenant-db';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type JournalPost = {
  description: string;
  source?: string;
  sourceId?: string;
  createdBy?: string | null;
  postedOnDate?: Date;
  lines: { accountCode: string; debit?: number; credit?: number; memo?: string }[];
};


/** Inline version for use inside an existing transaction. Assumes advisory lock held. */
export async function ensureChartOfAccountsOnTx(tx: any, tenantId: string) {
  const existing = await tx.glAccount.findFirst({ where: { tenantId } });
  if (existing) return;
  const accounts = [
    { code: '1000', name: 'Caixa', kind: 'ASSET' },
    { code: '1100', name: 'Banco', kind: 'ASSET' },
    { code: '1200', name: 'Contas a receber de clientes', kind: 'ASSET' },
    { code: '1300', name: 'Estoque', kind: 'ASSET' },
    { code: '1400', name: 'Adiantamentos a fornecedores', kind: 'ASSET' },
    { code: '2000', name: 'Contas a pagar a fornecedores', kind: 'LIABILITY' },
    { code: '2100', name: 'IVA a recolher', kind: 'LIABILITY' },
    { code: '2200', name: 'Adiantamentos de clientes', kind: 'LIABILITY' },
    { code: '3000', name: 'Capital social', kind: 'EQUITY' },
    { code: '3100', name: 'Resultados acumulados', kind: 'EQUITY' },
    { code: '4000', name: 'Vendas', kind: 'REVENUE' },
    { code: '4100', name: 'Descontos e devoluções em vendas', kind: 'REVENUE' },
    { code: '5000', name: 'Custo das mercadorias vendidas', kind: 'EXPENSE' },
    { code: '5100', name: 'Despesas operacionais', kind: 'EXPENSE' },
    { code: '5200', name: 'Serviços contratados', kind: 'EXPENSE' },
  ];
  for (const acc of accounts) {
    const existing = await tx.glAccount.findFirst({ where: { tenantId, code: acc.code } });
    if (!existing) {
      try {
        await tx.glAccount.create({ data: { tenantId, ...acc, isActive: true } });
      } catch (createError: any) {
        if (createError?.code !== 'P2002') throw createError;
      }
    }
  }
}

export async function ensureChartOfAccounts(tenantId: string) {
  return runWithTenant(tenantId, async (tx) => {
    try { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'glSeed:' + tenantId}, 0))`; } catch {}
    await ensureChartOfAccountsOnTx(tx, tenantId);
  });
}

export async function postJournalEntry(tenantId: string, input: JournalPost) {
  if (!input.description || input.description.trim().length === 0) throw new Error('DESCRIPTION_REQUIRED');
  if (!input.lines || input.lines.length < 2) throw new Error('LINES_INSUFFICIENT');
  if (input.postedOnDate && !(input.postedOnDate instanceof Date)) throw new Error('INVALID_DATE');

  // Single top-level transaction — all work happens inline so we only hold ONE connection per call
  return runWithTenant(tenantId, async (tx) => {
    // 1. Seed chart of accounts atomically (idempotent — upsert safe under concurrency)
    try { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'glSeed:' + tenantId}, 0))`; } catch {}
    await ensureChartOfAccountsOnTx(tx, tenantId);

    // 2. Resolve exercise + period for postedOnDate (atomic)
    const postedOnDateTmp = input.postedOnDate ?? new Date();
    const { postInsidePeriodOnTx } = await import('./accounting-periods');
    const periodRef = await postInsidePeriodOnTx(tx, tenantId, postedOnDateTmp);

    // 3. Per-line validation
    for (const line of input.lines) {
      const d = Number(line.debit ?? 0);
      const c = Number(line.credit ?? 0);
      if (d < 0 || c < 0) throw new Error('NEGATIVE_LINE');
      if ((d === 0) === (c === 0)) throw new Error('LINE_MUST_HAVE_DEBIT_OR_CREDIT');
    }
    const totalDebit = round2(input.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0));
    const totalCredit = round2(input.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0));
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`UNBALANCED: debit ${totalDebit} ≠ credit ${totalCredit}`);
    }

    // 4. Idempotency check
    if (input.source && input.sourceId) {
      const existing = await tx.journalEntry.findFirst({
        where: { tenantId, source: input.source, sourceId: input.sourceId },
        include: { lines: true },
      });
      if (existing) return existing;
    }

    // 5. Resolve account codes to IDs
    const accountCodes = [...new Set(input.lines.map((l) => l.accountCode))];
    const accounts = await tx.glAccount.findMany({
      where: { tenantId, code: { in: accountCodes } },
      select: { id: true, code: true },
    });
    const codeToId = new Map(accounts.map((a: any) => [a.code, a.id] as [string, string]));
    for (const code of accountCodes) {
      if (!codeToId.has(code)) throw new Error(`ACCOUNT_NOT_FOUND:${code}`);
    }

    // 6. Atomic journal-entry numbering
    const { reserveJournalEntryNumberOnTx } = await import('./gl-sequence');
    const number = await reserveJournalEntryNumberOnTx(tx, tenantId, 'JE');

    // 7. Insert JournalEntry with lines
    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        number,
        postedOnDate: postedOnDateTmp,
        description: input.description.trim(),
        source: input.source,
        sourceId: input.sourceId,
        createdBy: input.createdBy ?? null,
        exerciseId: periodRef.exerciseId,
        periodId: periodRef.periodId,
        lines: {
          create: input.lines.map((l) => ({
            accountId: codeToId.get(l.accountCode)!,
            debit: new Prisma.Decimal(round2(Number(l.debit ?? 0)).toFixed(2)),
            credit: new Prisma.Decimal(round2(Number(l.credit ?? 0)).toFixed(2)),
            memo: l.memo ?? null,
          })),
        },
      },
      include: { lines: true },
    });
    return entry;
  });
}


/**
 * Auto-post FT issuance:
 *   DR 1200 Contas a receber de clientes / CR 4000 Vendas (+CR 2100 IVA a recolher quando applyVat)
 */
export async function postInvoiceToGL(tenantId: string, invoiceId: string, total: number, taxTotal: number, createdBy?: string | null) {
  const net = round2(total - taxTotal);
  const lines: JournalPost['lines'] = [
    { accountCode: '1200', debit: round2(total), memo: `FT-${invoiceId.slice(0, 8)}` },
    { accountCode: '4000', credit: net, memo: 'Vendas' },
  ];
  if (taxTotal > 0) {
    lines.push({ accountCode: '2100', credit: round2(taxTotal), memo: 'IVA' });
  }
  return postJournalEntry(tenantId, {
    description: `FT ${invoiceId}`,
    source: 'INVOICE',
    sourceId: invoiceId,
    createdBy: createdBy ?? null,
    lines,
  });
}

/**
 * Auto-post payment for customer invoice:
 *   DR 1100 Banco / CR 1200 Contas a receber de clientes
 */
export async function postCustomerPaymentToGL(tenantId: string, paymentId: string, amount: number, invoiceId: string, createdBy?: string | null) {
  return postJournalEntry(tenantId, {
    description: `Pagamento FT ${invoiceId}`,
    source: 'CUSTOMER_PAYMENT',
    sourceId: paymentId,
    createdBy: createdBy ?? null,
    lines: [
      { accountCode: '1100', debit: round2(amount) },
      { accountCode: '1200', credit: round2(amount) },
    ],
  });
}

/**
 * Auto-post supplier invoice (accrual — purchase recognized, payment still pending):
 *   DR 1300 Estoque (or Services) / CR 2000 Contas a pagar
 *
 * Simplificação documentada: IVA não é deduzido na despesa para contas a pagar.
 * Para detalhe de IVA, o utilizador deve configurar as contas/rates correspondentes.
 */
export async function postSupplierInvoiceToGL(tenantId: string, supplierInvoiceId: string, total: number, taxTotal: number, createdBy?: string | null) {
  // Semelhante à FT: linha única DR 1300 / CR 2000 - totalidade inclui IVA
  void taxTotal;
  return postJournalEntry(tenantId, {
    description: `Supplier invoice ${supplierInvoiceId}`,
    source: 'SUPPLIER_INVOICE',
    sourceId: supplierInvoiceId,
    createdBy: createdBy ?? null,
    lines: [
      { accountCode: '1300', debit: round2(total), memo: `Compra stock ${supplierInvoiceId.slice(0, 8)}` },
      { accountCode: '2000', credit: round2(total), memo: 'Conta a pagar' },
    ],
  });
}

/**
 * Auto-post supplier payment:
 *   DR 2000 Contas a pagar / CR 1100 Banco
 */
export async function postSupplierPaymentToGL(tenantId: string, paymentId: string, amount: number, supplierInvoiceId: string, createdBy?: string | null) {
  return postJournalEntry(tenantId, {
    description: `Supplier payment ${supplierInvoiceId.slice(0, 8)}`,
    source: 'SUPPLIER_PAYMENT',
    sourceId: paymentId,
    createdBy: createdBy ?? null,
    lines: [
      { accountCode: '2000', debit: round2(amount) },
      { accountCode: '1100', credit: round2(amount) },
    ],
  });
}
