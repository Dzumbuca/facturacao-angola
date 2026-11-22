import { issueInvoice } from '../src/lib/invoice-service';
import { PrismaClient } from '@prisma/client';

const tenantId = process.argv[2];
const count = parseInt(process.argv[3], 10);
const startIndex = parseInt(process.argv[4], 10);
const operation = (process.argv[5] || 'FT') as 'FT' | 'NC';
const idempotencyKey = process.argv[6] || undefined;

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function main() {
  const results: any[] = [];
  const errors: any[] = [];

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;
    try {
      const inv = await issueInvoice({
        customerName: `Dist ${tenantId.slice(-8)}-${idx}`,
        customerNif: '5000000001',
        items: [{ productId: null, desc: `DIST-${operation}-${idx}`, qty: 1, rate: 100 + idx }],
        applyVat: true,
        discountType: 'amount',
        discountValue: 0,
        observations: `dist-${operation}-${idx}`,
        includeCompanyProfile: false,
        dueAt: null,
      }, tenantId, undefined, idempotencyKey);
      results.push({
        index: idx,
        id: inv.id,
        number: inv.number,
        hash: inv.hash,
        chainSequence: inv.chainSequence,
        hashVersion: inv.hashVersion,
      });
    } catch (e: any) {
      errors.push({
        index: idx,
        message: e.message,
        code: e.code,
      });
    }
  }

  // Count FT vs NC results
  const ftCount = results.filter(r => r.number.startsWith('FT')).length;
  const ncCount = results.filter(r => r.number.startsWith('NC')).length;

  process.stdout.write(JSON.stringify({
    tenantId,
    count,
    startIndex,
    operation,
    pid: process.pid,
    results,
    errors,
    ftCount,
    ncCount,
  }));
  process.exit(0);
}

main().catch(e => {
  process.stderr.write(e.message);
  process.exit(1);
});
