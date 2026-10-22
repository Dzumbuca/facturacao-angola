import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { InvoiceForm } from '../../../new/invoice-form';

type Props = { params: Promise<{ id: string }> };

export default async function EditInvoiceDraftPage({ params }: Props) {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;
  const { id } = await params;
  const [draft, customers, products, tenant, bankAccounts] = await Promise.all([
    prisma.invoiceDraft.findFirst({ where: { id, tenantId, status: 'DRAFT' } }),
    prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { nif: true, address: true, phone: true, email: true, website: true, bankName: true, bankAccountName: true, iban: true, currentLogoId: true } }),
    prisma.companyBankAccount.findMany({ where: { tenantId, isActive: true }, orderBy: [{ isPrimary: 'desc' }, { bankName: 'asc' }], select: { id: true, bankName: true, label: true } }),
  ]);
  if (!draft) notFound();
  const rawItems: unknown[] = Array.isArray(draft.items) ? draft.items : [];
  const items = rawItems.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    return [{ desc: String(item.desc ?? ''), qty: Number(item.qty ?? 1), rate: Number(item.rate ?? 0), productId: typeof item.productId === 'string' ? item.productId : null }];
  });
  const hasCompanyProfile = Boolean(tenant && (tenant.currentLogoId || [tenant.nif, tenant.address, tenant.phone, tenant.email, tenant.website, tenant.bankName, tenant.bankAccountName, tenant.iban].some((value) => value?.trim())));
  return <InvoiceForm
    initialCustomers={customers.map((customer: { id: string; name: string; nif: string | null }) => ({ id: customer.id, name: customer.name, nif: customer.nif }))}
    initialProducts={products.map((product: { id: string; codigo: string | null; name: string; price: unknown; stock: number; categoria: string }) => ({ id: product.id, codigo: product.codigo, name: product.name, price: Number(product.price), stock: product.stock, categoria: product.categoria }))}
    hasCompanyProfile={hasCompanyProfile}
    bankAccounts={bankAccounts}
    initialDraft={{ id: draft.id, customerName: draft.customerName, customerNif: draft.customerNif, items, applyVat: draft.applyVat, discountType: draft.discountType, discountValue: Number(draft.discountValue), observations: draft.observations, includeCompanyProfile: draft.includeCompanyProfile, dueAt: draft.dueAt?.toISOString().slice(0, 10) ?? '', companyBankAccountId: draft.companyBankAccountId }}
  />;
}
