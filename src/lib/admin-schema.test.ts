import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const schema = readFileSync(resolve(root, 'prisma/schema.prisma'), 'utf8');
const registration = readFileSync(resolve(root, 'src/app/api/auth/register/route.ts'), 'utf8');

describe('platform administration schema contract', () => {
  it('defines non-privileged defaults and separate tenant/platform roles', () => {
    expect(schema).toMatch(/enum PlatformRole\s*\{\s*NONE\s+ADMIN\s+SUPERADMIN\s+COMPANY_MANAGER\s+USER_MANAGER\s+DOCUMENT_MANAGER\s+AUDITOR\s+SUPPORT\s*\}/);
    expect(schema).toMatch(/platformPermissions\s+String\[\]\s+@default\(\[\]\)/);
    expect(schema).toMatch(/platformRole\s+PlatformRole\s+@default\(NONE\)/);
    expect(schema).toMatch(/tenantRole\s+TenantRole\s+@default\(USER\)/);
    expect(schema).toMatch(/tenantId\s+String\?/);
  });

  it('adds reversible account states, global config, and audit history', () => {
    expect(schema).toMatch(/enum AccountStatus\s*\{\s*ACTIVE\s+SUSPENDED\s*\}/);
    expect(schema).toMatch(/status\s+AccountStatus\s+@default\(ACTIVE\)/);
    expect(schema).toMatch(/model PlatformConfig\s*\{/);
    expect(schema).toMatch(/model AdminAuditLog\s*\{/);
  });

  it('creates a tenant owner without granting platform access in the registration transaction', () => {
    expect(registration).toContain('$transaction');
    expect(registration).toMatch(/tenantRole:\s*'COMPANY_ADMIN'/);
    expect(registration).toMatch(/platformRole:\s*'NONE'/);
  });
});
