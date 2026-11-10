#!/usr/bin/env node
/*
 * Auditoria READ-ONLY do acesso ao WMS por empresa.
 * Não altera permissões, subscrições nem dados.
 *
 *   node scripts/audit-wms-access.cjs
 */
const { Client } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente.');
  process.exit(1);
}

(async () => {
  const ssl = /supabase\.(com|co)/.test(url) ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000, query_timeout: 60000 });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT
        t.id,
        t.name,
        t.status,
        t.plan AS legacy_plan,
        ta.enabled AS wms_enabled,
        s.slug AS subscription_plan,
        s.status AS subscription_status,
        s."endsAt" AS subscription_ends_at,
        COALESCE(s.max_warehouses, 0) AS max_warehouses
      FROM "Tenant" t
      LEFT JOIN "PlatformApplication" a ON a.slug = 'wms'
      LEFT JOIN "TenantApplication" ta ON ta."tenantId" = t.id AND ta."applicationId" = a.id
      LEFT JOIN LATERAL (
        SELECT p.slug, ts.status, ts."endsAt", pl.value AS max_warehouses
        FROM "TenantSubscription" ts
        JOIN "SubscriptionPlan" p ON p.id = ts."planId"
        LEFT JOIN "PlanLimit" pl ON pl."planId" = p.id AND pl.metric = 'max_warehouses'
        WHERE ts."tenantId" = t.id
        ORDER BY ts."startsAt" DESC
        LIMIT 1
      ) s ON true
      ORDER BY t."createdAt" DESC
    `);

    const now = Date.now();
    const classified = rows.map((r) => {
      const active = r.subscription_plan
        && ['ACTIVE', 'TRIAL'].includes(r.subscription_status)
        && (!r.subscription_ends_at || new Date(r.subscription_ends_at).getTime() > now);
      let state;
      if (active) state = Number(r.max_warehouses) > 0 ? 'ALLOWED_PAID' : 'BLOCKED_FREE';
      else if (r.wms_enabled) state = 'GRANDFATHERED';
      else state = 'BLOCKED_FREE';
      return { ...r, state };
    });

    const counts = classified.reduce((acc, r) => { acc[r.state] = (acc[r.state] || 0) + 1; return acc; }, {});
    console.log(JSON.stringify({ totalTenants: classified.length, counts, tenants: classified }, null, 2));
  } finally {
    await client.end().catch(() => {});
  }
})().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exit(1);
});
