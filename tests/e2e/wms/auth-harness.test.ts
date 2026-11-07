// tests/e2e/wms/auth-harness.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const TEST_TENANT_ID = 'e2e00000-0000-0000-0000-000000000001';
const TEST_USER_EMAIL = 'e2e-test@machinefacturas.test';
const TEST_USER_PASSWORD = 'TestPass123!';

describe('WMS v2 E2E - Auth Harness (staging)', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('seeded test user exists and is ACTIVE', async () => {
    const user = await (prisma.user as any).findUnique({ where: { email: TEST_USER_EMAIL } });
    expect(user).not.toBeNull();
    expect(user.status).toBe('ACTIVE');
    expect(user.tenantId).toBe(TEST_TENANT_ID);
    expect(user.emailVerificationRequired).toBe(false);
  });

  it('seeded test user password validates against bcrypt', async () => {
    const user = await (prisma.user as any).findUnique({ where: { email: TEST_USER_EMAIL } });
    const valid = await bcrypt.compare(TEST_USER_PASSWORD, user.password);
    expect(valid).toBe(true);
  });

  it('test user is linked to test tenant only (no cross-tenant)', async () => {
    const user = await (prisma.user as any).findUnique({ where: { email: TEST_USER_EMAIL } });
    expect(user.tenantId).toBe(TEST_TENANT_ID);
  });
});