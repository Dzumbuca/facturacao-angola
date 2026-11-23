import { PrismaClient } from '@prisma/client';

/**
 * Prisma singleton.
 *
 * Pooler consideration (Supabase Pooler transaction mode bare `?pgbouncer=true`):
 *   - Direct mode (port 5432 direct to database) is the recommended path for
 *     migrations and pg_dump consistency — use `DIRECT_DATABASE_URL` if available.
 *   - Transaction pooler (port 6543) is required by Vercel/serverless to avoid
 *     exhausting connection limits. Pooler does NOT support prepared statements,
 *     so commands holding advisory locks must execute inside a single transaction.
 *   - `connection_limit` is controlled by the URL querystring (`?connection_limit=N`),
 *     not by this PrismaClient instance. The value depends on the Supabase tier
 *     and the Vercel function instances count. For serverless use the conservative
 *     default `1` unless the tier explicitly allows more connections.
 *
 * Transaction policy used by this app:
 *   - `runWithTenant` wraps each fiscal operation in `$transaction` with
 *     `isolationLevel: 'ReadCommitted'` (default) — RLS context is set inside.
 *   - For PG SELECT FOR UPDATE queries on Tenant/windows, this is sufficient.
 *   - `maxWait: 10_000` (default Prisma is 2_000) gives room for slow queries.
 *   - `timeout: 20_000` caps how long a transaction may stay open before the
 *     client aborts and sends a rollback.
 *
 * Do NOT use `engineType: 'library'` in any other file. Changing engines risks
 * breaking RLS without proper notification to DBA.
 *
 * Do NOT bump `connection_limit` on serverless without honoring Supabase tier.
 * Connection exhaustion will produce noisy ERR_REQ_LIMIT_DATABASE in the client.
 */

const globalForPrisma = global as unknown as { prisma: any };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  // Use default engineType = library; do not override to binary in serverless.
  transactionOptions: {
    // Allow generous time for all lock acquisitions including advisory locks.
    maxWait: 10_000,
    // Bound total transaction time; 20 seconds is reasonable for fiscal ops.
    timeout: 20_000,
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
