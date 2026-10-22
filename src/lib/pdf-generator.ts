import PDFDocument from 'pdfkit';
import path from 'node:path';
import { getInvoicePaymentTotals } from './payment-rules';

const COLORS = {
  blue: '#021F87',
  ink: '#171C27',
  muted: '#647184',
  line: '#DCE2EA',
  pale: '#F3F6FA',
  paleBlue: '#EEF2FF',
  white: '#FFFFFF',
};

const PAGE_MARGIN = 44;
const FOOTER_SPACE = 104;
const LINE_HEIGHT = 13;
const PAGE_OPTIONS = {
  size: 'A4' as const,
  margins: { top: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: FOOTER_SPACE },
};

const createDocumentForType = () => new PDFDocument({ size: 'A4' });
type PdfDocumentInstance = ReturnType<typeof createDocumentForType>;

type PdfItem = {
  desc?: unknown;
  description?: unknown;
  qty?: unknown;
  quantity?: unknown;
  rate?: unknown;
  unitPrice?: unknown;
  total?: unknown;
  taxRate?: unknown;
  productId?: unknown;
};

type TaxLine = { rate: number; amount: number };

const amount = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const textValue = (value: unknown) => typeof value === 'string' ? value.trim() : '';

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value).replace(/\u00a0/g, ' ');
}

function formatRate(value: number) {
  return new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(value).replace(/\u00a0/g, ' ');
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(value).replace(/\u00a0/g, ' ');
  } catch {
    return `${formatNumber(value)} ${currency}`;
  }
}

function formatDate(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value ?? ''));
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-AO', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Luanda',
  }).format(date);
}

function wrapText(doc: PdfDocumentInstance, value: string, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if (!paragraph) {
      lines.push('');
      continue;
    }
    const words = paragraph.match(/\S+\s*/g) ?? [paragraph];
    let line = '';
    for (const word of words) {
      const candidate = line + word;
      if (!line || doc.widthOfString(candidate) <= width) {
        if (doc.widthOfString(candidate) <= width) {
          line = candidate;
          continue;
        }
      }

      if (line.trim()) lines.push(line.trimEnd());
      line = '';
      let part = '';
      for (const character of Array.from(word.trimStart())) {
        if (part && doc.widthOfString(part + character) > width) {
          lines.push(part);
          part = character;
        } else {
          part += character;
        }
      }
      line = part;
      if (/\s$/.test(word)) line += ' ';
    }
    if (line || !lines.length) lines.push(line.trimEnd());
  }
  return lines.length ? lines : [''];
}

function getTaxLines(items: Array<{ qty: number; rate: number; taxRate: number }>, subtotal: number, discount: number, taxTotal: number): TaxLine[] {
  if (!items.length) return taxTotal ? [{ rate: 0, amount: taxTotal }] : [];
  const taxableRatio = subtotal > 0 ? Math.max(0, subtotal - discount) / subtotal : 0;
  const amountsByRate = new Map<number, number>();
  for (const item of items) {
    const raw = item.qty * item.rate * taxableRatio * (item.taxRate / 100);
    amountsByRate.set(item.taxRate, (amountsByRate.get(item.taxRate) ?? 0) + raw);
  }
  const rates = [...amountsByRate.keys()].sort((a, b) => a - b);
  if (!rates.length) return [];

  // Allocate rounding residue to the last rate so the displayed breakdown
  // still adds up to the exact taxTotal persisted by the application.
  let allocated = 0;
  return rates.map((rate, index) => {
    const rounded = index === rates.length - 1
      ? Math.round((taxTotal - allocated + Number.EPSILON) * 100) / 100
      : Math.round(((amountsByRate.get(rate) ?? 0) + Number.EPSILON) * 100) / 100;
    allocated = Math.round((allocated + rounded + Number.EPSILON) * 100) / 100;
    return { rate, amount: rounded };
  });
}

function labelForMethod(method: string) {
  const labels: Record<string, string> = {
    BANK_TRANSFER: 'Transferência bancária',
    MULTICAIXA_EXPRESS: 'Multicaixa Express',
    MULTICAIXA_REFERENCE: 'Referência Multicaixa',
    CASH: 'Numerário',
    OTHER: 'Outro método',
  };
  return labels[method] ?? method;
}

function labelForPaymentStatus(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendente', CONFIRMED: 'Confirmado', CANCELLED: 'Cancelado', REVERSED: 'Estornado',
  };
  return labels[status] ?? status;
}

