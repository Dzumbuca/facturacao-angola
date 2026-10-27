import PDFDocument from 'pdfkit';

type PdfItem = { description: string; quantity: unknown; unitPrice: unknown; taxRate: unknown; total?: unknown };
type PdfInput = {
  type: string; status: string; number: string; title: string; issueDate: Date | string; validUntil?: Date | string | null;
  currency: string; companySnapshot: unknown; customerSnapshot?: unknown; items?: PdfItem[];
  subTotal: unknown; taxTotal: unknown; total: unknown; details?: string | null; notes?: string | null;
};

const BRAND = '#021F87';
const INK = '#172033';
const MUTED = '#66758A';
const LINE = '#DCE2EA';
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;
const PAGE_BOTTOM = 770;

const titleFor = (type: string) => ({
  PROPOSAL: 'Proposta comercial', QUOTE: 'Or�amento', PROFORMA: 'Factura proforma',
  PURCHASE_ORDER: 'Nota de encomenda', DELIVERY_NOTE: 'Guia de remessa', SERVICE_ORDER: 'Ordem de servi�o',
  SERVICE_CONTRACT: 'Contrato de presta��o de servi�os', COMPANY_DECLARATION: 'Declara��o empresarial',
}[type] ?? 'Documento empresarial');

const statusFor = (status: string) => ({
  DRAFT: 'RASCUNHO', ISSUED: 'EMITIDO', ACCEPTED: 'ACEITE', REJECTED: 'REJEITADO', CANCELLED: 'CANCELADO', CONVERTED: 'CONVERTIDO',
}[status] ?? status);

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function string(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function amount(value: unknown) { const parsed = Number(value ?? 0); return Number.isFinite(parsed) ? parsed : 0; }
function date(value: unknown) {
  const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Luanda' }).format(parsed) : '-';
}
function money(value: unknown, currency: string) {
  try { return new Intl.NumberFormat('pt-AO', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount(value)).replace(/\u00a0/g, ' '); }
  catch { return `${amount(value).toLocaleString('pt-AO', { maximumFractionDigits: 2 })} ${currency}`; }
}

export async function generateBusinessDocumentRecordPDF(input: PdfInput, logo?: { mimeType: string; content: Uint8Array } | null): Promise<Buffer> {
  const company = object(input.companySnapshot);
  const customer = object(input.customerSnapshot);
  const companyName = string(company.legalName) || string(company.name) || 'Empresa';
  const currency = /^[A-Z]{3}$/.test(input.currency) ? input.currency : 'AOA';
  const items = Array.isArray(input.items) ? input.items : [];

  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margins: { top: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 58 }, bufferPages: true, info: {
      Title: `${titleFor(input.type)} ${input.number}`,
      Author: companyName,
      Creator: 'Machine Facturas',
    } });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    pdf.rect(0, 0, pdf.page.width, 92).fill(BRAND);
    if (logo && ['image/png', 'image/jpeg', 'image/jpg'].includes(logo.mimeType.toLowerCase())) {
      try { pdf.image(Buffer.from(logo.content), PAGE_MARGIN, 22, { fit: [84, 48] }); } catch { /* Logo inv�lido: o documento continua a ser emitido sem imagem. */ }
    }
    pdf.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(companyName, PAGE_MARGIN + (logo ? 98 : 0), 23, { width: 255, height: 16, ellipsis: true });
    if (string(company.nif)) pdf.font('Helvetica').fontSize(8).text(`NIF ${string(company.nif)}`, PAGE_MARGIN + (logo ? 98 : 0), 42, { width: 255 });
    pdf.font('Helvetica-Bold').fontSize(9).text(input.number, PAGE_MARGIN, 31, { width: CONTENT_WIDTH, align: 'right' });
    pdf.font('Helvetica').fontSize(8).fillColor('#DCE6FF').text(statusFor(input.status), PAGE_MARGIN, 48, { width: CONTENT_WIDTH, align: 'right' });

    pdf.fillColor(BRAND).font('Helvetica-Bold').fontSize(19).text(titleFor(input.type), PAGE_MARGIN, 112, { width: CONTENT_WIDTH });
    pdf.fillColor(MUTED).font('Helvetica').fontSize(9).text(`Emitido em ${date(input.issueDate)}${input.validUntil ? `  �  V�lido at� ${date(input.validUntil)}` : ''}`, PAGE_MARGIN, pdf.y + 7, { width: CONTENT_WIDTH });
    pdf.moveDown(1.1);

    const companyDetails = [string(company.address), [string(company.municipality), string(company.province)].filter(Boolean).join(' � '), string(company.phone), string(company.email)].filter(Boolean);
    const customerDetails = [string(customer.nif) ? `NIF ${string(customer.nif)}` : '', string(customer.address), string(customer.email)].filter(Boolean);
    const panelY = pdf.y + 4;
    const panelGap = 14;
    const panelWidth = (CONTENT_WIDTH - panelGap) / 2;
    const panelHeight = Math.max(74, Math.min(112, 48 + Math.max(companyDetails.length, customerDetails.length) * 13));
    pdf.roundedRect(PAGE_MARGIN, panelY, panelWidth, panelHeight, 8).fill('#F5F7FA');
    pdf.roundedRect(PAGE_MARGIN + panelWidth + panelGap, panelY, panelWidth, panelHeight, 8).fill('#F5F7FA');
    pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('EMITIDO POR', PAGE_MARGIN + 12, panelY + 11);
    pdf.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(companyName, PAGE_MARGIN + 12, panelY + 25, { width: panelWidth - 24, height: 15, ellipsis: true });
    pdf.fillColor(MUTED).font('Helvetica').fontSize(8).text(companyDetails.join('\n') || 'Dados da empresa', PAGE_MARGIN + 12, panelY + 43, { width: panelWidth - 24, height: panelHeight - 48, lineGap: 2 });
    pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5).text('CLIENTE / DESTINAT�RIO', PAGE_MARGIN + panelWidth + panelGap + 12, panelY + 11);
    pdf.fillColor(INK).font('Helvetica-Bold').fontSize(10).text(string(customer.name) || 'N�o indicado', PAGE_MARGIN + panelWidth + panelGap + 12, panelY + 25, { width: panelWidth - 24, height: 15, ellipsis: true });
    pdf.fillColor(MUTED).font('Helvetica').fontSize(8).text(customerDetails.join('\n') || 'Sem cliente associado', PAGE_MARGIN + panelWidth + panelGap + 12, panelY + 43, { width: panelWidth - 24, height: panelHeight - 48, lineGap: 2 });
    pdf.y = panelY + panelHeight + 22;

    if (input.details) {
      pdf.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('Descri��o e condi��es', PAGE_MARGIN, pdf.y, { width: CONTENT_WIDTH });
      pdf.moveDown(.35);
      pdf.font('Helvetica').fontSize(9).fillColor(MUTED).text(input.details, PAGE_MARGIN, pdf.y, { width: CONTENT_WIDTH, lineGap: 3 });
      pdf.moveDown(.9);
    }

    const drawTableHeader = () => {
      const y = pdf.y;
      pdf.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 25).fill('#F0F3F8');
      pdf.fillColor(MUTED).font('Helvetica-Bold').fontSize(7.5);
      pdf.text('DESCRI��O', PAGE_MARGIN + 9, y + 8, { width: 195 });
      pdf.text('QTD.', PAGE_MARGIN + 213, y + 8, { width: 42, align: 'right' });
      pdf.text('PRE�O UNIT.', PAGE_MARGIN + 264, y + 8, { width: 76, align: 'right' });
      pdf.text('TAXA*', PAGE_MARGIN + 348, y + 8, { width: 52, align: 'right' });
      pdf.text('TOTAL', PAGE_MARGIN + 409, y + 8, { width: 93, align: 'right' });
      pdf.y = y + 31;
    };

    if (items.length) {
      drawTableHeader();
      for (const item of items) {
        const description = string(item.description);
        const descHeight = pdf.heightOfString(description, { width: 190, font: 'Helvetica', fontSize: 8.5, lineGap: 2 });
        const rowHeight = Math.max(25, descHeight + 8);
        if (pdf.y + rowHeight > PAGE_BOTTOM) { pdf.addPage(); drawTableHeader(); }
        const y = pdf.y;
        pdf.strokeColor(LINE).lineWidth(.5).moveTo(PAGE_MARGIN, y + rowHeight).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + rowHeight).stroke();
        pdf.fillColor(INK).font('Helvetica').fontSize(8.5).text(description, PAGE_MARGIN + 9, y + 6, { width: 190, lineGap: 2 });
        pdf.text(amount(item.quantity).toLocaleString('pt-AO'), PAGE_MARGIN + 213, y + 7, { width: 42, align: 'right' });
        pdf.text(money(item.unitPrice, currency), PAGE_MARGIN + 264, y + 7, { width: 76, align: 'right' });
        pdf.fillColor(MUTED).fontSize(8).text(`${amount(item.taxRate).toLocaleString('pt-AO')}%`, PAGE_MARGIN + 348, y + 7, { width: 52, align: 'right' });
        pdf.fillColor(INK).font('Helvetica-Bold').fontSize(8.5).text(money(item.total ?? amount(item.quantity) * amount(item.unitPrice) * (1 + amount(item.taxRate) / 100), currency), PAGE_MARGIN + 409, y + 7, { width: 93, align: 'right' });
        pdf.y = y + rowHeight + 1;
      }
      pdf.moveDown(.8);
    }

    const totalsX = PAGE_MARGIN + CONTENT_WIDTH - 220;
    const totalLine = (label: string, value: unknown, strong = false) => {
      if (pdf.y > PAGE_BOTTOM - 80) pdf.addPage();
      pdf.fillColor(strong ? INK : MUTED).font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 11 : 9);
      pdf.text(label, totalsX, pdf.y, { width: 118 });
      pdf.text(money(value, currency), totalsX + 120, pdf.y, { width: 100, align: 'right' });
      pdf.y += strong ? 21 : 17;
    };
    if (items.length) {
      totalLine('Subtotal', input.subTotal);
      totalLine('Impostos indicativos*', input.taxTotal);
      pdf.strokeColor(LINE).moveTo(totalsX, pdf.y - 2).lineTo(totalsX + 220, pdf.y - 2).stroke();
      totalLine('Total', input.total, true);
    }
    if (input.notes) {
      if (pdf.y > PAGE_BOTTOM - 70) pdf.addPage();
      pdf.moveDown(.5);
      pdf.fillColor(INK).font('Helvetica-Bold').fontSize(9).text('Observa��es', PAGE_MARGIN, pdf.y, { width: CONTENT_WIDTH });
      pdf.moveDown(.35);
      pdf.fillColor(MUTED).font('Helvetica').fontSize(8.5).text(input.notes, PAGE_MARGIN, pdf.y, { width: CONTENT_WIDTH, lineGap: 2 });
    }

    const pages = pdf.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      pdf.switchToPage(index);
      const footerY = pdf.page.height - 43;
      pdf.strokeColor(LINE).lineWidth(.5).moveTo(PAGE_MARGIN, footerY - 8).lineTo(pdf.page.width - PAGE_MARGIN, footerY - 8).stroke();
      pdf.fillColor(MUTED).font('Helvetica').fontSize(7.5).text('Documento empresarial interno. N�o constitui factura fiscal nem substitui documento fiscal.', PAGE_MARGIN, footerY, { width: CONTENT_WIDTH - 40 });
      pdf.text(`P�gina ${index - pages.start + 1} de ${pages.count}`, PAGE_MARGIN, footerY, { width: CONTENT_WIDTH, align: 'right' });
      if (items.length) pdf.text('* Taxas e impostos apresentados apenas para refer�ncia comercial.', PAGE_MARGIN, footerY + 12, { width: CONTENT_WIDTH - 40 });
    }
    pdf.end();
  });
}
