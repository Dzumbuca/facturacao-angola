import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { getInvoiceQuota } from '@/lib/invoice-quota';
import { InvoiceForm } from './invoice-form';

export default async function NewInvoicePage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;

  const [customers, products, tenant, bankAccounts, quota, platformConfig] = await Promise.all([
    prisma.customer.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        nif: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        bankName: true,
        bankAccountName: true,
        iban: true,
        currentLogoId: true,
        defaultPaymentDays: true,
        defaultObservations: true,
        defaultMessage: true,
      },
    }),
    prisma.companyBankAccount.findMany({ where: { tenantId, isActive: true }, orderBy: [{ isPrimary: 'desc' }, { bankName: 'asc' }], select: { id: true, bankName: true, label: true } }),
    getInvoiceQuota(tenantId),
    // Anúncio de plataforma (HTML gerido em /admin/configuracoes) apresentado na
    // janela de desbloqueio — o mesmo código já usado na sidebar pública.
    // Falha de base de dados nunca quebra a página: o modal fica sem anúncio.
    prisma.platformConfig.findUnique({ where: { id: 'global' }, select: { adHtml: true } }).catch(() => null),
  ]);
  const hasCompanyProfile = Boolean(tenant && (
    tenant.currentLogoId || [
      tenant.nif,
      tenant.address,
      tenant.phone,
      tenant.email,
      tenant.website,
      tenant.bankName,
      tenant.bankAccountName,
      tenant.iban,
    ].some((value) => value?.trim())
  ));
  const initialDueAt = tenant?.defaultPaymentDays !== null && tenant?.defaultPaymentDays !== undefined
    ? new Date(Date.now() + tenant.defaultPaymentDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Luanda' })
    : '';

  return <InvoiceForm
    initialCustomers={customers.map((customer: { id: string; name: string; nif: string | null }) => ({ id: customer.id, name: customer.name, nif: customer.nif }))}
    initialProducts={products.map((product: { id: string; codigo: string | null; name: string; price: unknown; stock: number; categoria: string }) => ({
      id: product.id,
      codigo: product.codigo,
      name: product.name,
      price: Number(product.price),
      stock: product.stock,
      categoria: product.categoria,
    }))}
    hasCompanyProfile={hasCompanyProfile}
    bankAccounts={bankAccounts}
    initialDueAt={initialDueAt}
    defaultObservations={tenant?.defaultObservations || tenant?.defaultMessage || ''}
    quota={quota}
    adHtml={platformConfig?.adHtml ?? null}
  />;
}
