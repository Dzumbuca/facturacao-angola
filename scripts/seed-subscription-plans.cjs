#!/usr/bin/env node
/*
 * Semeia os pacotes comerciais e limites de WMS (idempotente).
 * Preços ficam a 0 até definição comercial; SKUs não têm limite (null).
 *
 *   node scripts/seed-subscription-plans.cjs
 */
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente.');
  process.exit(1);
}

const PLANS = [
  { slug: 'gratis', name: 'Grátis', limits: { max_warehouses: 0 } },
  { slug: 'basico', name: 'Básico', limits: { max_warehouses: 1 } },
  { slug: 'profissional', name: 'Profissional', limits: { max_warehouses: 3 } },
  { slug: 'empresarial', name: 'Empresarial', limits: {} },
];

(async () => {
  const ssl = /supabase\.(com|co)/.test(url) ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000, query_timeout: 60000 });
  await client.connect();
  try {
    for (const plan of PLANS) {
      const inserted = await client.query(
        `INSERT INTO "SubscriptionPlan" (id, slug, name, description, "priceKz", "billingCycle", "isBundle", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $2, 0, 'MONTHLY', false, true, now(), now())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, "isActive" = true, "updatedAt" = now()
         RETURNING id`,
        [plan.slug, plan.name],
      );
      const planId = inserted.rows[0].id;
      for (const [metric, value] of Object.entries(plan.limits)) {
        await client.query(
          `INSERT INTO "PlanLimit" (id, "planId", metric, value)
           VALUES (gen_random_uuid(), $1, $2, $3)
           ON CONFLICT ("planId", metric) DO UPDATE SET value = EXCLUDED.value`,
          [planId, metric, value],
        );
      }
    }
    const count = await client.query('SELECT slug, "priceKz" FROM "SubscriptionPlan" ORDER BY slug');
    console.log('planos:', count.rows.map((r) => `${r.slug} (${r.priceKz})`).join(', '));
  } finally {
    await client.end().catch(() => {});
  }
})().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exit(1);
});
