// E2E HTTP — Emissão de Nota de Crédito com autenticação, tenant isolation e idempotência.
// Requer servidor Next.js em execução (E2E_PORT default 3002) e base descartável com seed WMS.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { login, authenticatedFetch } from '../wms/http-auth-harness';

const prisma = new PrismaClient();
const APP_URL = process.env.APP_URL || 'http://localhost:3002';
const enabled = !!process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('supabase.com') && !!process.env.APP_URL;
const describeIf = enabled ? describe : describe.skip;

async function createDraftAndIssue(session: any) {
  const draft = await authenticatedFetch('/api/invoices/drafts', session, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'A17 NC HTTP Customer',
      customerNif: '5000000001',
      items: [{ productId: 'e2e00000-0000-0000-0000-ppppppppppp1', desc: 'A17 item', qty: 1, rate: 100 }],
      applyVat: true, discountType: 'amount', discountValue: 0,
      observations: null, includeCompanyProfile: false, dueAt: null,
    }),
  });
  if (!draft.ok) throw new Error(`create draft failed: ${draft.status} ${await draft.text()}`);
  const draftBody = await draft.json();
  const draftId = draftBody.draft?.id ?? draftBody.id;
  if (!draftId) throw new Error('missing draft id');

  const issueRes = await authenticatedFetch(`/api/invoices/drafts/${draftId}/issue`, session, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!issueRes.ok) throw new Error(`issue FT failed: ${issueRes.status}`);
  // Find the newly issued FT via Prisma to obtain its id
  const ft = await prisma.invoice.findFirst({
    where: { sourceDraftId: draftId, type: 'FT' },
    orderBy: { chainSequence: 'desc' },
  });
  if (!ft) throw new Error('could not locate the freshly issued FT');
  return ft.id;
}

describeIf('A17 — NC HTTP route', () => {
  let ftInvoiceId = '';

  beforeAll(async () => {
    // Sanity: disposable DB is reachable and the seeded WMS tenant exists.
    const count = await prisma.tenant.count({ where: { id: { startsWith: 'e2e00000-0000-0000-0000-' } } });
    if (count < 2) throw new Error('WMS seed missing — did you run tests/e2e/wms/seed.mjs?');
    const session = await login('e2e-test@machinefacturas.test', 'TestPass123!');
    ftInvoiceId = await createDraftAndIssue(session);
  }, 180_000);

  afterAll(async () => { await prisma.$disconnect(); });

  it('issues a NC for a valid FT with correct tenant; response is PDF', async () => {
    const session = await login('e2e-test@machinefacturas.test', 'TestPass123!');
    const res = await authenticatedFetch(`/api/invoices/${ftInvoiceId}/credit-note`, session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'A17 retoma de devolução' }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString('utf8')).toBe('%PDF');
    const nc = await prisma.invoice.findFirst({
      where: { refInvoiceNumber: (await prisma.invoice.findUnique({ where: { id: ftInvoiceId }, select: { number: true } }))?.number, type: 'NC' },
    });
    expect(nc).toBeTruthy();
    expect(nc?.status).toBe('ISSUED');
  }, 180_000);

  it('rejects an unauthenticated request (HTTP 401 or 302)', async () => {
    const res = await fetch(`${APP_URL}/api/invoices/${ftInvoiceId}/credit-note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'INV TEST' }),
    });
    expect([401, 302]).toContain(res.status);
  }, 30_000);

  it('returns 400 when reason is absent', async () => {
    const session = await login('e2e-test@machinefacturas.test', 'TestPass123!');
    const res = await authenticatedFetch(`/api/invoices/${ftInvoiceId}/credit-note`, session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  }, 30_000);

  it('returns 404 for an unknown invoice id', async () => {
    const session = await login('e2e-test@machinefacturas.test', 'TestPass123!');
    const res = await authenticatedFetch('/api/invoices/does-not-exist/credit-note', session, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'A17' }),
    });
    expect(res.status).toBe(404);
  }, 30_000);

  it('issues a fresh FT and rejects a second NC for the same invoice (409)', async () => {
    const session = await login('e2e-test@machinefacturas.test', 'TestPass123!');
    const ftId = await createDraftAndIssue(session);
    const first = await authenticatedFetch(`/api/invoices/${ftId}/credit-note`, session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'DOC dupla' }),
    });
    expect(first.status).toBe(200);
    const second = await authenticatedFetch(`/api/invoices/${ftId}/credit-note`, session, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'DOC duplicada' }),
    });
    expect(second.status).toBe(409);
  }, 60_000);
});
