#!/usr/bin/env node
/*
 * Regista o módulo WMS como PlatformApplication e activa-o (grandfathering)
 * para todos os tenants existentes. Idempotente: não desactiva o que já existe.
 *
 *   node scripts/seed-wms-application.cjs
 *
 * Seguro para correr antes do deploy do gate: só escreve em tabelas de módulos.
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
    const app = await client.query(
      `INSERT INTO "PlatformApplication" (id, slug, name, description, icon, version, status, "isCore", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'wms', 'Armazém e Stock', 'Gestão de armazéns, stock, movimentos, transferências, lotes, reservas e compras.', '📦', '1.0.0', 'ACTIVE', false, now(), now())
       ON CONFLICT (slug) DO UPDATE
         SET name = EXCLUDED.name, description = EXCLUDED.description, status = 'ACTIVE', "updatedAt" = now()
       RETURNING id, slug`,
    );
    const appId = app.rows[0].id;
    console.log(`app ${app.rows[0].slug} = ${appId}`);

    const before = await client.query(
      `SELECT count(*)::int AS n FROM "TenantApplication" WHERE "applicationId" = $1 AND enabled = true`,
      [appId],
    );
    const inserted = await client.query(
      `INSERT INTO "TenantApplication" (id, "tenantId", "applicationId", enabled, "enabledAt", config, "createdAt", "updatedAt")
       SELECT gen_random_uuid(), t.id, $1, true, now(), NULL, now(), now()
       FROM "Tenant" t
       ON CONFLICT ("tenantId", "applicationId") DO NOTHING
       RETURNING "tenantId"`,
      [appId],
    );
    const after = await client.query(
      `SELECT count(*)::int AS n FROM "TenantApplication" WHERE "applicationId" = $1 AND enabled = true`,
      [appId],
    );
    console.log(`tenants com WMS: antes=${before.rows[0].n} novos=${inserted.rowCount} total=${after.rows[0].n}`);
  } finally {
    await client.end().catch(() => {});
  }
})().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exit(1);
});
