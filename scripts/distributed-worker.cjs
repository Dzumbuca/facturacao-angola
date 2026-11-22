"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/test/server-only-shim.ts
var init_server_only_shim = __esm({
  "src/test/server-only-shim.ts"() {
    "use strict";
  }
});

// src/lib/prisma.ts
var import_client, globalForPrisma, prisma;
var init_prisma = __esm({
  "src/lib/prisma.ts"() {
    "use strict";
    import_client = require("@prisma/client");
    globalForPrisma = global;
    prisma = globalForPrisma.prisma || new import_client.PrismaClient({
      // Use default engineType = library; do not override to binary in serverless.
      transactionOptions: {
        // Allow generous time for all lock acquisitions including advisory locks.
        maxWait: 1e4,
        // Bound total transaction time; 20 seconds is reasonable for fiscal ops.
        timeout: 2e4
      }
    });
    if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
  }
});

// src/lib/tenant-db.ts
async function applyRlsContext(tx, context) {
  const tenantId2 = typeof context.tenantId === "string" ? context.tenantId.trim() : "";
  await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId2}, true)`;
  await tx.$executeRaw`SELECT set_config('app.user_id', ${context.userId ?? ""}, true)`;
  await tx.$executeRaw`SELECT set_config('app.is_admin', ${context.isAdmin === true ? "true" : "false"}, true)`;
}
async function runWithRlsContext(fn, context, options) {
  return prisma.$transaction(async (tx) => {
    await applyRlsContext(tx, context);
    return fn(tx);
  }, options);
}
async function runWithTenant(tenantId2, fn, context) {
  if (!tenantId2 || typeof tenantId2 !== "string" || !tenantId2.trim()) {
    throw new Error("runWithTenant: tenantId is required");
  }
  return runWithRlsContext(fn, { tenantId: tenantId2, userId: context?.userId ?? null, isAdmin: false });
}
var init_tenant_db = __esm({
  "src/lib/tenant-db.ts"() {
    "use strict";
    init_server_only_shim();
    init_prisma();
  }
});

// src/lib/emission-lease.ts
var emission_lease_exports = {};
__export(emission_lease_exports, {
  acquireEmissionLease: () => acquireEmissionLease,
  releaseEmissionLease: () => releaseEmissionLease,
  withEmissionLease: () => withEmissionLease
});
function localAcquire(key) {
  const state = localGates.get(key) ?? { current: 0, queue: [] };
  if (state.current < MAX_LOCAL_SLOTS) {
    state.current += 1;
    localGates.set(key, state);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    state.queue.push(() => {
      state.current += 1;
      resolve();
    });
    localGates.set(key, state);
  });
}
function localRelease(key) {
  const state = localGates.get(key);
  if (!state) return;
  if (state.queue.length > 0) {
    const next = state.queue.shift();
    state.current -= 1;
    state.current += 0;
    next();
  } else {
    state.current = Math.max(0, state.current - 1);
    if (state.current === 0 && state.queue.length === 0) localGates.delete(key);
    else localGates.set(key, state);
  }
}
async function acquireEmissionLease(tenantId2, operationId, maxSlots = 2) {
  return runWithTenant(tenantId2, async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Tenant" WHERE id = ${tenantId2} FOR UPDATE`;
    await tx.$executeRaw`
      UPDATE "EmissionLease"
      SET state = 'EXPIRED'
      WHERE "tenantId" = ${tenantId2}
        AND state = 'ACTIVE'
        AND "expiresAt" < NOW()`;
    const activeCount = await tx.emissionLease.count({
      where: { tenantId: tenantId2, state: "ACTIVE", expiresAt: { gt: /* @__PURE__ */ new Date() } }
    });
    if (activeCount >= maxSlots) {
      return { busy: true, leaseId: null };
    }
    const processId = `${process.pid}:${import_crypto4.default.randomBytes(6).toString("hex")}`;
    const rows = await tx.$queryRaw`
      INSERT INTO "EmissionLease" (id, "tenantId", "operationId", "processId", state, "acquiredAt", "expiresAt", "lastRenewedAt")
      VALUES (gen_random_uuid()::text, ${tenantId2}, ${operationId}, ${processId}, 'ACTIVE', NOW(), NOW() + INTERVAL '120 seconds', NOW())
      RETURNING id, "expiresAt"`;
    return { busy: false, leaseId: rows[0]?.id ?? null };
  });
}
async function releaseEmissionLease(tenantId2, leaseId) {
  return runWithTenant(tenantId2, async (tx) => {
    await tx.$executeRaw`
      UPDATE "EmissionLease"
      SET state = 'RELEASED', "releasedAt" = NOW()
      WHERE "id" = ${leaseId} AND "tenantId" = ${tenantId2} AND state = 'ACTIVE'`;
  });
}
async function withEmissionLease(tenantId2, operationId, fn, maxSlots = 2) {
  const crashAt = process.env.A17_CRASH_AT;
  const localKey = `${tenantId2}|${operationId}`;
  await localAcquire(localKey);
  const deadline = Date.now() + 12e4;
  let backoffMs = 10;
  try {
    while (Date.now() < deadline) {
      const acquire = await acquireEmissionLease(tenantId2, operationId, maxSlots);
      if (!acquire.busy && acquire.leaseId) {
        if (crashAt === "after_lease_acquire" || crashAt === "any") {
          process.kill(process.pid, "SIGKILL");
        }
        try {
          const value = await fn();
          if (crashAt === "after_commit" || crashAt === "any") {
            process.kill(process.pid, "SIGKILL");
          }
          return { value, busy: false, leaseId: acquire.leaseId };
        } finally {
          if (crashAt === "before_release" || crashAt === "any") {
            process.kill(process.pid, "SIGKILL");
          }
          try {
            await releaseEmissionLease(tenantId2, acquire.leaseId);
          } catch {
          }
        }
      }
      await new Promise((r) => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 1.4, 150);
    }
    return { value: null, busy: true, leaseId: null };
  } finally {
    localRelease(localKey);
  }
}
var import_crypto4, localGates, MAX_LOCAL_SLOTS;
var init_emission_lease = __esm({
  "src/lib/emission-lease.ts"() {
    "use strict";
    init_tenant_db();
    import_crypto4 = __toESM(require("crypto"));
    localGates = /* @__PURE__ */ new Map();
    MAX_LOCAL_SLOTS = 2;
  }
});

