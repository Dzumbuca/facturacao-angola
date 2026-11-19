import PDFDocument from 'pdfkit';

type AccountingStatementInput = {
  companyName: string;
  companyNif?: string | null;
  exerciseYear: number;
  issuedAt: Date;
  assets: number;
  liabilities: number;
  equity: number;
  revenue: number;
  expenses: number;
  result: number;
  balanceOK: boolean;
};

const BRAND = '#021F87';
const INK = '#172033';
const MUTED = '#66758A';
const LINE = '#DCE2EA';
const PAGE_MARGIN = 42;
const CONTENT_WIDTH = 595.28 - PAGE_MARGIN * 2;

function money(value: number) {
  try {
    return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 2 }).format(value).replace(/\u00a0/g, ' ');
  } catch {
    return `${value.toFixed(2)} AOA`;
  }
}
function date(d: Date) {
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Africa/Luanda' }).format(d);
}

export async function generateAccountingStatementPdf(input: AccountingStatementInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 44, left: 42, right: 42, bottom: 58 }, bufferPages: true, info: {
      Title: `Demonstrações financeiras ${input.exerciseYear}`,
      Author: input.companyName,
      Creator: 'Machine Facturas',
    } });
    const chunks: Buffer[] = [];
    pdf.on('data', (chunk: Buffer) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);

    // Header band
    pdf.rect(0, 0, pdf.page.width, 92).fill(BRAND);
    pdf.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(11).text(input.companyName, PAGE_MARGIN, 23, { width: 300 });
    if (input.companyNif) pdf.font('Helvetica').fontSize(8).text(`NIF ${input.companyNif}`, PAGE_MARGIN, 42);
    pdf.font('Helvetica-Bold').fontSize(15).text(`Demonstrações ${input.exerciseYear}`, PAGE_MARGIN, 34, { width: CONTENT_WIDTH, align: 'right' });
    pdf.font('Helvetica').fontSize(8).fillColor('#DCE6FF').text(`Gerado em ${date(input.issuedAt)} · Estimativa, sem certificação AGT`, PAGE_MARGIN, 58, { width: CONTENT_WIDTH, align: 'right' });

    pdf.fillColor(BRAND).font('Helvetica-Bold').fontSize(18).text('Balanço', PAGE_MARGIN, 112);
    pdf.fillColor(MUTED).font('Helvetica').fontSize(8).text('Activo = Passivo + Capital Próprio', PAGE_MARGIN, pdf.y + 2);
    pdf.moveDown(0.5);

    // Balancete table
    const cols = [
      { label: 'Rubric', x: PAGE_MARGIN, w: 210 },
      { label: 'Valor', x: PAGE_MARGIN + 330, w: CONTENT_WIDTH - 330, align: 'right' as const },
    ];
    let y = pdf.y + 10;
    const row = (label: string, value: number, bold = false) => {
      pdf.fillColor(INK).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(label, cols[0].x, y, { width: cols[0].w });
      pdf.text(money(value), cols[1].x, y, { width: cols[1].w, align: 'right' });
      y += 20;
      pdf.strokeColor(LINE).lineWidth(0.5).moveTo(PAGE_MARGIN, y - 6).lineTo(PAGE_MARGIN + CONTENT_WIDTH, y - 6).stroke();
    };
    row('Activo total', input.assets, true);
    row('Passivo', input.liabilities);
    row('Capital próprio', input.equity);
    row('Passivo + Capital próprio', input.liabilities + input.equity, true);

    y += 18;
    pdf.fillColor(input.balanceOK ? '#227958' : '#A83939').font('Helvetica-Bold').fontSize(9)
      .text(input.balanceOK ? 'Equação contabilística verificada: Activo = Passivo + Capital próprio' : 'Equação NÃO verificada — ver com o contabilista.', PAGE_MARGIN, y, { width: CONTENT_WIDTH });

    // DRE
    y += 40;
    pdf.fillColor(BRAND).font('Helvetica-Bold').fontSize(18).text('Demonstração de resultados', PAGE_MARGIN, y);
    y += 26;
    row('Rendimentos', input.revenue);
    row('Gastos', input.expenses);
    row('Resultado do exercício', input.result, true);

    y += 14;
    pdf.fillColor(MUTED).font('Helvetica').fontSize(7).text(
      'Este documento é uma estimativa gerada automaticamente. Não é uma demonstração financeira oficial.\nPara fins fiscais (AGT), valide com um contabilista competente em Angola.',
      PAGE_MARGIN, y, { width: CONTENT_WIDTH });

    pdf.end();
  });
}
