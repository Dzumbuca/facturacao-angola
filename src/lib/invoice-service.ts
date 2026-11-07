import { generateInvoiceHash, getInvoiceSigningKey } from './crypto';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { runWithTenant } from './tenant-db';
import { calculateInvoiceTotals } from './tax';
import { computeEffectivePlan } from './plan';
import { FREE_INVOICE_LIMIT, AdUnlockRequiredError } from './invoice-quota';
import { claimUnlockForEmission, linkUnlockToInvoice } from './ad-unlock-service';
import { decrementStockForInvoice } from './stock-service';

export const issueInvoice = async (
  invoiceData: any,
  tenantId: string,
  beforePersist?: (invoiceDraft: any) => Promise<void>,
) => {
  // Todas as operacoes de emissao executam dentro de uma transacao Prisma que
  // tambem define o contexto app.tenant_id para RLS. Uma transacao Prisma por
  // si so NAO ativa o contexto RLS; e necessario definir app.tenant_id
  // explicitamente dentro da mesma transacao.
  const result = await runWithTenant(tenantId, async (transaction: any) => {
    const tenant = await transaction.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new Error('Empresa autenticada nao encontrada.');
    const includeCompanyProfile = invoiceData.includeCompanyProfile !== false;
    const companyBankAccount = includeCompanyProfile
      ? await transaction.companyBankAccount.findFirst({
        where: invoiceData.companyBankAccountId
          ? { id: invoiceData.companyBankAccountId, tenantId: tenant.id, isActive: true }
          : { tenantId: tenant.id, isActive: true, isPrimary: true },
        select: { bankName: true, accountHolder: true, iban: true, currency: true, label: true },
      })
      : null;
    if (includeCompanyProfile && invoiceData.companyBankAccountId && !companyBankAccount) {
      throw new Error('A conta bancária seleccionada não está disponível.');
    }
    const companyProfileSnapshot = includeCompanyProfile
      ? Object.fromEntries(Object.entries({
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
        bankName: companyBankAccount?.bankName ?? (!invoiceData.companyBankAccountId ? tenant.bankName : null),
        bankAccountName: companyBankAccount?.accountHolder ?? (!invoiceData.companyBankAccountId ? tenant.bankAccountName : null),
        iban: companyBankAccount?.iban ?? (!invoiceData.companyBankAccountId ? tenant.iban : null),
        bankAccountLabel: companyBankAccount?.label,
        bankAccountCurrency: companyBankAccount?.currency,
        brandColor: tenant.brandColor,
        invoiceFooter: tenant.invoiceFooter,
      }).filter(([, value]) => typeof value === 'string' && value.trim())) as Record<string, string>
      : null;
    const companyLogo = includeCompanyProfile && tenant.currentLogoId
      ? await transaction.companyLogo.findFirst({
        where: { id: tenant.currentLogoId, tenantId: tenant.id },
        select: { id: true, mimeType: true, content: true },
      })
      : null;

    // 2. Obter ou criar o Cliente
    let customer = await transaction.customer.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { nif: invoiceData.customerNif || undefined },
          { name: invoiceData.customerName }
        ]
      }
    });

    if (!customer) {
      customer = await transaction.customer.create({
        data: {
          tenantId: tenant.id,
          name: invoiceData.customerName || 'Consumidor Final',
          nif: invoiceData.customerNif || null,
        }
      });
    }

    // 3. Obter a última fatura para a cadeia de Hash
    const lastInvoice = await transaction.invoice.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' }
    });

    const previousHash = lastInvoice ? lastInvoice.hash : null;

    // 4. Calcular o número sequencial da fatura — feito dentro da transacao
    //    com lock no Tenant para serializar emissoes concorrentes.
    const invoiceCount = await transaction.invoice.count({
      where: { tenantId: tenant.id, type: 'FT' }
    });
    const currentYear = new Date().getFullYear();
    const invoiceNumber = `FT ${currentYear}/${invoiceCount + 1}`;

    // 5. Calcular totais
    const applyVat = invoiceData.applyVat !== false;
    const discountType = invoiceData.discountType === 'percent' ? 'percent' : 'amount';
    const discountValue = Number(invoiceData.discountValue) || 0;
    const { subTotal, discountAmount, taxTotal, total } = calculateInvoiceTotals(invoiceData.items || [], { type: discountType, value: discountValue, applyVat });
    const observations = typeof invoiceData.observations === 'string' ? invoiceData.observations.trim() || null : null;

    // 6. Gerar o Hash Fiscal
    const issuedAt = new Date();
    const hash = generateInvoiceHash({
      ...invoiceData,
      customerName: customer.name,
      customerNif: customer.nif,
      number: invoiceNumber,
      subTotal,
      discountAmount,
      discountType,
      discountValue,
      applyVat,
      observations,
      includeCompanyProfile,
      companyProfileSnapshot,
      companyLogoId: companyLogo?.id ?? null,
      total,
      taxTotal
    }, previousHash, issuedAt);

    // 7. Gerar Assinatura Digital RSA
    const sign = crypto.createSign('SHA256');
    sign.update(hash);
    const signature = sign.sign(getInvoiceSigningKey(), 'base64');

    // 4 caracteres de controlo (padrão AGT: 1º, 11º, 21º e 31º caracteres da assinatura em Base64)
    const shortHash = signature.length >= 31
      ? `${signature[0]}${signature[10]}${signature[20]}${signature[30]}`
      : signature.substring(0, 4);

    // Build the exact output first. A PDF failure must not leave an issued invoice in the database.
    if (beforePersist) {
      await beforePersist({
        ...invoiceData,
        number: invoiceNumber,
        type: 'FT',
        status: 'ISSUED',
        subTotal,
        discountAmount,
        discountType,
        discountValue,
        applyVat,
        observations,
        includeCompanyProfile,
        currency: invoiceData.currency ?? 'AOA',
        companyProfileSnapshot,
        companyLogo,
        taxTotal,
        total,
        hash,
        previousHash,
        signature,
        shortHash,
        issuedAt,
        createdAt: issuedAt,
        tenant,
        customer,
        customerName: customer.name,
        customerNif: customer.nif,
      });
    }

    // 8. Persistir na Base de Dados PostgreSQL
    const invoiceCreateData = {
      data: {
        tenantId: tenant.id,
        customerId: customer.id,
        number: invoiceNumber,
        type: 'FT',
        status: 'ISSUED',
        subTotal: subTotal,
        discountAmount,
        discountType,
        discountValue,
        applyVat,
        observations,
        includeCompanyProfile,
        companyProfileSnapshot: companyProfileSnapshot ?? Prisma.DbNull,
        companyLogoId: companyLogo?.id ?? null,
        taxTotal: taxTotal,
        total: total,
        hash: hash,
        previousHash: previousHash,
        signature: signature,
        issuedAt,
        dueAt: invoiceData.dueAt ? new Date(invoiceData.dueAt) : null,
        sourceDraftId: invoiceData.sourceDraftId ?? null,
        items: {
          create: (invoiceData.items || []).map((item: any) => ({
            productId: item.productId || null,
            description: item.desc || 'Item sem descrição',
            quantity: item.qty || 1,
            unitPrice: item.rate || 0,
            taxRate: applyVat ? 14.00 : 0,
            total: (item.qty || 1) * (item.rate || 0),
          }))
        }
      },
      include: {
        customer: true,
        items: true,
        tenant: true
      }
    };

    // Serializa emissões da empresa: fecha a janela de corrida no limite.
    await transaction.$queryRaw`SELECT id FROM "Tenant" WHERE id = ${tenant.id} FOR UPDATE`;
    const planInfo = computeEffectivePlan(tenant.plan, tenant.planExpiry);
    const usedInvoices = await transaction.invoice.count({
      where: { tenantId: tenant.id, type: 'FT' },
    });
    let claimedUnlockId: string | null = null;
    if (planInfo.effectivePlan !== 'PRO' && usedInvoices >= FREE_INVOICE_LIMIT) {
      claimedUnlockId = await claimUnlockForEmission(tenant.id, transaction);
      if (!claimedUnlockId) throw new AdUnlockRequiredError(usedInvoices, FREE_INVOICE_LIMIT);
    }
    const saved = await transaction.invoice.create(invoiceCreateData);

    // Baixa automatica de estoque para cada item da fatura que tenha produto associado
    const invoiceItems = (invoiceData.items || []).filter(
      (item: any) => item.productId && item.qty > 0
    );
    if (invoiceItems.length > 0) {
      const defaultWarehouse = await transaction.warehouse.findFirst({
        where: { tenantId: tenant.id, isDefault: true, isActive: true },
      });
      if (!defaultWarehouse) throw new Error('Nenhum armazem padrao configurado para o tenant');

      await decrementStockForInvoice(
        tenant.id,
        saved.id,
        defaultWarehouse.id,
        invoiceItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.qty,
        })),
        transaction
      );
    }

    if (invoiceData.sourceDraftId) {
      const updatedDraft = await transaction.invoiceDraft.updateMany({
        where: { id: invoiceData.sourceDraftId, tenantId: tenant.id, status: 'ISSUING' },
        data: { status: 'ISSUED' },
      });
      if (updatedDraft.count !== 1) throw new Error('O rascunho foi alterado durante a emissão.');
    }
    return { saved, claimedUnlockId, tenantId, shortHash, customerName: customer.name, customerNif: customer.nif, items: invoiceData.items };
  });

  // Auditoria do desbloqueio (best-effort, após commit): liga o desbloqueio à
  // factura emitida. Se falhar, o desbloqueio continua CONSUMED — nunca reutilizável.
  // linkUnlockToInvoice usa o cliente prisma global (fora da transacao)
  // por proposito — nao deve reverter a fatura se falhar.
  if (result.claimedUnlockId) {
    await linkUnlockToInvoice(result.tenantId, result.claimedUnlockId, result.saved.id).catch(() => undefined);
  }

  return {
    ...result.saved,
    customerName: result.customerName,
    customerNif: result.customerNif,
    shortHash: result.shortHash,
    items: result.items,
  };
};

