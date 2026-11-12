// E2E HTTP — comunicados internos.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from './http-auth-harness';

const prisma = new PrismaClient();
const stamp = Date.now();
let tenantAId = '';
let announcementId = '';

beforeAll(async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'e2e-test@machinefacturas.test' }, select: { tenantId: true } });
  tenantAId = admin?.tenantId ?? '';
});

afterAll(async () => {
  if (announcementId) await prisma.rhAnnouncement.deleteMany({ where: { tenantId: tenantAId, id: announcementId } });
  await prisma.$disconnect();
});

describe('Machine RH — comunicados internos', () => {
  it('publica comunicado e lista correctamente', async () => {
    const admin = await login();
    const create = await authenticatedFetch('/api/rh/announcements', admin, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `E2E Comunicado ${stamp}`, body: 'Visita de segurança amanhã às 09h.', priority: 'ALTA' }),
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    announcementId = created.id;
    expect(created.priority).toBe('ALTA');

    const list = await authenticatedFetch('/api/rh/announcements', admin);
    expect(list.status).toBe(200);
    const listData = await list.json();
    expect(listData.some((item: any) => item.id === announcementId)).toBe(true);
  });

  it('isolamento por empresa', async () => {
    const sessionB = await login('e2e-other@machinefacturas.test');
    const list = await authenticatedFetch('/api/rh/announcements', sessionB);
    expect(list.status).toBe(200);
    const listData = await list.json();
    expect(listData.some((item: any) => item.id === announcementId)).toBe(false);
  });
});
