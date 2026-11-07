#!/usr/bin/env node
/*
 * Cria as roles PostgreSQL exigidas pelas migrations de segurança/RLS/JWT
 * (Supabase Data API + executor RLS) numa base de dados alvo.
 * Idempotente: apenas CREATE ROLE ... NOLOGIN se não existir.
 *
 * Uso: DATABASE_URL=postgresql://... node scripts/ensure-db-roles.cjs
 */
const { Client } = require('pg');

const ROLES = [
  'anon',
  'authenticated',
  'service_role',
  'mf_app_nobypass',
  'mf_admin_executor',
  'mf_migration',
  'mf_rls_staging',
];

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL ausente.');
  const ssl = /supabase\.(com|co)/.test(url) ? { rejectUnauthorized: false } : undefined;
  const client = new Client({ connectionString: url, ssl });
  await client.connect();
  try {
    for (const role of ROLES) {
      await client.query(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE "${role}" NOLOGIN; END IF; END $$;`
      );
    }
    const check = await client.query(
      `SELECT rolname FROM pg_roles WHERE rolname = ANY($1::text[]) ORDER BY 1`,
      [ROLES]
    );
    console.log('roles ok:', check.rows.map((r) => r.rolname).join(', '));
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error('ensure-db-roles falhou:', err.message);
  process.exit(1);
});