// src/lib/accounting-periods.ts
var accounting_periods_exports = {};
__export(accounting_periods_exports, {
  ensureExerciseForYear: () => ensureExerciseForYear,
  ensureMonthlyPeriods: () => ensureMonthlyPeriods,
  postInsidePeriod: () => postInsidePeriod,
  postInsidePeriodOnTx: () => postInsidePeriodOnTx
});
async function ensureExerciseForYear(tenantId2, year) {
  return runWithTenant(tenantId2, async (tx) => {
    const existing = await tx.accountingExercise.findFirst({ where: { tenantId: tenantId2, year } });
    if (existing) return existing;
    return tx.accountingExercise.create({
      data: {
        tenantId: tenantId2,
        year,
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
        state: "OPEN",
        openedAt: /* @__PURE__ */ new Date()
      }
    });
  });
}
async function ensureMonthlyPeriods(tenantId2, exerciseId) {
  return runWithTenant(tenantId2, async (tx) => {
    const exercise = await tx.accountingExercise.findFirst({ where: { tenantId: tenantId2, id: exerciseId } });
    if (!exercise) throw new Error("EXERCISE_NOT_FOUND");
    const created = [];
    for (let m = 0; m < 12; m++) {
      const start = new Date(Date.UTC(exercise.year, m, 1));
      const end = new Date(Date.UTC(exercise.year, m + 1, 0, 23, 59, 59));
      const code = `${exercise.year}-${String(m + 1).padStart(2, "0")}`;
      const found = await tx.accountingPeriod.findFirst({ where: { tenantId: tenantId2, exerciseId: exercise.id, code } });
      if (!found) {
        const createdPeriod = await tx.accountingPeriod.create({
          data: {
            tenantId: tenantId2,
            exerciseId: exercise.id,
            code,
            startDate: start,
            endDate: end,
            state: "OPEN",
            openedAt: /* @__PURE__ */ new Date()
          }
        });
        created.push(createdPeriod);
      }
    }
    return created;
  });
}
async function postInsidePeriod(tenantId2, date) {
  return runWithTenant(tenantId2, async (tx) => {
    const year = date.getUTCFullYear();
    let exercise = await tx.accountingExercise.findFirst({ where: { tenantId: tenantId2, year } });
    if (!exercise) {
      try {
        exercise = await tx.accountingExercise.create({
          data: { tenantId: tenantId2, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: "OPEN", openedAt: /* @__PURE__ */ new Date() }
        });
      } catch (e) {
        if (e?.code === "P2002") {
          exercise = await tx.accountingExercise.findFirst({ where: { tenantId: tenantId2, year } });
        } else throw e;
      }
    }
    if (exercise.state !== "OPEN") throw new Error(`EXERCISE_NOT_OPEN:${year}`);
    const startUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
    const endUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
    const code = `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    let period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenantId2, exerciseId: exercise.id, code } });
    if (!period) {
      try {
        period = await tx.accountingPeriod.create({
          data: { tenantId: tenantId2, exerciseId: exercise.id, code, startDate: startUtc, endDate: endUtc, state: "OPEN", openedAt: /* @__PURE__ */ new Date() }
        });
      } catch (e) {
        if (e?.code === "P2002") {
          period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenantId2, exerciseId: exercise.id, code } });
        } else throw e;
      }
    }
    if (period.state !== "OPEN") throw new Error(`PERIOD_CLOSED:${code}`);
    return { exerciseId: exercise.id, periodId: period.id, periodCode: code };
  });
}
async function postInsidePeriodOnTx(tx, tenantId2, date) {
  const year = date.getUTCFullYear();
  let exercise = await tx.accountingExercise.findFirst({ where: { tenantId: tenantId2, year } });
  if (!exercise) {
    try {
      exercise = await tx.accountingExercise.create({
        data: { tenantId: tenantId2, year, startDate: new Date(Date.UTC(year, 0, 1)), endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)), state: "OPEN", openedAt: /* @__PURE__ */ new Date() }
      });
    } catch (e) {
      if (e?.code === "P2002") {
        exercise = await tx.accountingExercise.findFirst({ where: { tenantId: tenantId2, year } });
      } else throw e;
    }
  }
  if (!exercise) throw new Error(`EXERCISE_RESOLVE_FAILED:${year}`);
  if (exercise.state !== "OPEN") throw new Error(`EXERCISE_NOT_OPEN:${year}`);
  const startUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endUtc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59));
  const code = `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  let period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenantId2, exerciseId: exercise.id, code } });
  if (!period) {
    try {
      period = await tx.accountingPeriod.create({
        data: { tenantId: tenantId2, exerciseId: exercise.id, code, startDate: startUtc, endDate: endUtc, state: "OPEN", openedAt: /* @__PURE__ */ new Date() }
      });
    } catch (e) {
      if (e?.code === "P2002") {
        period = await tx.accountingPeriod.findFirst({ where: { tenantId: tenantId2, exerciseId: exercise.id, code } });
      } else throw e;
    }
  }
  if (!period) throw new Error(`PERIOD_RESOLVE_FAILED:${code}`);
  if (period.state !== "OPEN") throw new Error(`PERIOD_CLOSED:${code}`);
  return { exerciseId: exercise.id, periodId: period.id, periodCode: code };
}
var init_accounting_periods = __esm({
  "src/lib/accounting-periods.ts"() {
    "use strict";
    init_tenant_db();
  }
});

