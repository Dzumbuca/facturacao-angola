// tests/e2e/wms/wms-module-gate.test.ts
// Verifica que o módulo WMS bloqueia páginas e APIs quando desactivado no tenant.
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const BASE = process.env.APP_URL || 'http://localhost:3002';
const TENANT_B = 'e2e00000-0000-0000-0000-000000000002';
const USER_B = 'e2e-other@machinefacturas.test';

async function setWms(enabled: boolean) {
  const app = await prisma.platformApplication.findUniqueOrThrow({ where: { slug: 'wms' } });
  await prisma.tenantApplication.upsert({
    where: { tenantId_applicationId: { tenantId: TENANT_B, applicationId: app.id } },
    update: { enabled, enabledAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
    create: { tenantId: TENANT_B, applicationId: app.id, enabled, enabledAt: enabled ? new Date() : null, disabledAt: enabled ? null : new Date() },
  });
}

afterAll(async () => {
  await setWms(true).catch(() => {});
  await prisma.$disconnect().catch(() => {});
});

describe('WMS module gate', () => {
  it('API de stock devolve 403 quando o módulo está desactivado', async () => {
    const session = await login(USER_B);
    await setWms(false);
    try {
      const res = await authenticatedFetch('/api/stock/movements', session);
      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({ code: 'APP_NOT_ENABLED', app: 'wms' });
    } finally {
      await setWms(true);
    }
  });

  it('API de stock volta a 200 quando o módulo é reactivado', async () => {
    const session = await login(USER_B);
    const res = await authenticatedFetch('/api/stock/movements', session);
    expect(res.status).toBe(200);
  });

  it('página /stock redireciona para /apps quando o módulo está desactivado', async () => {
    const session = await login(USER_B);
    await setWms(false);
    try {
      const res = await fetch(`${BASE}/stock`, { headers: { Cookie: session.cookies }, redirect: 'manual' });
      expect(res.status).toBe(307);
      expect(res.headers.get('location') || '').toContain('/apps');
    } finally {
      await setWms(true);
    }
  });
});
