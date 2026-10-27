import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getTenantAccess } from '@/lib/admin-auth';
import { BUSINESS_DOCUMENT_TYPES, type BusinessDocumentType } from '@/lib/business-document-core';
import { BusinessDocumentForm } from '../business-document-form';

export const dynamic = 'force-dynamic';
export default async function NewBusinessDocumentPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const access = await getTenantAccess();
  if (access.tenantRole === 'VIEWER') redirect('/documentos');
  const params = await searchParams;
  const initialType = (BUSINESS_DOCUMENT_TYPES.includes(params.type as BusinessDocumentType) ? params.type : 'QUOTE') as BusinessDocumentType;
  const [customers, products] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId: access.tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, nif: true, address: true } }),
    prisma.product.findMany({ where: { tenantId: access.tenantId }, orderBy: { name: 'asc' }, select: { id: true, name: true, codigo: true, price: true, taxRate: true } }),
  ]);
  return <BusinessDocumentForm customers={customers} products={(products as Array<{ id: string; name: string; codigo: string | null; price: unknown; taxRate: unknown }>).map((product) => ({ id: product.id, name: product.name, code: product.codigo, price: Number(product.price), taxRate: Number(product.taxRate) }))} initialType={initialType} />;
}