// src/lib/gl-sequence.ts
var gl_sequence_exports = {};
__export(gl_sequence_exports, {
  reserveJournalEntryNumberOnTx: () => reserveJournalEntryNumberOnTx
});
async function reserveJournalEntryNumberOnTx(tx, tenantId2, prefix = "JE") {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"glSeq:" + tenantId2 + ":" + prefix}, 0))`;
  const upsertResult = await tx.$queryRaw`
    INSERT INTO "AccountingSequence" ("id", "tenantId", "prefix", "nextNumber")
    VALUES (gen_random_uuid()::text, ${tenantId2}, ${prefix}, 1)
    ON CONFLICT ("tenantId", "prefix")
    DO UPDATE SET "nextNumber" = "AccountingSequence"."nextNumber" + 1
    RETURNING "nextNumber";
  `;
  const n = Number(upsertResult[0]?.nextNumber ?? 1);
  const year = (/* @__PURE__ */ new Date()).getUTCFullYear();
  return `${prefix}-${year}-${String(n).padStart(6, "0")}`;
}
var init_gl_sequence = __esm({
  "src/lib/gl-sequence.ts"() {
    "use strict";
  }
});

// src/lib/gl-service.ts
var gl_service_exports = {};
__export(gl_service_exports, {
  ensureChartOfAccounts: () => ensureChartOfAccounts,
  ensureChartOfAccountsOnTx: () => ensureChartOfAccountsOnTx,
  postCreditNoteToGL: () => postCreditNoteToGL,
  postCustomerPaymentToGL: () => postCustomerPaymentToGL,
  postInvoiceToGL: () => postInvoiceToGL,
  postJournalEntry: () => postJournalEntry,
  postSupplierInvoiceToGL: () => postSupplierInvoiceToGL,
  postSupplierPaymentToGL: () => postSupplierPaymentToGL
});
async function ensureChartOfAccountsOnTx(tx, tenantId2) {
  const existing = await tx.glAccount.findFirst({ where: { tenantId: tenantId2 } });
  if (existing) return;
  const accounts = [
    { code: "1000", name: "Caixa", kind: "ASSET" },
    { code: "1100", name: "Banco", kind: "ASSET" },
    { code: "1200", name: "Contas a receber de clientes", kind: "ASSET" },
    { code: "1300", name: "Estoque", kind: "ASSET" },
    { code: "1400", name: "Adiantamentos a fornecedores", kind: "ASSET" },
    { code: "2000", name: "Contas a pagar a fornecedores", kind: "LIABILITY" },
    { code: "2100", name: "IVA a recolher", kind: "LIABILITY" },
    { code: "2200", name: "Adiantamentos de clientes", kind: "LIABILITY" },
    { code: "3000", name: "Capital social", kind: "EQUITY" },
    { code: "3100", name: "Resultados acumulados", kind: "EQUITY" },
    { code: "4000", name: "Vendas", kind: "REVENUE" },
    { code: "4100", name: "Descontos e devolu\xE7\xF5es em vendas", kind: "REVENUE" },
    { code: "5000", name: "Custo das mercadorias vendidas", kind: "EXPENSE" },
    { code: "5100", name: "Despesas operacionais", kind: "EXPENSE" },
    { code: "5200", name: "Servi\xE7os contratados", kind: "EXPENSE" }
  ];
  for (const acc of accounts) {
    const existing2 = await tx.glAccount.findFirst({ where: { tenantId: tenantId2, code: acc.code } });
    if (!existing2) {
      try {
        await tx.glAccount.create({ data: { tenantId: tenantId2, ...acc, isActive: true } });
      } catch (createError) {
        if (createError?.code !== "P2002") throw createError;
      }
    }
  }
}
async function ensureChartOfAccounts(tenantId2) {
  return runWithTenant(tenantId2, async (tx) => {
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"glSeed:" + tenantId2}, 0))`;
    } catch {
    }
    await ensureChartOfAccountsOnTx(tx, tenantId2);
  });
}
async function postJournalEntry(tenantId2, input) {
  if (!input.description || input.description.trim().length === 0) throw new Error("DESCRIPTION_REQUIRED");
  if (!input.lines || input.lines.length < 2) throw new Error("LINES_INSUFFICIENT");
  if (input.postedOnDate && !(input.postedOnDate instanceof Date)) throw new Error("INVALID_DATE");
  return runWithTenant(tenantId2, async (tx) => {
    try {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"glSeed:" + tenantId2}, 0))`;
    } catch {
    }
    await ensureChartOfAccountsOnTx(tx, tenantId2);
    const postedOnDateTmp = input.postedOnDate ?? /* @__PURE__ */ new Date();
    const { postInsidePeriodOnTx: postInsidePeriodOnTx2 } = await Promise.resolve().then(() => (init_accounting_periods(), accounting_periods_exports));
    const periodRef = await postInsidePeriodOnTx2(tx, tenantId2, postedOnDateTmp);
    for (const line of input.lines) {
      const d = Number(line.debit ?? 0);
      const c = Number(line.credit ?? 0);
      if (d < 0 || c < 0) throw new Error("NEGATIVE_LINE");
      if (d === 0 === (c === 0)) throw new Error("LINE_MUST_HAVE_DEBIT_OR_CREDIT");
    }
    const totalDebit = round2(input.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0));
    const totalCredit = round2(input.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0));
    if (Math.abs(totalDebit - totalCredit) > 1e-3) {
      throw new Error(`UNBALANCED: debit ${totalDebit} \u2260 credit ${totalCredit}`);
    }
    if (input.source && input.sourceId) {
      const existing = await tx.journalEntry.findFirst({
        where: { tenantId: tenantId2, source: input.source, sourceId: input.sourceId },
        include: { lines: true }
      });
      if (existing) return existing;
    }
    const accountCodes = [...new Set(input.lines.map((l) => l.accountCode))];
    const accounts = await tx.glAccount.findMany({
      where: { tenantId: tenantId2, code: { in: accountCodes } },
      select: { id: true, code: true }
    });
    const codeToId = new Map(accounts.map((a) => [a.code, a.id]));
    for (const code of accountCodes) {
      if (!codeToId.has(code)) throw new Error(`ACCOUNT_NOT_FOUND:${code}`);
    }
    const { reserveJournalEntryNumberOnTx: reserveJournalEntryNumberOnTx2 } = await Promise.resolve().then(() => (init_gl_sequence(), gl_sequence_exports));
    const number = await reserveJournalEntryNumberOnTx2(tx, tenantId2, "JE");
    const entry = await tx.journalEntry.create({
      data: {
        tenantId: tenantId2,
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
            accountId: codeToId.get(l.accountCode),
            debit: new import_client2.Prisma.Decimal(round2(Number(l.debit ?? 0)).toFixed(2)),
            credit: new import_client2.Prisma.Decimal(round2(Number(l.credit ?? 0)).toFixed(2)),
            memo: l.memo ?? null
          }))
        }
      },
      include: { lines: true }
    });
    return entry;
  });
}
async function postInvoiceToGL(tenantId2, invoiceId, total, taxTotal, createdBy) {
  const net = round2(total - taxTotal);
  const lines = [
    { accountCode: "1200", debit: round2(total), memo: `FT-${invoiceId.slice(0, 8)}` },
    { accountCode: "4000", credit: net, memo: "Vendas" }
  ];
  if (taxTotal > 0) {
    lines.push({ accountCode: "2100", credit: round2(taxTotal), memo: "IVA" });
  }
  return postJournalEntry(tenantId2, {
    description: `FT ${invoiceId}`,
    source: "INVOICE",
    sourceId: invoiceId,
    createdBy: createdBy ?? null,
    lines
  });
}
async function postCustomerPaymentToGL(tenantId2, paymentId, amount, invoiceId, createdBy) {
  return postJournalEntry(tenantId2, {
    description: `Pagamento FT ${invoiceId}`,
    source: "CUSTOMER_PAYMENT",
    sourceId: paymentId,
    createdBy: createdBy ?? null,
    lines: [
      { accountCode: "1100", debit: round2(amount) },
      { accountCode: "1200", credit: round2(amount) }
    ]
  });
}
async function postSupplierInvoiceToGL(tenantId2, supplierInvoiceId, total, taxTotal, createdBy) {
  void taxTotal;
  return postJournalEntry(tenantId2, {
    description: `Supplier invoice ${supplierInvoiceId}`,
    source: "SUPPLIER_INVOICE",
    sourceId: supplierInvoiceId,
    createdBy: createdBy ?? null,
    lines: [
      { accountCode: "1300", debit: round2(total), memo: `Compra stock ${supplierInvoiceId.slice(0, 8)}` },
      { accountCode: "2000", credit: round2(total), memo: "Conta a pagar" }
    ]
  });
}
async function postSupplierPaymentToGL(tenantId2, paymentId, amount, supplierInvoiceId, createdBy) {
  return postJournalEntry(tenantId2, {
    description: `Supplier payment ${supplierInvoiceId.slice(0, 8)}`,
    source: "SUPPLIER_PAYMENT",
    sourceId: paymentId,
    createdBy: createdBy ?? null,
    lines: [
      { accountCode: "2000", debit: round2(amount) },
      { accountCode: "1100", credit: round2(amount) }
    ]
  });
}
async function postCreditNoteToGL(tenantId2, creditNoteId, total, taxTotal, createdBy) {
  const net = round2(total - taxTotal);
  const lines = [
    { accountCode: "4000", debit: net, memo: `Revers\xE3o NC ${creditNoteId.slice(0, 8)}` },
    { accountCode: "1200", credit: round2(total), memo: "Cliente em d\xEDvida" }
  ];
  if (taxTotal > 0) {
    lines.push({ accountCode: "2100", debit: round2(taxTotal), memo: "Revers\xE3o IVA" });
  }
  return postJournalEntry(tenantId2, {
    description: `Estorno NC ${creditNoteId}`,
    source: "CREDIT_NOTE",
    sourceId: creditNoteId,
    createdBy: createdBy ?? null,
    lines
  });
}
var import_client2, round2;
var init_gl_service = __esm({
  "src/lib/gl-service.ts"() {
    "use strict";
    import_client2 = require("@prisma/client");
    init_tenant_db();
    round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  }
});

// src/lib/crypto.ts
var import_crypto = __toESM(require("crypto"));
var getInvoiceSigningKey = (environment) => {
  const value = (environment?.PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.replace(/\\n/g, "\n").trim();
  if (!value) {
    throw new Error("PRIVATE_KEY n\xE3o est\xE1 configurada. Configure uma chave RSA privada est\xE1vel no ambiente.");
  }
  return import_crypto.default.createPrivateKey(value);
};

// src/lib/invoice-service.ts
var import_crypto6 = __toESM(require("crypto"));
var import_client3 = require("@prisma/client");
init_tenant_db();

// src/lib/invoice-integrity.ts
var runtime = __toESM(require("@prisma/client/runtime/library.js"));
async function lockIntegrityChain(tx, tenantId2) {
  await tx.$executeRaw`SELECT 1`;
}
async function reserveInvoiceNumber(tx, tenantId2, seriesCode, documentType, year) {
  await tx.$executeRaw`INSERT INTO "InvoiceSeries" ("tenantId", "seriesCode", "documentType", "year", "lastNumber") VALUES (${tenantId2}, ${seriesCode}, ${documentType}::"InvoiceType", ${year}, 0) ON CONFLICT ("tenantId", "seriesCode", "documentType", "year") DO NOTHING`;
  const rows = await tx.$queryRaw`UPDATE "InvoiceSeries" SET "lastNumber" = "lastNumber" + 1 WHERE "tenantId" = ${tenantId2} AND "seriesCode" = ${seriesCode} AND "documentType" = ${documentType}::"InvoiceType" AND "year" = ${year} RETURNING "lastNumber"`;
  if (!rows || rows.length !== 1) {
    throw new Error(`Integridade: falha ao reservar n\xFAmero para s\xE9rie ${seriesCode} ano ${year}`);
  }
  return rows[0].lastNumber;
}
async function loadOrInitChainState(tx, tenantId2) {
  await tx.$executeRaw`INSERT INTO "InvoiceChainState" ("tenantId", "lastHash", "lastSequence", "lastInvoiceId") VALUES (${tenantId2}, NULL, 0, NULL) ON CONFLICT ("tenantId") DO NOTHING`;
  const rows = await tx.$queryRaw`SELECT "lastHash", "lastSequence", "lastInvoiceId" FROM "InvoiceChainState" WHERE "tenantId" = ${tenantId2} FOR UPDATE`;
  if (!rows || rows.length !== 1) {
    throw new Error(`Integridade: falha ao inicializar/carregar o estado da cadeia para tenant ${tenantId2}`);
  }
  return rows[0];
}
async function acquireIdempotencyLock(tx, tenantId2, idempotencyKey2) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId2}), hashtext(${idempotencyKey2}))`;
}
async function checkIdempotency(tx, tenantId2, key, resource, payloadHash) {
  const rows = await tx.$queryRaw`SELECT "payloadHash", "resultId" FROM "IdempotentRequest" WHERE "tenantId" = ${tenantId2} AND "key" = ${key} AND "resource" = ${resource}`;
  if (rows.length === 0) return { kind: "fresh" };
  if (rows[0].payloadHash === payloadHash) {
    return { kind: "replay", resultId: rows[0].resultId, payloadHash: rows[0].payloadHash };
  }
  return { kind: "conflict", payloadHash: rows[0].payloadHash, resultId: rows[0].resultId };
}
async function persistIdempotency(tx, tenantId2, key, resource, payloadHash, resultId) {
  await tx.$executeRaw`INSERT INTO "IdempotentRequest" ("tenantId", "key", "resource", "payloadHash", "resultId", "createdAt")
    VALUES (${tenantId2}, ${key}, ${resource}, ${payloadHash}, ${resultId}, now())
    ON CONFLICT ("tenantId", "key") DO UPDATE SET "payloadHash" = EXCLUDED."payloadHash", "resultId" = EXCLUDED."resultId"`;
}

