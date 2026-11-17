import { getInvoiceSigningKey } from './crypto';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { runWithTenant } from './tenant-db';
import { lockIntegrityChain, reserveInvoiceNumber, loadOrInitChainState, checkIdempotency, persistIdempotency } from './invoice-integrity';
import { generateInvoiceHashV2, sha256Hex } from './invoice-integrity-core';
import { calculateInvoiceTotals } from './tax';
import { resolveInvoiceLimit, countInvoicesThisMonth, InvoiceQuotaExceededError } from './invoice-quota';
import { decrementStockForInvoice } from './stock-service';
import { isApplicationEnabled } from './platform-apps';

export const issueInvoice = async (
  invoiceData: any,
  tenantId: string,
  beforePersist?: (invoiceDraft: any) => Promise<void>,
  idempotencyKey?: string,
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

    // 3-4. Cadeia documental e numeração atómica
    //    Toda a emissão FT acontece sob advisory lock pelo tenant e usa
    //    InvoiceSeries + InvoiceChainState para garantir que dois pedidos
    //    concorrentes nunca produzem o mesmo número ou bifurcar a cadeia.
    const issuedAt = new Date();
    const year = issuedAt.getFullYear();
    const seriesCode = 'A';
    const documentType = 'FT' as const;

    // Compute a deterministic payload hash for idempotency
    const canonicalPayload = JSON.stringify({
      customerId: (customer && (customer.id ?? null)) ?? null,
      customerName: invoiceData.customerName ?? null,
      customerNif: invoiceData.customerNif ?? null,
      items: (invoiceData.items || []).map((item: any) => ({
        productId: item.productId ?? null,
        desc: item.desc ?? null,
        qty: item.qty ?? 1,
        rate: item.rate ?? 0,
      })),
      applyVat: invoiceData.applyVat !== false,
      discountType: invoiceData.discountType ?? 'amount',
      discountValue: invoiceData.discountValue ?? 0,
      observations: invoiceData.observations ?? null,
      includeCompanyProfile: invoiceData.includeCompanyProfile === true,
      currency: invoiceData.currency ?? 'AOA',
      dueAt: invoiceData.dueAt ? new Date(invoiceData.dueAt).toISOString() : null,
    });
    const payloadHash = sha256Hex(canonicalPayload);

    await lockIntegrityChain(transaction, tenant.id);

    // Idempotência: mesma chave + mesmo payload → devolve resultado; mesma chave + payload diferente → 409.
    if (idempotencyKey) {
      const decision = await checkIdempotency(transaction, tenant.id, idempotencyKey, 'INVOICE', payloadHash);
      if (decision.kind === 'replay') {
        const existing = await transaction.invoice.findUnique({ where: { id: decision.resultId! }, include: { items: true, customer: true, tenant: true } });
        if (existing) return existing as any;
      } else if (decision.kind === 'conflict') {
        const err: any = new Error('IdempotencyConflict');
        err.code = 'IDEMPOTENCY_CONFLICT';
        err.status = 409;
        throw err;
      }
    }
    const reserved = await reserveInvoiceNumber(transaction, tenant.id, seriesCode, documentType, year);
    const invoiceNumber = `FT ${year}/${String(reserved).padStart(4, '0')}`;
    const chainState = await loadOrInitChainState(transaction, tenant.id);
    const previousHash = chainState.lastHash;
    const chainSequence = chainState.lastSequence + 1;

    // 5. Calcular totais
    const applyVat = invoiceData.applyVat !== false;
    const discountType = invoiceData.discountType === 'percent' ? 'percent' : 'amount';
    const discountValue = Number(invoiceData.discountValue) || 0;
    const { subTotal, discountAmount, taxTotal, total } = calculateInvoiceTotals(invoiceData.items || [], { type: discountType, value: discountValue, applyVat });
    const observations = typeof invoiceData.observations === 'string' ? invoiceData.observations.trim() || null : null;

    // 6. Gerar o Hash Fiscal — V2 (payload canonicalizado com cadeia)
    const hash = generateInvoiceHashV2({
      seriesCode,
      documentType,
      year,
      number: invoiceNumber,
      tenantId: tenant.id,
      customerId: customer.id,
      customerName: customer.name,
      customerNif: customer.nif,
      currency: invoiceData.currency ?? 'AOA',
      items: (invoiceData.items || []).map((item: any, idx: number) => ({
        position: idx,
        description: item.desc || 'Item sem descrição',
        productCode: item.productId ?? null,
        quantity: item.qty ?? 1,
        unitPrice: item.rate ?? 0,
        taxRate: item.taxRate ?? (applyVat ? 14.00 : 0),
        total: (item.qty ?? 1) * (item.rate ?? 0),
      })),
      applyVat,
      discountAmount,
      discountType,
      discountValue,
      observations,
      includeCompanyProfile,
      companyProfileSnapshot,
      companyLogoId: companyLogo?.id ?? null,
      subTotal,
      taxTotal,
      total,
      issuedAt: issuedAt.toISOString(),
    }, previousHash, chainSequence);

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
        status: 'DRAFT',
        seriesCode,
        documentType,
        year,
        chainSequence,
        hashVersion: 2,
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
          create: (invoiceData.items || []).map((item: any, idx: number) => ({
            productId: item.productId || null,
            description: item.desc || 'Item sem descrição',
            quantity: item.qty || 1,
            unitPrice: item.rate || 0,
            taxRate: applyVat ? 14.00 : 0,
            position: idx,
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
    // Limite mensal de facturas (subscrição activa ou modelo legado FREE/PRO).
    const invoiceLimit = await resolveInvoiceLimit(transaction, tenant.id);
    if (invoiceLimit !== null) {
      const usedThisMonth = await countInvoicesThisMonth(transaction, tenant.id);
      if (usedThisMonth >= invoiceLimit) throw new InvoiceQuotaExceededError(usedThisMonth, invoiceLimit);
    }
    const saved = await transaction.invoice.create(invoiceCreateData);
    // Selar documento: transição DRAFT→ISSUED dentro da mesma transação.
    // O trigger só permite transição documental com OLD.status ≠ ISSUED/ANULADA.
    await transaction.invoice.update({
      where: { id: saved.id },
      data: { status: 'ISSUED' },
    });

    // Avançar a cadeia criptográfica DEPOIS de criada a factura. Se falhar, a transação faz rollback completo.
    await transaction.$executeRaw`UPDATE "InvoiceChainState"
      SET "lastHash" = ${hash}, "lastSequence" = ${chainSequence}, "lastInvoiceId" = ${saved.id}
      WHERE "tenantId" = ${tenant.id}`;

    if (idempotencyKey) {
      await persistIdempotency(transaction, tenant.id, idempotencyKey, 'INVOICE', payloadHash, saved.id);
    }

    // Baixa automatica de estoque apenas para produtos com controlo de stock e
    // tenants com o modulo WMS activo. O catalogo gratuito factura sem stock.
    const invoiceItems = (invoiceData.items || []).filter(
      (item: any) => item.productId && item.qty > 0
    );
    if (invoiceItems.length > 0) {
      const wmsEnabled = await isApplicationEnabled(tenant.id, 'wms');
      const trackedProducts = wmsEnabled
        ? await transaction.product.findMany({
            where: { tenantId: tenant.id, id: { in: invoiceItems.map((item: any) => item.productId) }, trackStock: true },
            select: { id: true },
          })
        : [];
      const trackedIds = new Set(trackedProducts.map((product: any) => product.id));
      const trackedItems = invoiceItems.filter((item: any) => trackedIds.has(item.productId));

      if (trackedItems.length > 0) {
        const defaultWarehouse = await transaction.warehouse.findFirst({
          where: { tenantId: tenant.id, isDefault: true, isActive: true },
        });
        if (!defaultWarehouse) throw new Error('Nenhum armazem padrao configurado para o tenant');

        await decrementStockForInvoice(
          tenant.id,
          saved.id,
          defaultWarehouse.id,
          trackedItems.map((item: any) => ({
            productId: item.productId,
            quantity: item.qty,
          })),
          transaction
        );
      }
    }

    if (invoiceData.sourceDraftId) {
      const updatedDraft = await transaction.invoiceDraft.updateMany({
        where: { id: invoiceData.sourceDraftId, tenantId: tenant.id, status: 'ISSUING' },
        data: { status: 'ISSUED' },
      });
      if (updatedDraft.count !== 1) throw new Error('O rascunho foi alterado durante a emissão.');
    }
    return { saved, tenantId, shortHash, customerName: customer.name, customerNif: customer.nif, items: invoiceData.items };
  });

  // A3 — GL posting (auto-creção, não bloqueia o FT se falhar)
  try {
    const { postInvoiceToGL } = await import('./gl-service');
    const total = Number(result.saved.total);
    const taxTotal = Number((result.saved as any).taxTotal?.toString() ?? 0);
    await postInvoiceToGL(result.tenantId, result.saved.id, total, taxTotal);
  } catch (e) {
    console.error('GL_POST_FAILED for FT', result.saved.id, e);
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
  idempotencyKey?: string;
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

    // 2-3. Cadeia documental e numeracao atomica de Nota de Crédito
    const issuedAt = new Date();
    const year = issuedAt.getFullYear();
    const seriesCode = 'A';
    const documentType = 'NC' as const;

    // idempotency (NC path)
    const payloadHash = sha256Hex(JSON.stringify({
      refInvoiceNumber: originalInvoice.number,
      reason: params.reason,
      tenantId,
    }));
    await lockIntegrityChain(tx, tenantId);
    if (params.idempotencyKey) {
      const decision = await checkIdempotency(tx, tenantId, params.idempotencyKey, 'CREDIT_NOTE', payloadHash);
      if (decision.kind === 'replay') {
        const existing = await tx.invoice.findFirst({ where: { id: decision.resultId!, tenantId }, include: { items: true, customer: true, tenant: true } });
        if (existing) return { existing, shortHash: '', customerName: originalInvoice.customer.name, customerNif: originalInvoice.customer.nif };
      } else if (decision.kind === 'conflict') {
        const err: any = new Error('IdempotencyConflict');
        err.code = 'IDEMPOTENCY_CONFLICT';
        err.status = 409;
        throw err;
      }
    }
    const reserved = await reserveInvoiceNumber(tx, tenantId, seriesCode, documentType, year);
    const ncNumber = `NC ${year}/${String(reserved).padStart(4, '0')}`;
    const chainState = await loadOrInitChainState(tx, tenantId);
    const previousHash = chainState.lastHash;
    const chainSequence = chainState.lastSequence + 1;

    // 4. Gerar o Hash Fiscal — V2 (assinatura canónica derivada da cadeia)
    const hash = generateInvoiceHashV2({
      seriesCode,
      documentType,
      year,
      number: ncNumber,
      tenantId,
      customerId: originalInvoice.customerId,
      customerName: originalInvoice.customer.name,
      customerNif: originalInvoice.customer.nif,
      currency: originalInvoice.currency ?? 'AOA',
      items: originalInvoice.items.map((item: any, idx: number) => ({
        position: idx,
        description: item.description,
        productCode: item.productId ?? null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
        total: item.total,
      })),
      refInvoiceNumber: originalInvoice.number,
      subTotal: originalInvoice.subTotal,
      taxTotal: originalInvoice.taxTotal,
      total: originalInvoice.total,
      cancelReason: params.reason,
      includeCompanyProfile: originalInvoice.includeCompanyProfile,
      companyProfileSnapshot: originalInvoice.companyProfileSnapshot ?? null,
      companyLogoId: originalInvoice.companyLogoId ?? null,
      discountAmount: originalInvoice.discountAmount,
      discountType: originalInvoice.discountType,
      discountValue: originalInvoice.discountValue,
      applyVat: originalInvoice.applyVat,
      issuedAt: issuedAt.toISOString(),
    }, previousHash, chainSequence);
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
        status: 'DRAFT',
        seriesCode,
        documentType,
        year,
        chainSequence,
        hashVersion: 2,
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
          create: originalInvoice.items.map((item: any, idx: number) => ({
            description: `[Estorno] ${item.description}`,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            position: idx,
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

    // Selar NC: transição DRAFT→ISSUED (itens e âmbito expiraram juntos).
    // O trigger permite transição apenas com OLD.status='DRAFT'.
    await tx.invoice.update({
      where: { id: creditNote.id },
      data: { status: 'ISSUED' },
    });

    // Avançar a cadeia criptográfica DEPOIS de criada a nota de crédito. Se falhar, rollback integral.
    await tx.$executeRaw`UPDATE "InvoiceChainState"
      SET "lastHash" = ${hash}, "lastSequence" = ${chainSequence}, "lastInvoiceId" = ${creditNote.id}
      WHERE "tenantId" = ${tenantId}`;

    if (params.idempotencyKey) {
      await persistIdempotency(tx, tenantId, params.idempotencyKey, 'CREDIT_NOTE', payloadHash, creditNote.id);
    }

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
