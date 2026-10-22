import { prisma } from './prisma';
import { XMLBuilder } from 'fast-xml-parser';
import { getSAFTDocumentType } from './saft-period';

// Estrutura básica do SAFT-AO (simplificada para protótipo)
export const generateSAFTAO = async (tenantId: string, month: number, year: number): Promise<string> => {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new Error('Tenant não encontrado');

  // Buscar faturas do mês
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      issuedAt: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1)
      }
    },
    include: {
      customer: true,
      items: true
    }
  });

  // Construir XML
  const builder = new XMLBuilder({
    format: true,
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    suppressEmptyNode: true
  });

  const saftData = {
    'AuditFile': {
      '@xmlns': 'urn:OEBS:SAF-T:PT:1.04:01',
      'Header': {
        'AuditFileVersion': '1.04_01',
        'CompanyID': tenant.nif || '5000000000',
        'TaxRegistrationNumber': tenant.nif || '5000000000',
        'TaxAccountingBasis': 'F',
        'CompanyName': tenant.name,
        'BusinessName': tenant.name,
        'CompanyAddress': {
          'AddressDetail': tenant.address || 'Luanda, Angola'
        },
        'FiscalYear': year,
        'StartDate': `${year}-${month.toString().padStart(2, '0')}-01`,
        'EndDate': `${year}-${month.toString().padStart(2, '0')}-${new Date(year, month, 0).getDate()}`,
        'CurrencyCode': 'AOA',
        'DateCreated': new Date().toISOString(),
        'TaxEntity': 'Global',
        'ProductCompanyTaxID': '5000000000',
        'SoftwareCertificateNumber': '000/AGT/2026',
        'ProductID': 'FacturacaoAngola',
        'ProductVersion': '1.0'
      },
      'SourceDocuments': {
        'SalesInvoices': {
          'Invoice': invoices.map((invoice: any) => ({
            '@InvoiceNo': invoice.number,
            '@InvoiceDate': invoice.issuedAt.toISOString().split('T')[0],
            'InvoiceType': getSAFTDocumentType(invoice.type),
            'CustomerID': invoice.customer.nif || '999999999',
            'Line': invoice.items.map((item: any) => ({
              'ProductCode': item.productId || 'SEM-COD',
              'ProductDescription': item.description,
              'Quantity': item.quantity.toString(),
              'UnitPrice': item.unitPrice.toString(),
              'TaxPointDate': invoice.issuedAt.toISOString().split('T')[0],
              'Tax': {
                'TaxType': 'IVA',
                'TaxCountryRegion': 'AO',
                'TaxPercentage': item.taxRate.toString()
              }
            }))
          }))
        }
      }
    }
  };

  return builder.build(saftData);
};