// src/lib/invoice-integrity-core.ts
var import_crypto2 = __toESM(require("crypto"));
var runtime2 = __toESM(require("@prisma/client/runtime/library.js"));
var Decimal3 = runtime2.Decimal;
function canonicalDecimal(value) {
  const decimal = value instanceof Decimal3 ? value : new Decimal3(value);
  if (decimal.isNaN()) throw new Error("Decimal: value required (got NaN)");
  if (!decimal.isFinite()) throw new Error("Decimal: value required (non-finite)");
  const raw = decimal.toString();
  if (/e/i.test(raw)) {
    const [base, exp] = raw.split(/e/i);
    const exponent = Number(exp);
    if (!Number.isFinite(exponent)) throw new Error("Decimal: invalid scientific notation");
    const negative = base.startsWith("-");
    const digits = (negative ? base.slice(1) : base).replace(".", "");
    const pointFromEnd = base.includes(".") ? base.split(".")[1].length : 0;
    const newPointPos = digits.length - pointFromEnd + exponent;
    if (newPointPos <= 0) {
      return `${negative ? "-" : ""}0.${"0".repeat(-newPointPos)}${digits}`;
    }
    if (newPointPos >= digits.length) {
      return `${negative ? "-" : ""}${digits}${"0".repeat(newPointPos - digits.length)}`;
    }
    return `${negative ? "-" : ""}${digits.slice(0, newPointPos)}.${digits.slice(newPointPos)}`;
  }
  if (raw.includes(".")) {
    return raw.replace(/0+$/, "").replace(/\.$/, "");
  }
  return raw;
}
function canonical(value) {
  if (value === null) return "null";
  if (value === void 0) throw new Error("Integridade: undefined n\xE3o suportado no payload can\xF3nico");
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(-Number.MAX_SAFE_INTEGER)) {
      throw new Error("Integridade: BigInt fora do intervalo seguro");
    }
    return value.toString();
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Integridade: Number n\xE3o finito no payload can\xF3nico");
    if (Object.is(value, -0)) return "0";
    if (!Number.isInteger(value)) throw new Error("Integridade: Number n\xE3o inteiro; use Decimal");
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) throw new Error("Integridade: Number inteiro fora do intervalo seguro");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value.normalize("NFC"));
  if (value instanceof Date) {
    if (isNaN(value.getTime())) throw new Error("Integridade: Date inv\xE1lida");
    return JSON.stringify(value.toISOString());
  }
  if (value instanceof Decimal3) {
    return JSON.stringify(canonicalDecimal(value));
  }
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length) {
      throw new Error("Integridade: arrays esparsas n\xE3o suportadas");
    }
    return "[" + value.map(canonical).join(",") + "]";
  }
  if (typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new Error("Integridade: objecto com prot\xF3tipo n\xE3o suportado");
    }
    const rawKeys = Object.keys(value);
    const pairs = [];
    const collator = new Intl.Collator("en", { sensitivity: "variant", numeric: true });
    for (const rawKey of rawKeys) {
      const normalizedKey = rawKey.normalize("NFC");
      if (!normalizedKey) throw new Error("Integridade: chave vazia");
      pairs.push([normalizedKey, value[rawKey]]);
    }
    const seen = /* @__PURE__ */ new Set();
    for (const [normalizedKey] of pairs) {
      if (seen.has(normalizedKey)) {
        throw new Error("Integridade: colis\xE3o de chaves ap\xF3s normaliza\xE7\xE3o NFC");
      }
      seen.add(normalizedKey);
    }
    pairs.sort((a, b) => collator.compare(a[0], b[0]));
    return "{" + pairs.map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
  }
  throw new Error("Integridade: tipo n\xE3o suportado no payload can\xF3nico");
}
function sha256Hex(input) {
  return import_crypto2.default.createHash("sha256").update(input, "utf8").digest("hex");
}
var generateInvoiceHashV2 = (data, previousHash, chainSequence) => {
  const payload = {
    hashVersion: 2,
    seriesCode: data.seriesCode ?? null,
    documentType: data.documentType ?? "FT",
    year: data.year ?? null,
    number: data.number ?? null,
    tenantId: data.tenantId ?? null,
    customerId: data.customerId ?? null,
    customerName: data.customerName ?? null,
    customerNif: data.customerNif ?? null,
    currency: data.currency ?? "AOA",
    items: Array.isArray(data.items) ? data.items.map((item) => ({
      position: item.position,
      description: item.description,
      productCode: item.productCode ?? null,
      quantity: canonicalDecimal(item.quantity),
      unitPrice: canonicalDecimal(item.unitPrice),
      taxRate: canonicalDecimal(item.taxRate),
      total: canonicalDecimal(item.total)
    })) : [],
    applyVat: data.applyVat ?? true,
    discountAmount: data.discountAmount == null ? null : canonicalDecimal(data.discountAmount),
    discountType: data.discountType ?? null,
    discountValue: data.discountValue == null ? null : canonicalDecimal(data.discountValue),
    observations: data.observations ?? null,
    includeCompanyProfile: data.includeCompanyProfile ?? false,
    companyProfileSnapshot: data.companyProfileSnapshot ?? null,
    companyLogoId: data.companyLogoId ?? null,
    subTotal: canonicalDecimal(data.subTotal),
    taxTotal: canonicalDecimal(data.taxTotal),
    total: canonicalDecimal(data.total),
    issuedAt: data.issuedAt instanceof Date ? data.issuedAt.toISOString() : data.issuedAt,
    previousHash,
    chainSequence
  };
  return sha256Hex(canonical(payload));
};