export const issueCreditNote = async (params: {
  invoiceId?: string;
  invoiceNumber?: string;
  reason: string;
  tenantId?: string;
}) => {
  // O tenantId deve vir do contexto autenticado (ex.: sessão), nunca de um
  // identificador fornecido livremente pelo cliente. Quando nao fornecido,
  // e derivado da fatura original (ja validada como pertencente ao tenant).
  const authenticatedTenantId = params.tenantId;
  if (!authenticatedTenantId) {
    throw new Error('TENANT_REQUIRED');
  }

  const result = await runWithTenant(authenticatedTenantId, async (tx: any) => {
    // 1. Localizar a fatura original dentro do contexto do tenant
    const whereClause: any = {
      OR: [
        { id: params.invoiceId },
        { number: params.invoiceNumber }
      ]
    };
    whereClause.tenantId = authenticatedTenantId;

    const originalInvoice = await tx.invoice.findFirst({
      where: whereClause,
      include: {
        customer: true,
        items: true,
        tenant: true
      }
    });

    if (!originalInvoice) {
      throw new Error('Fatura de referência não encontrada.');
    }

    if (originalInvoice.status === 'ANULADA') {
      throw new Error('Esta fatura já foi anulada por outra Nota de Crédito.');
    }

    // O tenantId e obtido do contexto autenticado ou validado contra a fatura
    const tenantId = authenticatedTenantId || originalInvoice.tenantId;

    // 2. Obter a última fatura/documento para a cadeia de Hash
    const lastDocument = await tx.invoice.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' }
    });

    const previousHash = lastDocument ? lastDocument.hash : null;

    // 3. Gerar numeração sequencial para Nota de Crédito (NC) dentro da transacao
    //    para evitar numeracao duplicada em emissoes concorrentes.
    const ncCount = await tx.invoice.count({
      where: { tenantId, type: 'NC' }
    });
    const currentYear = new Date().getFullYear();
    const ncNumber = `NC ${currentYear}/${ncCount + 1}`;

    // 4. Gerar o Hash Fiscal da Nota de Crédito
    const hash = generateInvoiceHash({
      customerName: originalInvoice.customer.name,
      customerNif: originalInvoice.customer.nif,
      number: ncNumber,
      refInvoiceNumber: originalInvoice.number,
      subTotal: originalInvoice.subTotal,
      taxTotal: originalInvoice.taxTotal,
      total: originalInvoice.total,
      cancelReason: params.reason
    }, previousHash);

    // 5. Gerar Assinatura Digital RSA
    const sign = crypto.createSign('SHA256');
    sign.update(hash);
    const signature = sign.sign(getInvoiceSigningKey(), 'base64');

    const shortHash = signature.length >= 31
      ? `${signature[0]}${signature[10]}${signature[20]}${signature[30]}`
      : signature.substring(0, 4);

    // 6. Criar a Nota de Crédito na BD
    const creditNote = await tx.invoice.create({
      data: {
        tenantId,
        customerId: originalInvoice.customerId,
        number: ncNumber,
        type: 'NC',
        status: 'ISSUED',
        refInvoiceNumber: originalInvoice.number,
        cancelReason: params.reason,
        includeCompanyProfile: originalInvoice.includeCompanyProfile,
        companyProfileSnapshot: originalInvoice.companyProfileSnapshot ?? Prisma.DbNull,
        companyLogoId: originalInvoice.companyLogoId,
        currency: originalInvoice.currency,
        subTotal: originalInvoice.subTotal,
        discountAmount: originalInvoice.discountAmount,
        discountType: originalInvoice.discountType,
        discountValue: originalInvoice.discountValue,
        applyVat: originalInvoice.applyVat,
        taxTotal: originalInvoice.taxTotal,
        total: originalInvoice.total,
        hash,
        previousHash,
        signature,
        items: {
          create: originalInvoice.items.map((item: any) => ({
            description: `[Estorno] ${item.description}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            total: item.total
          }))
        }
      },
      include: {
        customer: true,
        items: true,
        tenant: true
      }
    });

    // 7. Atualizar o estado da fatura original para ANULADA (dentro da mesma transacao)
    await tx.invoice.update({
      where: { id: originalInvoice.id },
      data: { status: 'ANULADA' }
    });

    // 8. A emissao de nota de credito NAO repoe stock automaticamente
    // (operacao fiscal/financeira, nao confirmacao de devolucao fisica).
    // A reposicao ocorre apenas na devolucao fisica aceite no armazem.

    return {
      creditNote,
      tenantId,
      shortHash,
      customerName: originalInvoice.customer.name,
      customerNif: originalInvoice.customer.nif,
    };
  });

  // Efeitos secundarios somente apos o commit: nenhuma operacao adicional
  // necessita de executar fora da transacao.

  return {
    ...result.creditNote,
    customerName: result.customerName,
    customerNif: result.customerNif,
    shortHash: result.shortHash,
  };
};
