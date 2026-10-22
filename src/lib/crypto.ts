import crypto from 'crypto';

export const getInvoiceSigningKey = (environment?: { PRIVATE_KEY?: string }) => {
  const value = (environment?.PRIVATE_KEY ?? process.env.PRIVATE_KEY)?.replace(/\\n/g, '\n').trim();
  if (!value) {
    throw new Error('PRIVATE_KEY não está configurada. Configure uma chave RSA privada estável no ambiente.');
  }
  return crypto.createPrivateKey(value);
};

export const generateInvoiceHash = (data: any, previousHash: string | null, dateOverride?: Date): string => {
  const payload = JSON.stringify({
    customerName: data.customerName,
    customerNif: data.customerNif,
    items: data.items,
    applyVat: data.applyVat !== false,
    discountAmount: Number(data.discountAmount || 0),
    discountType: data.discountType || 'amount',
    discountValue: Number(data.discountValue || 0),
    observations: data.observations || null,
    includeCompanyProfile: data.includeCompanyProfile === true,
    companyProfileSnapshot: data.companyProfileSnapshot ?? null,
    companyLogoId: data.companyLogoId ?? null,
    subTotal: Number(data.subTotal || 0),
    taxTotal: Number(data.taxTotal || 0),
    total: data.total,
    date: (dateOverride || new Date()).toISOString(),
    previousHash: previousHash || 'ROOT'
  });

  return crypto.createHash('sha256').update(payload).digest('hex');
};