export const generateInvoicePDF = async (invoiceData: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ ...PAGE_OPTIONS, bufferPages: true });
    doc.registerFont('BlackMachine', path.join(process.cwd(), 'public', 'fonts', 'Geist-Regular.ttf'));
    doc.registerFont('BlackMachine-Bold', path.join(process.cwd(), 'public', 'fonts', 'Geist-Regular.ttf'));
    doc.registerFont('BlackMachine-Italic', path.join(process.cwd(), 'public', 'fonts', 'Geist-Regular.ttf'));
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = () => doc.page.width - PAGE_MARGIN * 2;
    const contentBottom = () => doc.page.height - FOOTER_SPACE;
    const documentType = textValue(invoiceData.type);
    const isCreditNote = documentType === 'NC';
    const documentTitle = isCreditNote ? 'Nota de crédito' : documentType === 'FT' || !documentType ? 'Factura' : documentType;
    const number = textValue(invoiceData.number);
    const currency = /^[A-Z]{3}$/.test(textValue(invoiceData.currency)) ? textValue(invoiceData.currency) : 'AOA';
    const profile = invoiceData.includeCompanyProfile === true
      && invoiceData.companyProfileSnapshot
      && typeof invoiceData.companyProfileSnapshot === 'object'
      && !Array.isArray(invoiceData.companyProfileSnapshot)
      ? invoiceData.companyProfileSnapshot as Record<string, unknown>
      : null;
    const customer = invoiceData.customer && typeof invoiceData.customer === 'object' ? invoiceData.customer : {};
    const customerName = textValue(invoiceData.customerName) || textValue(customer.name);
    const customerNif = textValue(invoiceData.customerNif) || textValue(customer.nif);
    const customerAddress = textValue(invoiceData.customerAddress) || textValue(customer.address);
    const customerEmail = textValue(invoiceData.customerEmail) || textValue(customer.email);
    const items = (Array.isArray(invoiceData.items) ? invoiceData.items : []).map((item: PdfItem) => ({
      description: textValue(item.desc) || textValue(item.description),
      qty: amount(item.qty ?? item.quantity),
      rate: amount(item.rate ?? item.unitPrice),
      lineTotal: amount(item.total ?? (amount(item.qty ?? item.quantity) * amount(item.rate ?? item.unitPrice))),
      taxRate: amount(item.taxRate ?? (invoiceData.applyVat === false ? 0 : 14)),
    }));
    const subtotal = amount(invoiceData.subTotal);
    const discount = amount(invoiceData.discountAmount);
    const taxTotal = amount(invoiceData.taxTotal);
    const total = amount(invoiceData.total);
    const taxLines = invoiceData.applyVat === false
      ? []
      : getTaxLines(items, subtotal, discount, taxTotal);
    const payments = Array.isArray(invoiceData.payments) ? invoiceData.payments.filter((payment: any) => payment && typeof payment === 'object') : [];
    const bankDetails = profile ? [
      ['Banco', textValue(profile.bankName)],
      ['Titular', textValue(profile.bankAccountName)],
      ['IBAN', textValue(profile.iban)],
    ].filter((entry) => entry[1]) as Array<[string, string]> : [];

    const drawRule = (y: number, color = COLORS.line) => {
      doc.save().strokeColor(color).lineWidth(0.6).moveTo(PAGE_MARGIN, y).lineTo(doc.page.width - PAGE_MARGIN, y).stroke().restore();
    };

    const drawContinuationHeading = (section?: string) => {
      const label = [documentTitle.toLocaleUpperCase('pt-AO'), number, 'continuação', section].filter(Boolean).join(' · ');
      doc.font('BlackMachine-Bold').fontSize(8).fillColor(COLORS.blue).text(label, PAGE_MARGIN, 30, { width: pageWidth() });
      drawRule(48, COLORS.blue);
      doc.y = 60;
    };

    const addContinuationPage = (section?: string, repeatTableHeader = false) => {
      doc.addPage(PAGE_OPTIONS);
      drawContinuationHeading(section);
      if (repeatTableHeader) drawTableHeader();
    };

    function drawTableHeader() {
      const x = PAGE_MARGIN;
      const y = doc.y;
      const widths = [250, 43, 82, 47, pageWidth() - 422];
      const xs = widths.map((_, index) => x + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
      doc.save().fillColor(COLORS.blue).rect(x, y, pageWidth(), 24).fill().restore();
      doc.font('BlackMachine-Bold').fontSize(7.2).fillColor(COLORS.white);
      const labels = ['DESCRIÇÃO', 'QTD.', 'PREÇO UNIT.', 'IVA', `VALOR (${currency === 'AOA' ? 'Kz' : currency})`];
      labels.forEach((label, index) => doc.text(label, xs[index] + (index === 0 ? 9 : 2), y + 8, {
        width: widths[index] - (index === 0 ? 16 : 8), align: index === 0 ? 'left' : 'right', lineBreak: false,
      }));
      doc.fillColor(COLORS.ink);
      doc.y = y + 24;
    }

    const drawInvoiceHeader = () => {
      const companyName = profile ? textValue(profile.legalName) || textValue(profile.name) : '';
      const tradingName = profile ? textValue(profile.name) : '';
      const logo = invoiceData.companyLogo?.content;
      let companyX = PAGE_MARGIN;
      let companyWidth = 278;
      let companyY = 47;

      if (logo) {
        try {
          doc.image(Buffer.from(logo), PAGE_MARGIN, 47, { fit: [62, 52], align: 'center', valign: 'center' });
          companyX = PAGE_MARGIN + 74;
          companyWidth -= 74;
        } catch {
          // A missing or invalid uploaded logo must never prevent document delivery.
        }
      }

      if (companyName) {
        doc.font('BlackMachine-Bold').fontSize(14).fillColor(COLORS.ink).text(companyName, companyX, companyY, { width: companyWidth });
        companyY = doc.y + 2;
        if (tradingName && tradingName !== companyName) {
          doc.font('BlackMachine').fontSize(8.5).fillColor(COLORS.muted).text(tradingName, companyX, companyY, { width: companyWidth });
          companyY = doc.y + 3;
        }
      }

      if (profile) {
        const companyLines = [
          textValue(profile.nif) ? `NIF: ${textValue(profile.nif)}` : '',
          [textValue(profile.address), textValue(profile.municipality), textValue(profile.province), textValue(profile.country)].filter(Boolean).join(' · '),
          [textValue(profile.phone), textValue(profile.email), textValue(profile.website)].filter(Boolean).join(' · '),
        ].filter(Boolean);
        for (const line of companyLines) {
          doc.font('BlackMachine').fontSize(8).fillColor(COLORS.muted).text(line, companyX, companyY, { width: companyWidth });
          companyY = doc.y + 1;
        }
      }

      const metaX = PAGE_MARGIN + 316;
      const metaWidth = pageWidth() - 316;
      doc.font('BlackMachine-Bold').fontSize(8).fillColor(COLORS.blue).text(documentTitle.toLocaleUpperCase('pt-AO'), metaX, 46, { width: metaWidth, align: 'right' });
      if (number) doc.font('BlackMachine-Bold').fontSize(17).fillColor(COLORS.ink).text(number, metaX, 61, { width: metaWidth, align: 'right' });
      let metaY = Math.max(84, doc.y + 2);
      const issuedAt = formatDate(invoiceData.issuedAt ?? invoiceData.createdAt);
      const dueAt = formatDate(invoiceData.dueAt);
      const metadata = [
        issuedAt ? ['Emissão', issuedAt] : null,
        dueAt ? ['Vencimento', dueAt] : null,
        isCreditNote && textValue(invoiceData.refInvoiceNumber) ? ['Factura de origem', textValue(invoiceData.refInvoiceNumber)] : null,
      ].filter(Boolean) as Array<[string, string]>;
      for (const [label, value] of metadata) {
        doc.font('BlackMachine').fontSize(8.3).fillColor(COLORS.muted).text(`${label}: ${value}`, metaX, metaY, { width: metaWidth, align: 'right' });
        metaY = doc.y + 2;
      }

      doc.y = Math.max(companyY, metaY, 114) + 12;
      drawRule(doc.y, COLORS.blue);
      doc.y += 14;
    };

    const drawCustomerBlock = () => {
      const innerX = PAGE_MARGIN + 13;
      const innerWidth = pageWidth() - 26;
      const fields = [
        customerNif ? `NIF: ${customerNif}` : '',
        customerAddress ? `Morada: ${customerAddress}` : '',
        customerEmail ? `E-mail: ${customerEmail}` : '',
      ].filter(Boolean);
      doc.font('BlackMachine-Bold').fontSize(10.5).fillColor(COLORS.ink);
      const nameLines = customerName ? wrapText(doc, customerName, innerWidth) : [];
      doc.font('BlackMachine').fontSize(8.5);
      const fieldLines = fields.flatMap((field) => wrapText(doc, field, innerWidth));
      const contentLines = nameLines.length + fieldLines.length;
      const blockHeight = 34 + contentLines * LINE_HEIGHT;
      if (doc.y + blockHeight > contentBottom()) {
        addContinuationPage('dados do adquirente');
      }
      const y = doc.y;
      doc.save().fillColor(COLORS.pale).roundedRect(PAGE_MARGIN, y, pageWidth(), blockHeight, 4).fill().restore();
      doc.font('BlackMachine-Bold').fontSize(7.2).fillColor(COLORS.blue).text('ADQUIRENTE', innerX, y + 10, { width: innerWidth });
      let textY = y + 22;
      doc.font('BlackMachine-Bold').fontSize(10.5).fillColor(COLORS.ink);
      for (const line of nameLines) {
        doc.text(line, innerX, textY, { width: innerWidth, lineBreak: false });
        textY += LINE_HEIGHT;
      }
      doc.font('BlackMachine').fontSize(8.5).fillColor(COLORS.muted);
      for (const line of fieldLines) {
        doc.text(line, innerX, textY, { width: innerWidth, lineBreak: false });
        textY += LINE_HEIGHT;
      }
      doc.y = y + blockHeight + 18;
    };

    const drawItemRows = () => {
      doc.font('BlackMachine').fontSize(8.4).fillColor(COLORS.ink);
      const widths = [250, 43, 82, 47, pageWidth() - 422];
      const xs = widths.map((_, index) => PAGE_MARGIN + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
      const lineHeight = LINE_HEIGHT;

      items.forEach((item: { description: string; qty: number; rate: number; lineTotal: number; taxRate: number }, itemIndex: number) => {
        const descriptionLines = wrapText(doc, item.description, widths[0] - 18);
        const fullRowHeight = descriptionLines.length * lineHeight + 16;
        const printablePageHeight = contentBottom() - (PAGE_MARGIN + 40);
        if (doc.y + fullRowHeight > contentBottom() && fullRowHeight <= printablePageHeight) {
          addContinuationPage('artigos', true);
        }
        let offset = 0;
        let firstChunk = true;

        while (offset < descriptionLines.length) {
          if (doc.y + lineHeight + 16 > contentBottom()) addContinuationPage('artigos', true);
          const availableLines = Math.max(1, Math.floor((contentBottom() - doc.y - 16) / lineHeight));
          const lineCount = Math.min(availableLines, descriptionLines.length - offset);
          const chunkHeight = lineCount * lineHeight + 16;
          const y = doc.y;
          if (itemIndex % 2 === 1) {
            doc.save().fillColor('#FAFBFD').rect(PAGE_MARGIN, y, pageWidth(), chunkHeight).fill().restore();
          }

          if (firstChunk) {
            const quantity = new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(item.qty);
            const unitPrice = formatNumber(item.rate);
            const lineAmount = formatNumber(item.lineTotal);
            const numericValues = [quantity, unitPrice, `${formatRate(item.taxRate)}%`, lineAmount];
            numericValues.forEach((value, index) => {
              const column = index + 1;
              doc.font('BlackMachine').fontSize(8.2).fillColor(COLORS.ink).text(value, xs[column] + 2, y + 6, {
                width: widths[column] - 8, align: 'right', lineBreak: false,
              });
            });
          } else {
            doc.font('BlackMachine-Italic').fontSize(7).fillColor(COLORS.muted).text('(continuação)', xs[0] + 9, y + 6, { width: widths[0] - 18, lineBreak: false });
          }

          doc.font('BlackMachine').fontSize(8.4).fillColor(COLORS.ink);
          descriptionLines.slice(offset, offset + lineCount).forEach((line, index) => {
            doc.text(line, xs[0] + 9, y + 6 + index * lineHeight, { width: widths[0] - 18, lineBreak: false });
          });
          doc.y = y + chunkHeight;
          drawRule(doc.y);
          doc.y += 1;
          offset += lineCount;
          firstChunk = false;
          if (offset < descriptionLines.length) addContinuationPage('artigos', true);
        }
      });
    };

    const drawSectionHeading = (title: string) => {
      const headingY = doc.y;
      doc.font('BlackMachine-Bold').fontSize(8).fillColor(COLORS.blue).text(title.toLocaleUpperCase('pt-AO'), PAGE_MARGIN, headingY, { width: pageWidth() });
      doc.y = headingY + 16;
    };

    const drawTotals = () => {
      const rows: Array<[string, number, boolean?]> = [['Subtotal', subtotal]];
      if (discount > 0) rows.push(['Desconto global', -discount]);
      if (invoiceData.applyVat === false) {
        rows.push(['IVA não aplicado', 0]);
      } else if (taxLines.length) {
        for (const taxLine of taxLines) rows.push([`IVA (${formatRate(taxLine.rate)}%)`, taxLine.amount]);
      } else if (taxTotal > 0) {
        rows.push(['IVA', taxTotal]);
      }
      const summaryHeight = 18 + rows.length * 17 + 34;
      if (doc.y + summaryHeight > contentBottom()) addContinuationPage('resumo financeiro');
      doc.y += 12;
      drawRule(doc.y);
      doc.y += 10;
      const totalX = PAGE_MARGIN + pageWidth() * 0.46;
      const totalWidth = pageWidth() * 0.54;
      for (const [label, value] of rows) {
        const rowY = doc.y;
        doc.font('BlackMachine').fontSize(9).fillColor(COLORS.muted).text(label, totalX + 8, rowY, { width: totalWidth * 0.52, lineBreak: false });
        doc.font('BlackMachine').fontSize(9).fillColor(COLORS.ink).text(formatMoney(value, currency), totalX + totalWidth * 0.52, rowY, { width: totalWidth * 0.48 - 8, align: 'right', lineBreak: false });
        doc.y = rowY + 17;
      }
      doc.save().fillColor(COLORS.paleBlue).roundedRect(totalX, doc.y + 1, totalWidth, 31, 3).fill().restore();
      doc.font('BlackMachine-Bold').fontSize(9).fillColor(COLORS.blue).text(isCreditNote ? 'TOTAL A CREDITAR' : 'TOTAL A PAGAR', totalX + 8, doc.y + 10, { width: totalWidth * 0.52, lineBreak: false });
      doc.font('BlackMachine-Bold').fontSize(12).fillColor(COLORS.ink).text(formatMoney(total, currency), totalX + totalWidth * 0.52, doc.y + 8, { width: totalWidth * 0.48 - 8, align: 'right', lineBreak: false });
      doc.y += 44;
    };

    const drawParagraphSection = (title: string, value: string, fontSize = 8.8) => {
      if (!value) return;
      doc.font('BlackMachine').fontSize(fontSize);
      const lines = wrapText(doc, value, pageWidth());
      if (doc.y + 30 > contentBottom()) addContinuationPage(title.toLocaleLowerCase('pt-AO'));
      drawSectionHeading(title);
      let offset = 0;
      while (offset < lines.length) {
        const availableLines = Math.max(1, Math.floor((contentBottom() - doc.y - 5) / LINE_HEIGHT));
        const lineCount = Math.min(availableLines, lines.length - offset);
        doc.font('BlackMachine').fontSize(fontSize).fillColor(COLORS.ink);
        const textY = doc.y;
        lines.slice(offset, offset + lineCount).forEach((line, index) => {
          doc.text(line, PAGE_MARGIN, textY + index * LINE_HEIGHT, { width: pageWidth(), lineBreak: false });
        });
        doc.y = textY + lineCount * LINE_HEIGHT;
        offset += lineCount;
        if (offset < lines.length) {
          addContinuationPage(title.toLocaleLowerCase('pt-AO'));
          doc.y += 4;
        }
      }
      doc.y += 11;
    };

    const drawPaymentSection = () => {
      if (isCreditNote || (!payments.length && !bankDetails.length)) return;
      const paymentHeight = 38 + Math.min(payments.length, 5) * 18 + bankDetails.length * 14;
      if (doc.y + Math.min(paymentHeight, 180) > contentBottom()) addContinuationPage('pagamento');
      drawSectionHeading('Pagamento');
      if (payments.length) {
        const summary = getInvoicePaymentTotals(total, payments.map((payment: any) => ({ amount: amount(payment.amount), status: String(payment.status ?? '') })));
        const pending = payments.filter((payment: any) => payment.status === 'PENDING').reduce((sum: number, payment: any) => sum + amount(payment.amount), 0);
        const rows: Array<[string, number]> = [
          ['Recebido (confirmado)', summary.confirmed],
          ['Pagamentos pendentes', pending],
          ['Saldo por receber', summary.outstanding],
        ];
        for (const [label, value] of rows) {
          const rowY = doc.y;
          doc.font('BlackMachine').fontSize(8.5).fillColor(COLORS.muted).text(label, PAGE_MARGIN, rowY, { width: pageWidth() * 0.55, lineBreak: false });
          doc.font('BlackMachine-Bold').fontSize(8.5).fillColor(COLORS.ink).text(formatMoney(value, currency), PAGE_MARGIN + pageWidth() * 0.55, rowY, { width: pageWidth() * 0.45, align: 'right', lineBreak: false });
          doc.y = rowY + 15;
        }
        for (const payment of payments) {
          const details = [labelForMethod(String(payment.method ?? '')), labelForPaymentStatus(String(payment.status ?? '')),
            formatDate(payment.paymentDate), textValue(payment.reference) ? `Ref. ${textValue(payment.reference)}` : ''].filter(Boolean).join(' · ');
          if (doc.y + 16 > contentBottom()) addContinuationPage('pagamento');
          const paymentY = doc.y;
          doc.font('BlackMachine').fontSize(7.7).fillColor(COLORS.muted).text(`${details} - ${formatMoney(amount(payment.amount), currency)}`, PAGE_MARGIN, paymentY, { width: pageWidth() });
          doc.y = paymentY + 15;
        }
      }
      if (bankDetails.length) {
        if (doc.y + bankDetails.length * 14 + 12 > contentBottom()) addContinuationPage('dados bancários');
        doc.y += 5;
        const bankHeadingY = doc.y;
        doc.font('BlackMachine-Bold').fontSize(7.5).fillColor(COLORS.ink).text('DADOS BANCÁRIOS', PAGE_MARGIN, bankHeadingY, { width: pageWidth() });
        doc.y = bankHeadingY + 13;
        for (const [label, value] of bankDetails) {
          const bankLineY = doc.y;
          doc.font('BlackMachine').fontSize(8).fillColor(COLORS.muted).text(`${label}: ${value}`, PAGE_MARGIN, bankLineY, { width: pageWidth() });
          doc.y = bankLineY + 13;
        }
      }
      doc.y += 9;
    };

    const drawFooterAndEnd = () => {
      const pageRange = doc.bufferedPageRange();
      const companyFooter = profile ? [textValue(profile.name), textValue(profile.nif) ? `NIF ${textValue(profile.nif)}` : '', textValue(profile.email)].filter(Boolean).join(' · ') : '';
      for (let offset = 0; offset < pageRange.count; offset++) {
        const pageIndex = pageRange.start + offset;
        doc.switchToPage(pageIndex);
        const previousBottom = doc.page.margins.bottom;
        doc.save();
        doc.page.margins.bottom = 0;
        const footerY = doc.page.height - 37;
        drawRule(footerY - 7);
        doc.font('BlackMachine').fontSize(7.2).fillColor(COLORS.muted);
        if (companyFooter) doc.text(companyFooter, PAGE_MARGIN, footerY, { width: pageWidth() - 76, lineBreak: false });
        doc.text(`${offset + 1} / ${pageRange.count}`, doc.page.width - PAGE_MARGIN - 66, footerY, { width: 66, align: 'right', lineBreak: false });
        doc.page.margins.bottom = previousBottom;
        doc.restore();
      }
      doc.end();
    };

    try {
      drawInvoiceHeader();
      drawCustomerBlock();
      if (isCreditNote && textValue(invoiceData.refInvoiceNumber)) {
        const reason = textValue(invoiceData.cancelReason);
        drawParagraphSection('Factura de origem', textValue(invoiceData.refInvoiceNumber));
        if (reason) drawParagraphSection('Motivo da nota de crédito', reason);
      }

      if (doc.y + 42 > contentBottom()) addContinuationPage('artigos');
      doc.font('BlackMachine-Bold').fontSize(8).fillColor(COLORS.ink).text('ARTIGOS E SERVIÇOS', PAGE_MARGIN, doc.y, { width: pageWidth() });
      doc.y += 9;
      drawTableHeader();
      drawItemRows();
      drawTotals();
      drawPaymentSection();
      drawParagraphSection('Observações', textValue(invoiceData.observations));
      drawParagraphSection('Informação adicional', profile ? textValue(profile.invoiceFooter) : '', 8.3);
      drawFooterAndEnd();
    } catch (error) {
      reject(error);
    }
  });
};
