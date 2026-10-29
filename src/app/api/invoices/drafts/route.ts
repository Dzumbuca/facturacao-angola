import { NextRequest, NextResponse } from 'next/server';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { createInvoiceDraft, listInvoiceDrafts, InvoiceDraftServiceError } from '@/lib/invoice-draft-service';
import { validateInvoiceDraftInput } from '@/lib/invoice-draft-validation';
import { isOfflineGrantForAccess } from '@/lib/offline-grant-core';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const access = await getTenantReadAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  return NextResponse.json({ drafts: await listInvoiceDrafts(tenantId) });
}

export async function POST(request: NextRequest) {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status });
  const { tenantId } = access.access;
  const offlineToken = request.headers.get('X-Desktop-Offline-Grant');
  if (offlineToken) {
    const privatePem = process.env.DESKTOP_OFFLINE_GRANT_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!privatePem) return NextResponse.json({ error: 'A autorização offline não está configurada.' }, { status: 403 });
    try {
      const currentUser = await prisma.user.findFirst({ where: { id: access.access.userId, tenantId, status: 'ACTIVE' }, select: { sessionVersion: true } });
      const allowed = currentUser && access.access.tenantRole !== 'VIEWER' && isOfflineGrantForAccess(offlineToken, createPublicKey(createPrivateKey(privatePem)), {
        userId: access.access.userId, tenantId, tenantRole: access.access.tenantRole, sessionVersion: currentUser.sessionVersion,
      });
      if (!allowed || access.access.tenantStatus !== 'ACTIVE') {
        return NextResponse.json({ error: 'A autorização offline já não permite sincronizar este rascunho.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'A autorização offline é inválida.' }, { status: 403 });
    }
  }
  const body = await request.json().catch(() => null);
  if (body && typeof body === 'object' && 'id' in body && (typeof body.id !== 'string' || !UUID.test(body.id))) {
    return NextResponse.json({ error: 'Identificador de rascunho inválido.' }, { status: 400 });
  }
  const validation = validateInvoiceDraftInput(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });
  try {
    const draft = await createInvoiceDraft(validation.value, tenantId, body?.id);
    return NextResponse.json({ draft }, { status: body?.id ? 200 : 201 });
  } catch (error) {
    if (error instanceof InvoiceDraftServiceError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error('Erro ao guardar rascunho de factura:', error);
    return NextResponse.json({ error: 'Não foi possível guardar o rascunho.' }, { status: 500 });
  }
}
