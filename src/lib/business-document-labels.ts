import type { BusinessDocumentStatus, BusinessDocumentType } from './business-document-core';

export const BUSINESS_DOCUMENT_LABELS: Record<BusinessDocumentType, string> = {
  PROPOSAL: 'Proposta comercial',
  QUOTE: 'Orçamento',
  PROFORMA: 'Factura proforma',
  PURCHASE_ORDER: 'Nota de encomenda',
  DELIVERY_NOTE: 'Guia de remessa',
  SERVICE_ORDER: 'Ordem de serviço',
  SERVICE_CONTRACT: 'Contrato de prestação de serviços',
  COMPANY_DECLARATION: 'Declaração empresarial',
};

export const BUSINESS_DOCUMENT_STATUS_LABELS: Record<BusinessDocumentStatus, string> = {
  DRAFT: 'Rascunho', ISSUED: 'Emitido', ACCEPTED: 'Aceite', REJECTED: 'Rejeitado', CANCELLED: 'Cancelado', CONVERTED: 'Convertido em factura',
};

export const BUSINESS_DOCUMENT_CATEGORIES = [
  {
    title: 'Comerciais',
    description: 'Propostas, orçamentos, proformas e notas de encomenda.',
    types: ['PROPOSAL', 'QUOTE', 'PROFORMA', 'PURCHASE_ORDER'] as BusinessDocumentType[],
  },
  {
    title: 'Financeiros',
    description: 'Recibos ligados a pagamentos confirmados e documentos de apoio financeiro.',
    types: [] as BusinessDocumentType[],
  },
  {
    title: 'Operacionais',
    description: 'Guias de remessa e ordens de serviço.',
    types: ['DELIVERY_NOTE', 'SERVICE_ORDER'] as BusinessDocumentType[],
  },
  {
    title: 'Administrativos',
    description: 'Contratos, declarações e relatórios empresariais.',
    types: ['SERVICE_CONTRACT', 'COMPANY_DECLARATION'] as BusinessDocumentType[],
  },
];

export function getBusinessDocumentStatusTone(status: BusinessDocumentStatus) {
  if (status === 'ACCEPTED' || status === 'ISSUED') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'REJECTED' || status === 'CANCELLED') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'CONVERTED') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-slate-200 bg-slate-100 text-slate-700';
}
