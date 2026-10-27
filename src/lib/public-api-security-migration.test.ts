import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = readFileSync(resolve(root, 'prisma/migrations/20261027180000_public_api_security/migration.sql'), 'utf8');
const migrationSql = migration.replace(/--.*$/gm, '');
const verifier = readFileSync(resolve(root, 'prisma/security/verify_public_api_security.sql'), 'utf8');

describe('Supabase public API security migration', () => {
  it('enables RLS and removes Data API access without broad tenant policies', () => {
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC, anon, authenticated');
    expect(migration).toContain('GRANT USAGE ON SCHEMA public TO service_role');
    expect(migrationSql).not.toMatch(/CREATE\s+POLICY|auth\.uid\s*\(/i);
  });

  it('requires DDL ownership and checks the post-migration API boundary', () => {
    expect(migration).toContain('rolsuper');
    expect(migration).toContain('c.relowner <> current_role_oid');
    expect(migration).toContain('BYPASSRLS alone is not sufficient');
    expect(verifier).toContain("has_schema_privilege('anon', 'public', 'USAGE')");
    expect(verifier).toContain("has_schema_privilege('authenticated', 'public', 'USAGE')");
    expect(verifier).toContain("has_function_privilege(role_name, p.oid, 'EXECUTE')");
    expect(verifier).toContain('has_any_column_privilege');
  });
});