// src/lib/tax.ts
var calculateInvoiceTotals = (items, options = {}) => {
  const subTotal = items.reduce((sum, item) => sum + item.qty * item.rate, 0);
  const roundedSubTotal = Math.round((subTotal + Number.EPSILON) * 100) / 100;
  const rawDiscount = options.type === "percent" ? roundedSubTotal * Math.max(0, Number(options.value) || 0) / 100 : Math.max(0, Number(options.value) || 0);
  const discountAmount = Math.round((Math.min(roundedSubTotal, rawDiscount) + Number.EPSILON) * 100) / 100;
  const taxableBase = Math.round((Math.max(0, roundedSubTotal - discountAmount) + Number.EPSILON) * 100) / 100;
  const taxableRatio = roundedSubTotal > 0 ? taxableBase / roundedSubTotal : 0;
  const taxTotal = options.applyVat === false ? 0 : items.reduce((sum, item) => {
    const rate = item.taxRate ?? 14;
    return sum + item.qty * item.rate * taxableRatio * (rate / 100);
  }, 0);
  const roundedTaxTotal = Math.round((taxTotal + Number.EPSILON) * 100) / 100;
  return {
    subTotal: roundedSubTotal,
    discountAmount,
    taxableBase,
    taxTotal: roundedTaxTotal,
    total: Math.round((taxableBase + roundedTaxTotal + Number.EPSILON) * 100) / 100
  };
};

// src/lib/invoice-quota.ts
init_tenant_db();

// src/lib/plan.ts
init_server_only_shim();
function computeEffectivePlan(plan, planExpiry, now = /* @__PURE__ */ new Date()) {
  const raw = plan === "PRO" ? "PRO" : "FREE";
  if (raw !== "PRO") return { effectivePlan: "FREE", expired: false, daysLeft: null };
  if (!planExpiry) return { effectivePlan: "PRO", expired: false, daysLeft: null };
  const msLeft = planExpiry.getTime() - now.getTime();
  if (msLeft <= 0) return { effectivePlan: "FREE", expired: true, daysLeft: 0 };
  return { effectivePlan: "PRO", expired: false, daysLeft: Math.ceil(msLeft / 864e5) };
}

// src/lib/invoice-quota.ts
var FREE_INVOICE_LIMIT_MONTHLY = 15;
function luandaMonthBounds(now = /* @__PURE__ */ new Date()) {
  const shifted = new Date(now.getTime() + 36e5);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1) - 36e5),
    end: new Date(Date.UTC(year, month + 1, 1) - 36e5)
  };
}
async function resolveInvoiceLimit(tx, tenantId2, now = /* @__PURE__ */ new Date()) {
  const subscription = await tx.tenantSubscription.findFirst({
    where: {
      tenantId: tenantId2,
      status: { in: ["ACTIVE", "TRIAL"] },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }]
    },
    orderBy: { startsAt: "desc" },
    include: { plan: { include: { limits: true } } }
  });
  if (subscription?.plan) {
    const row = (subscription.plan.limits || []).find((l) => l.metric === "max_invoices_per_month");
    return row ? row.value ?? null : null;
  }
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId2 }, select: { plan: true, planExpiry: true } });
  return computeEffectivePlan(tenant?.plan, tenant?.planExpiry, now).effectivePlan === "PRO" ? null : FREE_INVOICE_LIMIT_MONTHLY;
}
async function countInvoicesThisMonth(tx, tenantId2, now = /* @__PURE__ */ new Date()) {
  const { start, end } = luandaMonthBounds(now);
  return tx.invoice.count({ where: { tenantId: tenantId2, type: "FT", createdAt: { gte: start, lt: end } } });
}
var InvoiceQuotaExceededError = class extends Error {
  constructor(used, limit) {
    super(`Limite de ${limit} facturas por m\xEAs atingido (${used}/${limit}). Suba de plano para continuar a emitir.`);
    this.used = used;
    this.limit = limit;
    this.name = "InvoiceQuotaExceededError";
  }
};

