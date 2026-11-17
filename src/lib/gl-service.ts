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

export async function ensureChartOfAccounts(tenantId: string) {
  return runWithTenant(tenantId, async (tx) => {
    // Acquire advisory lock on tenant to serialize the chart seeding across concurrent workers
    try {
      await (tx as any).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`glSeed:` + tenantId}, 0))`;
    } catch {
      // advisory lock not supported / already held — proceed anyway
    }

    const existing = await tx.glAccount.findFirst({ where: { tenantId } });
    if (existing) return;
    // Idempotente — upsert cada conta por (tenantId, code)
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
      // Use update-then-create to avoid P2002 races under concurrency
      const existing = await tx.glAccount.findFirst({ where: { tenantId, code: acc.code } });
      if (!existing) {
        try {
          await tx.glAccount.create({ data: { tenantId, ...acc, isActive: true } });
        } catch (createError: any) {
          // Concurrent seed may have inserted between findFirst and create — tolerate P2002 only
          if (createError?.code !== 'P2002') throw createError;
        }
      }
    }
  });
}

export async function postJournalEntry(tenantId: string, input: JournalPost) {
  if (!input.description || input.description.trim().length === 0) throw new Error('DESCRIPTION_REQUIRED');
  if (!input.lines || input.lines.length < 2) throw new Error('LINES_INSUFFICIENT');
  if (input.postedOnDate && !(input.postedOnDate instanceof Date)) throw new Error('INVALID_DATE');

  // Auto-seed chart for the tenant if empty (idempotent — does nothing if present)
  await ensureChartOfAccounts(tenantId);

  // Per-line validation first (clearer error messages)
  for (const line of input.lines) {
    const d = Number(line.debit ?? 0);
    const c = Number(line.credit ?? 0);
    if (d < 0 || c < 0) throw new Error('NEGATIVE_LINE');
    if ((d === 0) === (c === 0)) throw new Error('LINE_MUST_HAVE_DEBIT_OR_CREDIT');
  }
  // Then balance check
  const totalDebit = round2(input.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0));
  const totalCredit = round2(input.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0));
  if (Math.abs(totalDebit - totalCredit) > 0.001) {
    throw new Error(`UNBALANCED: debit ${totalDebit} ≠ credit ${totalCredit}`);
  }

  return runWithTenant(tenantId, async (tx) => {
    // Idempotência por (source, sourceId) — re-posting é no-op
    if (input.source && input.sourceId) {
      const existing = await tx.journalEntry.findFirst({
        where: { tenantId, source: input.source, sourceId: input.sourceId },
        include: { lines: true },
      });
      if (existing) return existing;
    }

    // Verificar que todos os account codes existem
    const accountCodes = [...new Set(input.lines.map((l) => l.accountCode))];
    const accounts = await tx.glAccount.findMany({
      where: { tenantId, code: { in: accountCodes } },
      select: { id: true, code: true },
    });
    const codeToId = new Map(accounts.map((a: any) => [a.code, a.id] as [string, string]));
    for (const code of accountCodes) {
      if (!codeToId.has(code)) throw new Error(`ACCOUNT_NOT_FOUND:${code}`);
    }

    const { reserveJournalEntryNumberOnTx } = await import('./gl-sequence');
    const number = await reserveJournalEntryNumberOnTx(tx, tenantId, 'JE');

    const entry = await tx.journalEntry.create({
      data: {
        tenantId,
        number,
        postedOnDate: input.postedOnDate ?? new Date(),
        description: input.description.trim(),
        source: input.source,
        sourceId: input.sourceId,
        createdBy: input.createdBy ?? null,
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
  // Idempotency — already posted? skip
  const lines = [
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
 *   DR 1300 Estoque (or 5200 services if all services) / CR 2000 Contas a pagar
 *   and tax side: DR 5200  / CR 2100 IVA a recolher if applyVat
 *
 * Conflict-eta: For simplicity here, posts ENTIRE total:
 *   DR 1300 Estoque (net = total - tax)
 *   DR 2100 IVA a recolher? No — for purchases we'd usually DR LIABILITY.
 * The default treatment:
 *   DR 5100 Despesa (or 1300), CR 2000 Contas a pagar, plus optional DR 2100 (input VAT recoverable is OUT of scope for now)
 */
export async function postSupplierInvoiceToGL(tenantId: string, supplierInvoiceId: string, total: number, taxTotal: number, createdBy?: string | null) {
  // Default accrual posting: full cost to expense account,
  //   tax recorded to IVA a recolher (as memo only, NOT as liability debit)
  // For a real purchase the debit would be on Estoque or CMV per configurable rule.
  // Para contas a pagar a fornecedores, subefectivos contabilisticos sao
  // dificeis sem conhecer a regra de IVA. Minimalista: a despesa/conta de
  // estoque entra a totalidade do valor (inclui IVA) e credita-se a obrigacao.
  const lines: JournalPost['lines'] = [
    { accountCode: '1300', debit: round2(total), memo: `Compra stock ${supplierInvoiceId.slice(0, 8)}` },
    { accountCode: '2000', credit: round2(total), memo: 'Conta a pagar' },
  ];
  // (Optional IVA to be removed from payable not added yet — simplify)
  return postJournalEntry(tenantId, {
    description: `Supplier invoice ${supplierInvoiceId}`,
    source: 'SUPPLIER_INVOICE',
    sourceId: supplierInvoiceId,
    createdBy: createdBy ?? null,
    lines,
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
