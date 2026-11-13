#!/usr/bin/env node
const { Client } = require('pg');
const tenantId = process.argv.find((a) => a.startsWith('--id='))?.split('=')[1] || process.env.MARSTORE_TENANT_ID || 'f8340e32-80f5-4d53-98c7-aeb820328821';
const url = process.env.DATABASE_URL;
const ssl = /supabase\.(com|co)/.test(url || '') || /supabase\.(com|co)/.test(process.env.PGHOST || '') ? { rejectUnauthorized: false } : undefined;
const config = url ? { connectionString: url, ssl } : { host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE || 'postgres', ssl };
(async () => {
  if (!process.env.DATABASE_URL && !process.env.PGHOST) { console.error('Define DATABASE_URL ou PGHOST/PGUSER/PGPASSWORD/PGDATABASE.'); process.exit(1); }
  const client = new Client({ ...config, connectionTimeoutMillis: 20000, query_timeout: 60000 });
  await client.connect();
  try {
    const id = tenantId;
    const facturasApp = await client.query(
      `INSERT INTO "PlatformApplication" (id, slug, name, description, icon, version, status, "isCore", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'machine-facturas', 'Machine Facturas', 'Facturacao, proformas, recibos e clientes.', '/logo.png', '1.0.0', 'ACTIVE', true, now(), now())
       ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE', "updatedAt" = now() RETURNING id`,
    );
    const rhApp = await client.query(
      `INSERT INTO "PlatformApplication" (id, slug, name, description, icon, version, status, "isCore", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'rh', 'Machine RH', 'Gestao de RH, assiduidade, ferias e processamento salarial.', '/icons/rh-logo.png', '1.0.0', 'ACTIVE', false, now(), now())
       ON CONFLICT (slug) DO UPDATE SET status = 'ACTIVE', "updatedAt" = now() RETURNING id`,
    );
    const rhId = rhApp.rows[0].id;
    const wmsApp = await client.query(`SELECT id FROM "PlatformApplication" WHERE slug = 'wms'`);
    const wmsId = wmsApp.rows[0]?.id;

    const businessPlan = await client.query(`SELECT id FROM "SubscriptionPlan" WHERE slug = 'business'`);
    if (businessPlan.rowCount === 0) throw new Error('Plano business não existe.');

    await client.query('BEGIN');
    await client.query(`DELETE FROM "TenantSubscription" WHERE "tenantId" = $1`, [id]);
    await client.query(
      `INSERT INTO "TenantSubscription" (id, "tenantId", "planId", status, "startsAt", "endsAt", "autoRenew", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', now(), NULL, false, now(), now())`,
      [id, businessPlan.rows[0].id],
    );
    if (wmsId) {
      await client.query(
        `INSERT INTO "TenantApplication" (id, "tenantId", "applicationId", enabled, "enabledAt", config, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, true, now(), NULL, now(), now())
         ON CONFLICT ("tenantId", "applicationId") DO UPDATE SET enabled = true, "enabledAt" = now(), "disabledAt" = NULL, "updatedAt" = now()`,
        [id, wmsId],
      );
    }
    await client.query(
      `INSERT INTO "TenantApplication" (id, "tenantId", "applicationId", enabled, "enabledAt", config, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, true, now(), NULL, now(), now())
       ON CONFLICT ("tenantId", "applicationId") DO UPDATE SET enabled = true, "enabledAt" = now(), "disabledAt" = NULL, "updatedAt" = now()`,
      [id, rhId],
    );
    await client.query(`UPDATE "Tenant" SET plan = 'PRO', "planExpiry" = NULL WHERE id = $1`, [id]);
    await client.query(
      `INSERT INTO "AdminAuditLog" ("id", "action", "resourceType", "resourceId", "reason", "createdAt")
       VALUES (gen_random_uuid(), 'TENANT_PLAN_CHANGED', 'TENANT', $1, 'Marstore atribuida ao plano Business com Stock e RH', now())`,
      [id],
    );
    await client.query('COMMIT');
    console.log('OK: tenant', id, 'registada no plano Business.');
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { await client.end(); }
})().catch((e) => { console.error('FALHOU:', e.message); process.exit(1); });