// src/lib/stock-service.ts
init_tenant_db();
async function decrementStockForInvoice(tenantId2, invoiceId, warehouseId, items, tx) {
  const stockMovements = items.filter((item) => item.productId && item.quantity > 0).map((item) => ({
    productId: item.productId,
    quantity: item.quantity
  }));
  for (const movement of stockMovements) {
    const product = await tx.product.findFirst({
      where: { id: movement.productId, tenantId: tenantId2 },
      select: { id: true, stock: true }
    });
    if (!product) {
      throw new Error("Produto " + movement.productId + " nao encontrado");
    }
    const stocks = await tx.productWarehouseStock.findMany({
      where: { tenantId: tenantId2, productId: product.id, warehouseId }
    });
    const available = stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
    if (available < movement.quantity) {
      throw new Error("Stock insuficiente");
    }
    let remaining = movement.quantity;
    const sorted = [...stocks].sort((a, b) => {
      if (a.lotId === null && b.lotId !== null) return -1;
      if (a.lotId !== null && b.lotId === null) return 1;
      return 0;
    });
    for (const s of sorted) {
      if (remaining <= 0) break;
      const take = Math.min(Number(s.quantity || 0), remaining);
      if (take <= 0) continue;
      await tx.productWarehouseStock.update({
        where: { id: s.id },
        data: { quantity: { decrement: take } }
      });
      remaining -= take;
    }
    const updated = await tx.product.updateMany({
      where: { id: product.id, tenantId: tenantId2, stock: { gte: movement.quantity } },
      data: { stock: { decrement: movement.quantity } }
    });
    if (updated.count === 0) {
      throw new Error("Stock insuficiente");
    }
    await tx.stockMovement.create({
      data: {
        tenantId: tenantId2,
        productId: product.id,
        warehouseId,
        type: "OUT",
        quantity: movement.quantity,
        quantitySigned: -movement.quantity,
        reason: "Venda - fatura #" + invoiceId,
        reference: "INV-" + invoiceId,
        idempotencyKey: "invoice-" + invoiceId + "-" + product.id
      }
    });
  }
}

// src/lib/platform-apps.ts
init_prisma();
async function isApplicationEnabled(tenantId2, slug, tx) {
  const db = tx ?? prisma;
  const app = await db.platformApplication.findUnique({ where: { slug } });
  if (!app || app.status !== "ACTIVE") return false;
  if (app.isCore) {
    const ta2 = await db.tenantApplication.findUnique({
      where: { tenantId_applicationId: { tenantId: tenantId2, applicationId: app.id } }
    });
    if (!ta2) return true;
    return !!ta2.enabled;
  }
  const ta = await db.tenantApplication.findUnique({
    where: { tenantId_applicationId: { tenantId: tenantId2, applicationId: app.id } }
  });
  if (!ta?.enabled) return false;
  const subscription = await db.tenantSubscription.findFirst({
    where: { tenantId: tenantId2 },
    orderBy: { startsAt: "desc" }
  });
  if (!subscription) return true;
  if (subscription.endsAt && subscription.endsAt.getTime() <= Date.now()) return false;
  return true;
}

// src/lib/audit-log.ts
var import_crypto3 = require("crypto");
init_tenant_db();
var cleanJsValue = (value) => {
  if (value === null || value === void 0) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if (typeof value.toString === "function" && /^-?\d+(\.\d+)?$/.test(value.toString()) && typeof value.toFixed === "function") {
      const n = Number(value.toString());
      return Number.isInteger(n) ? Math.trunc(n) : n;
    }
    if (Array.isArray(value)) return value.map(cleanJsValue);
    const out = {};
    for (const key of Object.keys(value)) out[key] = cleanJsValue(value[key]);
    return out;
  }
  return JSON.parse(JSON.stringify(value));
};
var cleanJson = (value) => cleanJsValue(value);
var sortObject = (value) => {
  if (value === null || value === void 0) return value;
  if (Array.isArray(value)) return value.map(sortObject);
  if (typeof value !== "object") return value;
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortObject(value[key]);
  }
  return out;
};
var canonical2 = (entry, previousHash, tenantId2) => {
  const snapshot = cleanJson({
    tenantId: tenantId2,
    action: entry.action ?? null,
    entity: entry.entity ?? null,
    entityId: entry.entityId ?? null,
    actorUserId: entry.actorUserId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    justification: entry.justification ?? null,
    correlationId: entry.correlationId ?? null,
    source: entry.source ?? null,
    result: entry.result ?? "SUCCESS",
    previousHash: previousHash ?? ""
  });
  return JSON.stringify(sortObject(snapshot));
};
var sha256 = (s) => (0, import_crypto3.createHash)("sha256").update(s).digest("hex");
async function logAuditEvent(tenantId2, entry, tx) {
  const runner = tx ? (fn) => fn(tx) : (fn) => runWithTenant(tenantId2, fn);
  return runner(async (t) => {
    const latest = await t.auditEvent.findFirst({
      where: { tenantId: tenantId2 },
      orderBy: { occurredAt: "desc" },
      select: { hash: true }
    });
    const previousHash = latest?.hash ?? null;
    const canonicalStr = canonical2(entry, previousHash, tenantId2);
    const hash = sha256(canonicalStr);
    const created = await t.auditEvent.create({
      data: {
        tenantId: tenantId2,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: entry.before ? entry.before : void 0,
        after: entry.after ? entry.after : void 0,
        justification: entry.justification ?? null,
        result: entry.result ?? "SUCCESS",
        correlationId: entry.correlationId ?? null,
        source: entry.source ?? null,
        previousHash,
        hash
      }
    });
    return { id: created.id, hash: created.hash ?? hash, previousHash };
  });
}

