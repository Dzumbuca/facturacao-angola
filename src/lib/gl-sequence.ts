/**
 * A4 — Transactional journal entry numbering.
 *
 * IMPORTANT: This must run INSIDE an existing transaction `tx` — the number
 * reservation is atomic with the JournalEntry insert. Otherwise JE numbers
 * from a parallel process may be skipped.
 */

export async function reserveJournalEntryNumberOnTx(
  tx: any,
  tenantId: string,
  prefix: 'JE' = 'JE',
): Promise<string> {
  // Acquire row-level advisory lock on tenant to serialize number allocation
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'glSeq:' + tenantId + ':' + prefix}, 0))`;
  const upsertResult = await tx.$queryRaw<{ nextNumber: number }[]>`
    INSERT INTO "AccountingSequence" ("id", "tenantId", "prefix", "nextNumber")
    VALUES (gen_random_uuid()::text, ${tenantId}, ${prefix}, 1)
    ON CONFLICT ("tenantId", "prefix")
    DO UPDATE SET "nextNumber" = "AccountingSequence"."nextNumber" + 1
    RETURNING "nextNumber";
  `;
  const n = Number(upsertResult[0]?.nextNumber ?? 1);
  const year = new Date().getUTCFullYear();
  return `${prefix}-${year}-${String(n).padStart(6, '0')}`;
}
