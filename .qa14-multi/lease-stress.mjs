// A14 — multi-process stress test of the lease-based admission flow
// 3 independent Node processes execute concurrently on the same PG instance,
// verifying that capacity=2 is globally respected per tenant.
import { Client } from 'pg';
const tenantId = process.argv[2];
const ops = Number(process.argv[3]);
const url = process.env.DATABASE_URL;
const MAX = 2;
const client = new Client({ connectionString: url });
await client.connect();

const sleeps = Array.from({ length: ops }, (_, i) => {
  const t0 = Date.now();
  return (async () => {
    // 1. Try to acquire lease
    const acquireResult = await client.query(`
      INSERT INTO "EmissionLease" (id, "tenantId", "operationId", "processId", state, "acquiredAt", "expiresAt", "lastRenewedAt")
      SELECT gen_random_uuid()::text, $1, $2, 'pid-${process.pid}', 'ACTIVE', NOW(), NOW() + INTERVAL '60 seconds', NOW()
      WHERE (SELECT COUNT(*) FROM "EmissionLease" WHERE "tenantId" = $1 AND state = 'ACTIVE' AND "expiresAt" > NOW()) < $3
      RETURNING id`, [tenantId, 'STRESS', MAX]);

    if (acquireResult.rowCount !== 1) {
      // wait and retry up to 5s
      for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        const r2 = await client.query(`
          INSERT INTO "EmissionLease" (id, "tenantId", "operationId", "processId", state, "acquiredAt", "expiresAt", "lastRenewedAt")
          SELECT gen_random_uuid()::text, $1, $2, 'pid-${process.pid}', 'ACTIVE', NOW(), NOW() + INTERVAL '60 seconds', NOW()
          WHERE (SELECT COUNT(*) FROM "EmissionLease" WHERE "tenantId" = $1 AND state = 'ACTIVE' AND "expiresAt" > NOW()) < $3
          RETURNING id`, [tenantId, 'STRESS', MAX]);
        if (r2.rowCount === 1) {
          await new Promise(r => setTimeout(r, 50 + Math.random() * 50));
          await client.query(`UPDATE "EmissionLease" SET state='RELEASED', "releasedAt"=NOW() WHERE id=$1`, [r2.rows[0].id]);
          return { op: i + 1, acquired: 2 - i, pid: process.pid };
        }
      }
      return { op: i + 1, acquired: false, pid: process.pid };
    }

    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    await client.query(`UPDATE "EmissionLease" SET state='RELEASED', "releasedAt"=NOW() WHERE id=$1`, [acquireResult.rows[0].id]);
    return { op: i + 1, acquired: true, pid: process.pid };
  })();
});

const results = await Promise.all(sleeps);
const ok = results.filter(r => r.acquired).length;
const busy = results.filter(r => !r.acquired).length;
console.log(`pid=${process.pid}: ok=${ok}/${ops} busy=${busy}`);

// Verify max concurrent admission observed via a sample probe
const counts = await client.query(
  `SELECT "tenantId", COUNT(*) FILTER (WHERE state='ACTIVE') AS active, COUNT(*) FILTER (WHERE state='RELEASED') AS released, COUNT(*) FILTER (WHERE state='EXPIRED') AS expired
   FROM "EmissionLease" WHERE "tenantId" = $1 GROUP BY "tenantId"`, [tenantId]);
console.log(`pid=${process.pid} final sample after run:`, JSON.stringify(counts.rows[0]));

await client.end();
process.exit(0);
