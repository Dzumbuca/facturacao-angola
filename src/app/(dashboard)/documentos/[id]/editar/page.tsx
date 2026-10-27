import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTenantAccess } from '@/lib/admin-auth';
import { BusinessDocumentForm } from '../../business-document-form';
import { BUSINESS_DOCUMENT_TYPES, type BusinessDocumentInput, type BusinessDocumentType } from '@/lib/business-document-core';

export const dynamic = 'force-dynamic';
export default async function EditBusinessDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getTenantAccess();
  if (access.tenantRole === 'VIEWER') redirect('/documentos');
  const { id } = await params;
  const [document, customers, products] = await Promise.all([
    prisma.businessDocument.findFirst({ where: { id, tenantId: access.tenantId }, include: { items: { orderBy: { position: 'asc' } } } }),
    prisma.customer.findMany({ where: { tenantId: access.tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, nif: true, address: true } }),
    prisma.product.findMany({ where: { tenantId: access.tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, codigo: true, price: true, taxRate: true } }),
  ]);
  if (!document) notFound();
  if (document.status !== 'DRAFT') redirect(`/documentos/${id}`);
  const snapshot = document.customerSnapshot as { name?: string; nif?: string | null; address?: string | null } | null;
  const initialDocument = {
    id: document.id, type: document.type,
    title: document.title, customerId: document.customerId,
    counterpartyName: document.customerId ? null : snapshot?.name ?? null,
    counterpartyNif: document.customerId ? null : snapshot?.nif ?? null,
    counterpartyAddress: document.customerId ? null : snapshot?.address ?? null,
    issueDate: document.issueDate.toISOString().slice(0, 10), validUntil: document.validUntil?.toISOString().slice(0, 10) ?? null,
    currency: document.currency, details: document.details, notes: document.notes,
    items: (document.items as Array<{ productId: string | null; description: string; quantity: unknown; unitPrice: unknown; taxRate: unknown }>).map((item) => ({ productId: item.productId, description: item.description, quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), taxRate: Number(item.taxRate) })),
  } as BusinessDocumentInput & { id: string };
  return <BusinessDocumentForm customers={customers} products={(products as Array<{ id: string; name: string; codigo: string | null; price: unknown; taxRate: unknown }>).map((product) => ({ id: product.id, name: product.name, code: product.codigo, price: Number(product.price), taxRate: Number(product.taxRate) }))} initialType={document.type as BusinessDocumentType} initialDocument={initialDocument} />;
}
