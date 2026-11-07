#!/usr/bin/env node
/*
 * Alinha o histórico de migrations de uma BD EXISTENTE (staging/produção)
 * onde as tabelas já foram criadas por `prisma db push`.
 *
 *   node scripts/align-prod-migrations.cjs            # dry-run (não escreve nada)
 *   node scripts/align-prod-migrations.cjs --apply    # aplica (snapshot + resolve)
 *
 * Segurança:
 *   - Exige DATABASE_URL no ambiente (nunca imprime a password).
 *   - Snapshot do `_prisma_migrations` antes de qualquer escrita.
 *   - Só mexe nas migrations pendentes conhecidas:
 *       * 20261105233000_auth_jwt_revocation_phase1  (aplica SQL se a tabela faltar)
 *       * 20261107190000_stock_schema_baseline       (resolve --applied)
 *       * 20261107191000_align_nonstock_indexes      (resolve --applied)
 *   - Qualquer outra migration pendente ABORTA (deve ser aplicada com migrate deploy).
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const JWT = '20261105233000_auth_jwt_revocation_phase1';
const STOCK = '20261107190000_stock_schema_baseline';
const INDEX = '20261107191000_align_nonstock_indexes';
const KNOWN = new Set([JWT, STOCK, INDEX]);
const ROLES = ['anon', 'authenticated', 'service_role', 'mf_app_nobypass', 'mf_admin_executor', 'mf_migration', 'mf_rls_staging'];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL ausente. Define-a no ambiente (não a coloques em ficheiros versionados).');
  process.exit(1);
}

function repoMigrations() {
  return fs.readdirSync('prisma/migrations', { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{14}_/.test(d.name))
    .map((d) => d.name)
    .sort();
}

function prisma(args, env) {
  const res = spawnSync('npx', ['prisma', ...args], { cwd: process.cwd(), stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
  return res.status;
}

(async () => {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 20000, query_timeout: 60000 });
  await client.connect();
  try {
    const migTable = await client.query(`SELECT to_regclass('public."_prisma_migrations"') AS t`);
    const applied = new Set();
    if (migTable.rows[0].t) {
      const rows = await client.query(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
      );
      rows.rows.forEach((r) => applied.add(r.migration_name));
    }
    const pending = repoMigrations().filter((m) => !applied.has(m));
    const unknown = pending.filter((m) => !KNOWN.has(m));

    const tables = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1::text[])`,
      [['Supplier', 'PurchaseOrder', 'StockLot', 'ProductWarehouseStock', 'AuthJwtRevocation']]
    );
    const present = new Set(tables.rows.map((r) => r.tablename));

    console.log('migrations pendentes:', pending.length ? pending.join(', ') : '(nenhuma)');
    console.log('objetos presentes:', [...present].join(', ') || '(nenhum)');

    if (unknown.length) {
      console.error('\nABORTADO: há migrations pendentes fora do conjunto conhecido:', unknown.join(', '));
      console.error('Aplica-as primeiro com `prisma migrate deploy` num ambiente controlado.');
      process.exit(2);
    }
    if (!pending.length) {
      console.log('\nNada a fazer: histórico já está alinhado.');
      return;
    }

    const jwtMissing = !present.has('AuthJwtRevocation');
    const stockMissing = !present.has('Supplier') || !present.has('PurchaseOrder') || !present.has('StockLot');

    if (!APPLY) {
      console.log('\nDRY-RUN — nada foi escrito. Plano:');
      if (pending.includes(JWT)) console.log(`  - ${JWT}: ${jwtMissing ? 'aplicar SQL (tabela ausente)' : 'resolve --applied (tabela já existe)'}`);
      if (pending.includes(STOCK)) console.log(`  - ${STOCK}: ${stockMissing ? 'ATENÇÃO: tabelas ausentes; correr migrate deploy' : 'resolve --applied'}`);
      if (pending.includes(INDEX)) console.log(`  - ${INDEX}: resolve --applied`);
      console.log('\nCorre com --apply para executar.');
      if (stockMissing) process.exit(3);
      return;
    }

    if (stockMissing) {
      console.error('\nABORTADO: tabelas de stock ausentes — esta BD precisa de migrate deploy, não de resolve.');
      process.exit(3);
    }

    const snapshotFile = path.join('tmp', `migrations-snapshot-${Date.now()}.json`);
    const snapshot = await client.query(`SELECT * FROM "_prisma_migrations" ORDER BY started_at`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot.rows, null, 2), 'utf8');
    console.log('\nsnapshot:', snapshotFile, `(${snapshot.rowCount} linhas)`);

    for (const role of ROLES) {
      await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE "${role}" NOLOGIN; END IF; END $$;`);
    }
    console.log('roles garantidas');

    if (pending.includes(JWT) && jwtMissing) {
      const sql = fs.readFileSync(path.join('prisma', 'migrations', JWT, 'migration.sql'), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        console.log(`${JWT}: SQL aplicado`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  for (const name of [JWT, STOCK, INDEX]) {
    if (!repoMigrations().includes(name)) continue;
    prisma(['migrate', 'resolve', '--applied', name], { DATABASE_URL: url });
  }
  prisma(['migrate', 'status'], { DATABASE_URL: url });
})().catch((err) => {
  console.error('\nFALHOU:', err.message);
  process.exit(1);
});
