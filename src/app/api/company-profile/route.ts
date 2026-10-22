import { NextResponse } from 'next/server';
import { getTenantReadAccess, getTenantWriteAccess } from '@/lib/tenant-api-access';
import { prisma } from '@/lib/prisma';
import { validateCompanyProfileInput } from '@/lib/company-profile-validation';

const profileFields = {
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
} as const;

function toProfileResponse(tenant: {
  id: string;
  name: string;
  legalName: string | null;
  nif: string | null;
  address: string | null;
  municipality: string | null;
  province: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  iban: string | null;
  brandColor: string | null;
  invoiceFooter: string | null;
  defaultMessage: string | null;
  defaultCurrency: string;
  documentLanguage: string;
  defaultPaymentDays: number | null;
  defaultPaymentMethod: string | null;
  defaultObservations: string | null;
  currentLogo: { id: string; mimeType: string; content: Uint8Array } | null;
}) {
  return {
    id: tenant.id,
    name: tenant.name,
    legalName: tenant.legalName,
    nif: tenant.nif,
    address: tenant.address,
    municipality: tenant.municipality,
    province: tenant.province,
    country: tenant.country,
    phone: tenant.phone,
    email: tenant.email,
    website: tenant.website,
    bankName: tenant.bankName,
    bankAccountName: tenant.bankAccountName,
    iban: tenant.iban,
    brandColor: tenant.brandColor,
    invoiceFooter: tenant.invoiceFooter,
    defaultMessage: tenant.defaultMessage,
    defaultCurrency: tenant.defaultCurrency,
    documentLanguage: tenant.documentLanguage,
    defaultPaymentDays: tenant.defaultPaymentDays,
    defaultPaymentMethod: tenant.defaultPaymentMethod,
    defaultObservations: tenant.defaultObservations,
    logoDataUrl: tenant.currentLogo
      ? `data:${tenant.currentLogo.mimeType};base64,${Buffer.from(tenant.currentLogo.content).toString('base64')}`
      : null,
  };
}

export async function GET() {
  try {
    const access = await getTenantReadAccess();
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, ...profileFields, currentLogo: { select: { id: true, mimeType: true, content: true } } },
    });
    if (!tenant) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });

    return NextResponse.json({ profile: toProfileResponse(tenant) });
  } catch (error) {
    console.error('Erro ao buscar perfil da empresa:', error);
    return NextResponse.json({ error: 'Erro ao buscar dados da empresa' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const access = await getTenantWriteAccess('company_settings');
    if (!access.ok) return NextResponse.json(access.body, { status: access.status });
    const { tenantId } = access.access;

    const formData = await request.formData();
    const validation = await validateCompanyProfileInput(formData);
    if (!validation.isValid || !validation.value) {
      return NextResponse.json({ error: 'Verifica os dados do perfil', errors: validation.errors }, { status: 400 });
    }

    const { logo, removeLogo, ...profile } = validation.value;
    const updatedTenant = await prisma.$transaction(async (transaction: any) => {
      const logoRecord = logo
        ? await transaction.companyLogo.create({
          data: {
            tenantId,
            mimeType: logo.type,
            content: Buffer.from(await logo.arrayBuffer()),
          },
          select: { id: true },
        })
        : null;

      const tenant = await transaction.tenant.update({
        where: { id: tenantId },
        data: {
          ...profile,
          ...(logoRecord ? { currentLogoId: logoRecord.id } : {}),
          ...(removeLogo ? { currentLogoId: null } : {}),
        },
        select: { id: true, ...profileFields, currentLogo: { select: { id: true, mimeType: true, content: true } } },
      });

      await transaction.companyLogo.deleteMany({
        where: {
          tenantId,
          ...(tenant.currentLogo ? { id: { not: tenant.currentLogo.id } } : {}),
          invoices: { none: {} },
        },
      });
      return tenant;
    });

    return NextResponse.json({ profile: toProfileResponse(updatedTenant) });
  } catch (error) {
    console.error('Erro ao actualizar perfil da empresa:', error);
    return NextResponse.json({ error: 'Erro ao guardar dados da empresa' }, { status: 500 });
  }
}