// src/lib/invoice-service.ts
var isDeadlock = (err) => {
  if (!err) return false;
  if (err.code === "P2010" && /40P01|40001/.test(err.message ?? "")) return true;
  if (err.code === "P2024") return true;
  if (err.code === "P2025") return true;
  if (err.code === "P2028") return true;
  if (err.meta && /40P01|40001/.test(JSON.stringify(err.meta))) return true;
  return false;
};
var issueInvoice = async (invoiceData, tenantId2, beforePersist, idempotencyKey2) => {
  const { withEmissionLease: withEmissionLease2 } = await Promise.resolve().then(() => (init_emission_lease(), emission_lease_exports));
  const result = await withEmissionLease2(tenantId2, "INVOICE", async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await issueInvoiceOnce(invoiceData, tenantId2, beforePersist, idempotencyKey2);
      } catch (err) {
        if (!isDeadlock(err) || attempt === 4) throw err;
        await new Promise((r) => setTimeout(r, 50 + attempt * 50));
      }
    }
    throw new Error("issueInvoice exhausted retries");
  }, 2);
  if (result.busy) throw new Error("EMISSION_BUSY \u2014 too many concurrent FTs for this tenant; retry later");
  return result.value;
};
var issueInvoiceOnce = async (invoiceData, tenantId2, beforePersist, idempotencyKey2) => {
  const result = await runWithTenant(tenantId2, async (transaction) => {
    if (process.env.A17_CRASH_AT === "during_tx") {
      process.kill(process.pid, "SIGKILL");
    }
    const tenant = await transaction.tenant.findUnique({ where: { id: tenantId2 } });
    if (!tenant) throw new Error("Empresa autenticada nao encontrada.");
    const includeCompanyProfile = invoiceData.includeCompanyProfile !== false;
    const companyBankAccount = includeCompanyProfile ? await transaction.companyBankAccount.findFirst({
      where: invoiceData.companyBankAccountId ? { id: invoiceData.companyBankAccountId, tenantId: tenant.id, isActive: true } : { tenantId: tenant.id, isActive: true, isPrimary: true },
      select: { bankName: true, accountHolder: true, iban: true, currency: true, label: true }
    }) : null;
    if (includeCompanyProfile && invoiceData.companyBankAccountId && !companyBankAccount) {
      throw new Error("A conta banc\xE1ria seleccionada n\xE3o est\xE1 dispon\xEDvel.");
    }
    const companyProfileSnapshot = includeCompanyProfile ? Object.fromEntries(Object.entries({
      name: tenant.name,
      legalName: tenant.legalName,
      nif: tenant.nif,
      address: tenant.address,
      municipality: tenant.municipality,
      province: tenant.province,
      country: tenant.country,
      phone: tenant.phone,
      email: tenant.email,
      website: tenant.website,
      bankName: companyBankAccount?.bankName ?? (!invoiceData.companyBankAccountId ? tenant.bankName : null),
      bankAccountName: companyBankAccount?.accountHolder ?? (!invoiceData.companyBankAccountId ? tenant.bankAccountName : null),
      iban: companyBankAccount?.iban ?? (!invoiceData.companyBankAccountId ? tenant.iban : null),
      bankAccountLabel: companyBankAccount?.label,
      bankAccountCurrency: companyBankAccount?.currency,
      brandColor: tenant.brandColor,
      invoiceFooter: tenant.invoiceFooter
    }).filter(([, value]) => typeof value === "string" && value.trim())) : null;
    const companyLogo = includeCompanyProfile && tenant.currentLogoId ? await transaction.companyLogo.findFirst({
      where: { id: tenant.currentLogoId, tenantId: tenant.id },
      select: { id: true, mimeType: true, content: true }
    }) : null;
    let customer = await transaction.customer.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { nif: invoiceData.customerNif || void 0 },
          { name: invoiceData.customerName }
        ]
      }
    });
    if (!customer) {
      customer = await transaction.customer.create({
        data: {
          tenantId: tenant.id,
          name: invoiceData.customerName || "Consumidor Final",
          nif: invoiceData.customerNif || null
        }
      });
    }
    const issuedAt = /* @__PURE__ */ new Date();
    const year = issuedAt.getFullYear();
    const seriesCode = "A";
    const documentType = "FT";
    const canonicalPayload = JSON.stringify({
      customerId: (customer && (customer.id ?? null)) ?? null,
      customerName: invoiceData.customerName ?? null,
      customerNif: invoiceData.customerNif ?? null,
      items: (invoiceData.items || []).map((item) => ({
        productId: item.productId ?? null,
        desc: item.desc ?? null,
        qty: item.qty ?? 1,
        rate: item.rate ?? 0
      })),
      applyVat: invoiceData.applyVat !== false,
      discountType: invoiceData.discountType ?? "amount",
      discountValue: invoiceData.discountValue ?? 0,
      observations: invoiceData.observations ?? null,
      includeCompanyProfile: invoiceData.includeCompanyProfile === true,
      currency: invoiceData.currency ?? "AOA",
      dueAt: invoiceData.dueAt ? new Date(invoiceData.dueAt).toISOString() : null
    });
    const payloadHash = sha256Hex(canonicalPayload);
    await lockIntegrityChain(transaction, tenant.id);
    if (idempotencyKey2) {
      await acquireIdempotencyLock(transaction, tenant.id, idempotencyKey2);
    }
    if (idempotencyKey2) {
      const decision = await checkIdempotency(transaction, tenant.id, idempotencyKey2, "INVOICE", payloadHash);
      if (decision.kind === "replay") {
        const existing = await transaction.invoice.findUnique({ where: { id: decision.resultId }, include: { items: true, customer: true, tenant: true } });
        if (existing) return { saved: existing, tenantId: tenant.id, customerName: existing.customer?.name ?? "", customerNif: existing.customer?.nif ?? "", shortHash: void 0, items: existing.items, _replay: true };
      } else if (decision.kind === "conflict") {
        const err = new Error("IdempotencyConflict");
        err.code = "IDEMPOTENCY_CONFLICT";
        err.status = 409;
        throw err;
      }
    }
    const reserved = await reserveInvoiceNumber(transaction, tenant.id, seriesCode, documentType, year);
    const invoiceNumber = `FT ${year}/${String(reserved).padStart(4, "0")}`;
    const chainState = await loadOrInitChainState(transaction, tenant.id);
    const previousHash = chainState.lastHash;
    const chainSequence = chainState.lastSequence + 1;
    const applyVat = invoiceData.applyVat !== false;
    const discountType = invoiceData.discountType === "percent" ? "percent" : "amount";
    const discountValue = Number(invoiceData.discountValue) || 0;
    const { subTotal, discountAmount, taxTotal, total } = calculateInvoiceTotals(invoiceData.items || [], { type: discountType, value: discountValue, applyVat });
    const observations = typeof invoiceData.observations === "string" ? invoiceData.observations.trim() || null : null;
    const hash = generateInvoiceHashV2({
      seriesCode,
      documentType,
      year,
      number: invoiceNumber,
      tenantId: tenant.id,
      customerId: customer.id,
      customerName: customer.name,
      customerNif: customer.nif,
      currency: invoiceData.currency ?? "AOA",
      items: (invoiceData.items || []).map((item, idx) => ({
        position: idx,
        description: item.desc || "Item sem descri\xE7\xE3o",
        productCode: item.productId ?? null,
        quantity: item.qty ?? 1,
        unitPrice: item.rate ?? 0,
        taxRate: item.taxRate ?? (applyVat ? 14 : 0),
        total: (item.qty ?? 1) * (item.rate ?? 0)
      })),
      applyVat,
      discountAmount,
      discountType,
      discountValue,
      observations,
      includeCompanyProfile,
      companyProfileSnapshot,
      companyLogoId: companyLogo?.id ?? null,
      subTotal,
      taxTotal,
      total,
      issuedAt: issuedAt.toISOString()
    }, previousHash, chainSequence);
    const sign = import_crypto6.default.createSign("SHA256");
    sign.update(hash);
    const signature = sign.sign(getInvoiceSigningKey(), "base64");
    const shortHash = signature.length >= 31 ? `${signature[0]}${signature[10]}${signature[20]}${signature[30]}` : signature.substring(0, 4);
    if (beforePersist) {
      await beforePersist({
        ...invoiceData,
        number: invoiceNumber,
        type: "FT",
        status: "ISSUED",
        subTotal,
        discountAmount,
        discountType,
        discountValue,
        applyVat,
        observations,
        includeCompanyProfile,
        currency: invoiceData.currency ?? "AOA",
        companyProfileSnapshot,
        companyLogo,
        taxTotal,
        total,
        hash,
        previousHash,
        signature,
        shortHash,
        issuedAt,
        createdAt: issuedAt,
        tenant,
        customer,
        customerName: customer.name,
        customerNif: customer.nif
      });
    }
    const invoiceCreateData = {
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        number: invoiceNumber,
        type: "FT",
        status: "DRAFT",
        seriesCode,
        documentType,
        year,
        chainSequence,
        hashVersion: 2,
        subTotal,
        discountAmount,
        discountType,
        discountValue,
        applyVat,
        observations,
        includeCompanyProfile,
        companyProfileSnapshot: companyProfileSnapshot ?? import_client3.Prisma.DbNull,
        companyLogoId: companyLogo?.id ?? null,
        taxTotal,
        total,
        hash,
        previousHash,
        signature,
        issuedAt,
        dueAt: invoiceData.dueAt ? new Date(invoiceData.dueAt) : null,
        sourceDraftId: invoiceData.sourceDraftId ?? null,
        items: {
          create: (invoiceData.items || []).map((item, idx) => ({
            productId: item.productId || null,
            description: item.desc || "Item sem descri\xE7\xE3o",
            quantity: item.qty || 1,
            unitPrice: item.rate || 0,
            taxRate: applyVat ? 14 : 0,
            position: idx,
            total: (item.qty || 1) * (item.rate || 0)
          }))
        }
      },
      include: {
        customer: true,
        items: true,
        tenant: true
      }
    };
    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;
    const invoiceLimit = await resolveInvoiceLimit(transaction, tenant.id);
    if (invoiceLimit !== null) {
      const usedThisMonth = await countInvoicesThisMonth(transaction, tenant.id);
      if (usedThisMonth >= invoiceLimit) throw new InvoiceQuotaExceededError(usedThisMonth, invoiceLimit);
    }
    const saved = await transaction.invoice.create(invoiceCreateData);
    await transaction.invoice.update({
      where: { id: saved.id },
      data: { status: "ISSUED" }
    });
    await transaction.$executeRaw`UPDATE "InvoiceChainState"
      SET "lastHash" = ${hash}, "lastSequence" = ${chainSequence}, "lastInvoiceId" = ${saved.id}
      WHERE "tenantId" = ${tenant.id}`;
    if (idempotencyKey2) {
      await persistIdempotency(transaction, tenant.id, idempotencyKey2, "INVOICE", payloadHash, saved.id);
    }
    const invoiceItems = (invoiceData.items || []).filter(
      (item) => item.productId && item.qty > 0
    );
    if (invoiceItems.length > 0) {
      const wmsEnabled = await isApplicationEnabled(tenant.id, "wms", transaction);
      const trackedProducts = wmsEnabled ? await transaction.product.findMany({
        where: { tenantId: tenant.id, id: { in: invoiceItems.map((item) => item.productId) }, trackStock: true },
        select: { id: true }
      }) : [];
      const trackedIds = new Set(trackedProducts.map((product) => product.id));
      const trackedItems = invoiceItems.filter((item) => trackedIds.has(item.productId));
      if (trackedItems.length > 0) {
        const defaultWarehouse = await transaction.warehouse.findFirst({
          where: { tenantId: tenant.id, isDefault: true, isActive: true }
        });
        if (!defaultWarehouse) throw new Error("Nenhum armazem padrao configurado para o tenant");
        await decrementStockForInvoice(
          tenant.id,
          saved.id,
          defaultWarehouse.id,
          trackedItems.map((item) => ({
            productId: item.productId,
            quantity: item.qty
          })),
          transaction
        );
      }
    }
    if (invoiceData.sourceDraftId) {
      const updatedDraft = await transaction.invoiceDraft.updateMany({
        where: { id: invoiceData.sourceDraftId, tenantId: tenant.id, status: "ISSUING" },
        data: { status: "ISSUED" }
      });
      if (updatedDraft.count !== 1) throw new Error("O rascunho foi alterado durante a emiss\xE3o.");
    }
    await logAuditEvent(tenantId2, {
      action: "FT_ISSUED",
      entity: "Invoice",
      entityId: saved.id,
      after: { number: saved.number, total: saved.total, customerNif: customer.nif, currency: saved.currency },
      source: "issueInvoice"
    }, transaction);
    return { saved, tenantId: tenantId2, shortHash, customerName: customer.name, customerNif: customer.nif, items: invoiceData.items };
  });
  if (result?.saved) {
    try {
      const { postInvoiceToGL: postInvoiceToGL2 } = await Promise.resolve().then(() => (init_gl_service(), gl_service_exports));
      const total = Number(result.saved.total);
      const taxTotal = Number(result.saved.taxTotal?.toString() ?? 0);
      await postInvoiceToGL2(result.tenantId, result.saved.id, total, taxTotal);
    } catch (e) {
      console.error("GL_POST_FAILED for FT", result?.saved?.id, e);
    }
  }
  return {
    ...result.saved,
    customerName: result.customerName,
    customerNif: result.customerNif,
    shortHash: result.shortHash,
    items: result.items
  };
};

