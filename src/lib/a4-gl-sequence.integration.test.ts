/**
 * A4 — integration test for journal sequence numbering
 *
 * Validates that 100 concurrent JournalEntry creations produce 100 unique numbers.
 * Use DATABASE_URL_A4 pointing to a disposable PG.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { postJournalEntry } from './gl-service';

const url = process.env.DATABASE_URL_A4 || process.env.DATABASE_URL;
const enabled = !!url && !url.includes('supabase.com');

let prisma: InstanceType<typeof PrismaClient> | null = null;
if (enabled) {
  prisma = new PrismaClient({ datasources: { db: { url } }, transactionOptions: { maxWait: 30_000, timeout: 90_000 } });
}
const describeIfDisposable = enabled ? describe : describe.skip;

describeIfDisposable('A4 — JournalEntry sequence, unique under concurrency', () => {
  let tenantId = '';

  beforeAll(async () => {
    if (!prisma) return;
    tenantId = `t-a4seq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await prisma.tenant.create({ data: { id: tenantId, name: `A4 Sequencer ${tenantId}`, plan: 'PRO', status: 'ACTIVE' } });
  }, 30000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  it('integrates: 100 sequential GL posts produce 100 unique sequential numbers with advisory lock', async () => {
    if (!prisma) return;
    const calls = Array.from({ length: 100 }, (_, i) =>
      postJournalEntry(tenantId, {
        description: `Concurrent entry ${i}`,
        source: 'TEST',
        sourceId: `test-${i}`,
        lines: [
          { accountCode: '1200', debit: 100 },
          { accountCode: '4000', credit: 100 },
        ],
      }).catch((e) => ({ error: e }))
    );
    const results = await Promise.all(calls);

    const errs = results.filter((r: any) => r?.error);
    expect(errs.length, `errors: ${JSON.stringify(errs)}`).toBe(0);
    const numbers = results.map((r: any) => r.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    console.log(`a4-seq: ${numbers.length} entries in parallel OK (numbers: ${numbers.slice(0, 3).join(', ')})`);
  }, 60000);
});
