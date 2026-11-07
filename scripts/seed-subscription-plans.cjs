#!/usr/bin/env node
/*
 * Semeia os pacotes comerciais, preços e limites/capabilities (idempotente).
 * Preços de lançamento: 5.000 / 12.500 / 25.000 Kz; anual com 15% desconto.
 * SKUs continuam sem limite definido (null, não aplicado).
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
  {
    slug: 'gratis', name: 'Grátis', priceKz: 0, priceYearly: null,
    limits: { max_warehouses: 0, max_products: 30, max_clients: 30, max_invoices_per_month: 15 },
    capabilities: { transfers: false },
  },
  {
    slug: 'basico', name: 'Básico', priceKz: 5000, priceYearly: 51000,
    limits: { max_warehouses: 1, max_products: 100, max_clients: 100, max_invoices_per_month: 100 },
    capabilities: { transfers: false },
  },
  {
    slug: 'profissional', name: 'Profissional', priceKz: 12500, priceYearly: 127500,
    limits: { max_warehouses: 3, max_products: 500, max_clients: 500 },
    capabilities: { transfers: true },
  },
  {
    slug: 'empresarial', name: 'Empresarial', priceKz: 25000, priceYearly: 255000,
    limits: { max_warehouses: 10 },
    capabilities: { transfers: true },
  },
];

(async () => {
  const ssl = /supabase\.(com|co)/.test(url) ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000, query_timeout: 60000 });
  await client.connect();
  try {
    for (const plan of PLANS) {
      const inserted = await client.query(
        `INSERT INTO "SubscriptionPlan" (id, slug, name, description, "priceKz", "priceYearly", "billingCycle", "isBundle", "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $2, $3, $4, 'MONTHLY', false, true, now(), now())
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, "priceKz" = EXCLUDED."priceKz", "priceYearly" = EXCLUDED."priceYearly", "isActive" = true, "updatedAt" = now()
         RETURNING id`,
        [plan.slug, plan.name, plan.priceKz, plan.priceYearly],
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
      for (const [capability, enabled] of Object.entries(plan.capabilities)) {
        await client.query(
          `INSERT INTO "PlanCapability" (id, "planId", capability, enabled)
           VALUES (gen_random_uuid(), $1, $2, $3)
           ON CONFLICT ("planId", capability) DO UPDATE SET enabled = EXCLUDED.enabled`,
          [planId, capability, enabled],
        );
      }
    }
    const rows = await client.query('SELECT slug, "priceKz", "priceYearly" FROM "SubscriptionPlan" ORDER BY "priceKz"');
    console.log('planos:', rows.rows.map((r) => `${r.slug} ${r.priceKz}/${r.priceYearly ?? '-'}`).join(' · '));
  } finally {
    await client.end().catch(() => {});
  }
})().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exit(1);
});