// scripts/distributed-worker.ts
var import_client4 = require("@prisma/client");
var tenantId = process.argv[2];
var count = parseInt(process.argv[3], 10);
var startIndex = parseInt(process.argv[4], 10);
var operation = process.argv[5] || "FT";
var idempotencyKey = process.argv[6] || void 0;
var prisma2 = new import_client4.PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});
async function main() {
  const results = [];
  const errors = [];
  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    try {
      const inv = await issueInvoice({
        customerName: `Dist ${tenantId.slice(-8)}-${idx}`,
        customerNif: "5000000001",
        items: [{ productId: null, desc: `DIST-${operation}-${idx}`, qty: 1, rate: 100 + idx }],
        applyVat: true,
        discountType: "amount",
        discountValue: 0,
        observations: `dist-${operation}-${idx}`,
        includeCompanyProfile: false,
        dueAt: null
      }, tenantId, void 0, idempotencyKey);
      results.push({
        index: idx,
        id: inv.id,
        number: inv.number,
        hash: inv.hash,
        chainSequence: inv.chainSequence,
        hashVersion: inv.hashVersion
      });
    } catch (e) {
      errors.push({
        index: idx,
        message: e.message,
        code: e.code
      });
    }
  }
  const ftCount = results.filter((r) => r.number.startsWith("FT")).length;
  const ncCount = results.filter((r) => r.number.startsWith("NC")).length;
  process.stdout.write(JSON.stringify({
    tenantId,
    count,
    startIndex,
    operation,
    pid: process.pid,
    results,
    errors,
    ftCount,
    ncCount
  }));
  process.exit(0);
}
main().catch((e) => {
  process.stderr.write(e.message);
  process.exit(1);
});
