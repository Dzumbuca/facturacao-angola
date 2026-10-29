import { createPrivateKey } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTenantWriteAccess } from '@/lib/tenant-api-access';
import { signOfflineGrant, MAX_OFFLINE_GRANT_SECONDS } from '@/lib/offline-grant-core';

export const runtime = 'nodejs';

export async function POST() {
  const access = await getTenantWriteAccess();
  if (!access.ok) return NextResponse.json(access.body, { status: access.status, headers: { 'Cache-Control': 'no-store' } });
  const { userId, tenantId, tenantRole } = access.access;
  if (tenantRole === 'VIEWER') return NextResponse.json({ error: 'A sua função não permite criar rascunhos offline.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });

  const [user, tenant, customers, products, drafts, bankAccounts] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' }, select: { sessionVersion: true } }),
    prisma.tenant.findFirst({ where: { id: tenantId, status: 'ACTIVE' }, select: {
      id: true, name: true, legalName: true, nif: true, address: true, municipality: true, province: true,
      country: true, phone: true, email: true, website: true, bankName: true, bankAccountName: true, iban: true,
      brandColor: true, invoiceFooter: true, defaultCurrency: true, documentLanguage: true,
      defaultPaymentDays: true, defaultPaymentMethod: true, defaultObservations: true,
      currentLogo: { select: { id: true, mimeType: true, content: true } },
    } }),
    prisma.customer.findMany({ where: { tenantId }, select: { id: true, name: true, nif: true, address: true, email: true } }),
    prisma.product.findMany({ where: { tenantId }, select: { id: true, name: true, description: true, price: true, taxRate: true, codigo: true, categoria: true } }),
    prisma.invoiceDraft.findMany({ where: { tenantId, status: 'DRAFT' }, orderBy: { updatedAt: 'desc' } }),
    prisma.companyBankAccount.findMany({ where: { tenantId, isActive: true }, select: { id: true, bankName: true, accountHolder: true, iban: true, currency: true, label: true, isPrimary: true } }),
  ]);
  if (!user || !tenant) return NextResponse.json({ error: 'A autorização offline não está disponível.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const pem = process.env.DESKTOP_OFFLINE_GRANT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!pem) return NextResponse.json({ error: 'A autorização offline ainda não está configurada.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const issuedAt = Math.floor(Date.now() / 1000);
  let grant: string;
  try {
    grant = signOfflineGrant({ userId, tenantId, tenantRole, sessionVersion: user.sessionVersion, canCreateInvoiceDrafts: true, issuedAt, expiresAt: issuedAt + MAX_OFFLINE_GRANT_SECONDS }, createPrivateKey(pem));
  } catch (error) {
    console.error('Desktop offline grant signing configuration is invalid.', error);
    return NextResponse.json({ error: 'A autorização offline não pôde ser preparada.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  const profile = tenant && { ...tenant, logoDataUrl: tenant.currentLogo ? `data:${tenant.currentLogo.mimeType};base64,${Buffer.from(tenant.currentLogo.content).toString('base64')}` : null };
  return NextResponse.json({ grant, snapshot: { profile, customers, products, drafts, bankAccounts }, issuedAt, expiresAt: issuedAt + MAX_OFFLINE_GRANT_SECONDS }, { headers: { 'Cache-Control': 'no-store, private' } });
}
