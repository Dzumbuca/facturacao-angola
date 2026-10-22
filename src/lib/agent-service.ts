import { validateInvoiceRequest } from './invoice-validation';

// Validador determinístico das regras locais da aplicação.
export const invoiceAgent = {
  name: 'AGT-Compliance-Assistant',
  description: 'Especialista em validar faturas conforme requisitos da AGT Angola.',
};

export const validateInvoiceWithAgent = async (invoiceData: any) => {
  const result = validateInvoiceRequest(invoiceData);
  return {
    ...result,
    fiscalMessage: result.isValid
      ? 'Fatura conforme às verificações locais.'
      : 'Fatura inválida; corrija os avisos antes de emitir.',
  };
};

