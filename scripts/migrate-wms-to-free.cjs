#!/usr/bin/env node
/*
 * Migração comercial: empresas legadas (grandfathering) passam para Grátis,
 * removendo o acesso ao WMS sem apagar dados de stock.
 *
 * Uso:
 *   node scripts/migrate-wms-to-free.cjs --exclude-email=joaquimzumbuca@gmail.com            # dry-run
 *   node scripts/migrate-wms-to-free.cjs --exclude-email=joaquimzumbuca@gmail.com --execute  # grava
 *
 * Idempotente: só considera tenants com WMS ligado e sem subscrição ativa.
 * Exclui o(s) tenant(s) cujo utilizador tenha o email indicado.
 */
const { Client } = require('pg');
const crypto = require('crypto');

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL ausente.'); process.exit(1); }

const args = process.argv.slice(2);
const execute = args.includes('--execute');
const excludeArg = args.find((a) => a.startsWith('--exclude-email='));
const excludeEmail = excludeArg ? excludeArg.split('=').slice(1).join('=').trim().toLowerCase() : '';
const REASON = 'Migração comercial: WMS reservado a pacotes pagos (aprovação do proprietário)';

(async () => {
  const ssl = /supabase\.(com|co)/.test(url) ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString: url, ssl, connectionTimeoutMillis: 20000, query_timeout: 60000 });
  await client.connect();
  try {
    const plan = await client.query(`SELECT id, slug FROM "SubscriptionPlan" WHERE slug = 'gratis'`);
    if (plan.rowCount !== 1) throw new Error('Plano gratis inexistente.');
    const gratisPlanId = plan.rows[0].id;
    const app = await client.query(`SELECT id FROM "PlatformApplication" WHERE slug = 'wms'`);
    if (app.rowCount !== 1) throw new Error('Aplicação wms inexistente.');
    const wmsAppId = app.rows[0].id;

    const { rows } = await client.query(`
      SELECT t.id, t.name, t.plan,
        ta.enabled AS wms_enabled,
        s.plan_slug, s.status AS subscription_status, s.ends_at,
        COALESCE(s.max_warehouses, 0) AS max_warehouses,
        COALESCE(array_agg(DISTINCT u.email) FILTER (WHERE u.email IS NOT NULL), '{}') AS emails
      FROM "Tenant" t
      LEFT JOIN "TenantApplication" ta ON ta."tenantId" = t.id AND ta."applicationId" = $1
      LEFT JOIN LATERAL (
        SELECT p.slug AS plan_slug, ts.status, ts."endsAt" AS ends_at, pl.value AS max_warehouses
        FROM "TenantSubscription" ts
        JOIN "SubscriptionPlan" p ON p.id = ts."planId"
        LEFT JOIN "PlanLimit" pl ON pl."planId" = p.id AND pl.metric = 'max_warehouses'
        WHERE ts."tenantId" = t.id
        ORDER BY ts."startsAt" DESC LIMIT 1
      ) s ON true
      LEFT JOIN "User" u ON u."tenantId" = t.id
      GROUP BY t.id, t.name, t.plan, ta.enabled, s.plan_slug, s.status, s.ends_at, s.max_warehouses
      ORDER BY t."createdAt" DESC
    `, [wmsAppId]);

    const now = Date.now();
    const candidates = rows.filter((r) => {
      const active = r.subscription_status
        && ['ACTIVE', 'TRIAL'].includes(r.subscription_status)
        && (!r.ends_at || new Date(r.ends_at).getTime() > now);
      if (active) return false;
      if (!r.wms_enabled) return false;
      const emails = r.emails || [];
      return !(excludeEmail && emails.some((e) => e.toLowerCase() === excludeEmail));
    });

    const excluded = rows.filter((r) => (r.emails || []).some((e) => e.toLowerCase() === excludeEmail));
    if (excludeEmail && excluded.length === 0) throw new Error(`Email de exclusão não encontrado: ${excludeEmail}`);

    const before = (await client.query(`
      SELECT (SELECT count(*)::int FROM "Warehouse") AS warehouses,
             (SELECT count(*)::int FROM "Product") AS products,
             (SELECT count(*)::int FROM "StockMovement") AS movements,
             (SELECT count(*)::int FROM "ProductWarehouseStock") AS balances
    `)).rows[0];

    console.log(`MODO: ${execute ? 'EXECUTAR' : 'DRY-RUN'}`);
    console.log(`Excluído(s): ${excluded.map((t) => `${t.name} (${(t.emails || []).join(', ')})`).join(' | ') || '—'}`);
    console.log(`Migrar: ${candidates.length}`);
    for (const t of candidates) console.log(` - ${t.name} [${t.id}] wms=${t.wms_enabled ? 'on' : 'off'} plano=${t.plan_slug || '—'} emails=${(t.emails || []).join(', ') || '—'}`);

    if (!execute) {
      console.log('\nDry-run: nada foi alterado. Use --execute para aplicar.');
      return;
    }

    await client.query('BEGIN');
    for (const t of candidates) {
      await client.query(`DELETE FROM "TenantSubscription" WHERE "tenantId" = $1`, [t.id]);
      await client.query(
        `INSERT INTO "TenantSubscription" (id, "tenantId", "planId", status, "startsAt", "endsAt", "autoRenew", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, 'ACTIVE', now(), NULL, false, now(), now())`,
        [t.id, gratisPlanId],
      );
      await client.query(
        `INSERT INTO "TenantApplication" (id, "tenantId", "applicationId", enabled, "enabledAt", "disabledAt", config, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, false, NULL, now(), NULL, now(), now())
         ON CONFLICT ("tenantId", "applicationId") DO UPDATE SET enabled = false, "enabledAt" = NULL, "disabledAt" = now(), "updatedAt" = now()`,
        [t.id, wmsAppId],
      );
      await client.query(`UPDATE "Tenant" SET plan = 'FREE', "planExpiry" = NULL WHERE id = $1`, [t.id]);
      await client.query(
        `INSERT INTO "AdminAuditLog" (id, "actorUserId", "actorType", action, "resourceType", "resourceId", reason, result, metadata, "createdAt")
         VALUES (gen_random_uuid(), NULL, 'SYSTEM', 'TENANT_PACKAGE_CHANGED', 'TENANT', $1, $2, 'SUCCESS', $3::jsonb, now())`,
        [t.id, REASON, JSON.stringify({ package: 'gratis', wmsEnabled: false, previous: 'grandfathered', excludedEmail: excludeEmail || null })],
      );
      console.log(`✓ ${t.name} → Grátis (WMS desactivado, dados mantidos)`);
    }
    await client.query('COMMIT');

    const after = (await client.query(`
      SELECT (SELECT count(*)::int FROM "Warehouse") AS warehouses,
             (SELECT count(*)::int FROM "Product") AS products,
             (SELECT count(*)::int FROM "StockMovement") AS movements,
             (SELECT count(*)::int FROM "ProductWarehouseStock") AS balances
    `)).rows[0];

    console.log('\nDados antes/depois:', JSON.stringify({ before, after }));
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Contagens de dados mudaram — verificar!');
    console.log('Concluído com sucesso.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('FALHOU:', err.message);
    process.exit(1);
  } finally {
    await client.end().catch(() => {});
  }
})();
