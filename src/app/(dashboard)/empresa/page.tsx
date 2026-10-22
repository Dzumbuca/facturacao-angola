import { auth } from '@/lib/auth';
import { getSessionTenantId } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { CompanyProfileForm } from './company-profile-form';
import { prisma as database } from '@/lib/prisma';

export default async function CompanyProfilePage() {
  const tenantId = getSessionTenantId(await auth());
  if (!tenantId) return <p>Empresa não configurada.</p>;

  const [tenant, bankAccounts] = await Promise.all([prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      legalName: true,
      nif: true,
      address: true,
      municipality: true,
      province: true,
      country: true,
      phone: true,
      email: true,
      website: true,
      bankName: true,
      bankAccountName: true,
      iban: true,
      brandColor: true,
      invoiceFooter: true,
      defaultMessage: true,
      defaultCurrency: true,
      documentLanguage: true,
      defaultPaymentDays: true,
      defaultPaymentMethod: true,
      defaultObservations: true,
      currentLogo: { select: { mimeType: true, content: true } },
    },
  }), database.companyBankAccount.findMany({ where: { tenantId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] })]);
  if (!tenant) return <p>Empresa não configurada.</p>;

  return <CompanyProfileForm initialBankAccounts={bankAccounts} initialProfile={{
    name: tenant.name,
    legalName: tenant.legalName ?? '',
    nif: tenant.nif ?? '',
    address: tenant.address ?? '',
    municipality: tenant.municipality ?? '',
    province: tenant.province ?? '',
    country: tenant.country ?? '',
    phone: tenant.phone ?? '',
    email: tenant.email ?? '',
    website: tenant.website ?? '',
    bankName: tenant.bankName ?? '',
    bankAccountName: tenant.bankAccountName ?? '',
    iban: tenant.iban ?? '',
    brandColor: tenant.brandColor ?? '',
    invoiceFooter: tenant.invoiceFooter ?? '',
    defaultMessage: tenant.defaultMessage ?? '',
    defaultCurrency: tenant.defaultCurrency,
    documentLanguage: tenant.documentLanguage,
    defaultPaymentDays: tenant.defaultPaymentDays?.toString() ?? '',
    defaultPaymentMethod: tenant.defaultPaymentMethod ?? '',
    defaultObservations: tenant.defaultObservations ?? '',
    logoDataUrl: tenant.currentLogo
      ? `data:${tenant.currentLogo.mimeType};base64,${Buffer.from(tenant.currentLogo.content).toString('base64')}`
      : null,
  }} />;
}
