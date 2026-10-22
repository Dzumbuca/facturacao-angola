import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { ReportDataset } from './report-data';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';
export async function exportReport(dataset: ReportDataset, format: ExportFormat): Promise<{ contentType: string; filename: string; body: Buffer | string }> {
  const base = `relatorio-${dataset.kind}-${dataset.generatedAt.toISOString().slice(0, 10)}`;
  if (format === 'csv') return { contentType: 'text/csv; charset=utf-8', filename: `${base}.csv`, body: csv(dataset) };
  if (format === 'xlsx') return { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${base}.xlsx`, body: await xlsx(dataset) };
  if (format === 'pdf') return { contentType: 'application/pdf', filename: `${base}.pdf`, body: await pdf(dataset) };
  throw new RangeError('Formato de exportação inválido.');
}

function csv(dataset: ReportDataset): string {
  const context = [
    ['Empresa', dataset.company.name], ['NIF', dataset.company.nif ?? '—'], ['Relatório', dataset.title],
    ['Período', `${dataset.period.start.toLocaleDateString('pt-AO')} a ${new Date(dataset.period.endExclusive.getTime() - 86400000).toLocaleDateString('pt-AO')}`],
    ['Gerado em', dataset.generatedAt.toLocaleString('pt-AO')], ['Filtro de cliente', dataset.filters.customerId ?? 'Todos'], ['Filtro de estado', dataset.filters.state ?? 'Todos'],
  ];
  const rows = [...context, [], dataset.headers, ...dataset.rows, dataset.totals];
  return `\uFEFF${rows.map((row) => row.map((cell) => escapeCsv(cell)).join(';')).join('\r\n')}`;
}

function escapeCsv(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function xlsx(dataset: ReportDataset): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = dataset.company.name;
  workbook.subject = dataset.title;
  workbook.created = dataset.generatedAt;
  const sheet = workbook.addWorksheet('Relatório', { views: [{ state: 'frozen', ySplit: 8 }] });
  sheet.addRow([dataset.company.name]);
  sheet.addRow([`NIF: ${dataset.company.nif ?? '—'}`]);
  sheet.addRow([dataset.title]);
  sheet.addRow([`Período: ${dataset.period.start.toLocaleDateString('pt-AO')} – ${new Date(dataset.period.endExclusive.getTime() - 86400000).toLocaleDateString('pt-AO')}`]);
  sheet.addRow([`Gerado em: ${dataset.generatedAt.toLocaleString('pt-AO')}`]);
  sheet.addRow([`Filtro de cliente: ${dataset.filters.customerId ?? 'Todos'} · Estado: ${dataset.filters.state ?? 'Todos'}`]);
  sheet.addRow([]);
  const headers = sheet.addRow(dataset.headers);
  headers.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headers.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF102B46' } };
  for (const row of dataset.rows) sheet.addRow(row.map((value) => safeXlsxCell(value)));
  const totalRow = sheet.addRow(dataset.totals.map((value) => safeXlsxCell(value)));
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin', color: { argb: 'FF9EAFBF' } } };
  sheet.columns = dataset.headers.map((header, index) => ({ key: String(index), width: Math.min(36, Math.max(14, header.length + 2)) }));
  sheet.autoFilter = { from: { row: 8, column: 1 }, to: { row: 8 + dataset.rows.length, column: dataset.headers.length } };
  for (let column = 1; column <= dataset.headers.length; column++) {
    if (dataset.headers[column - 1].includes('(AOA)')) for (let row = 9; row <= 8 + dataset.rows.length; row++) sheet.getCell(row, column).numFmt = '#,##0.00';
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function safeXlsxCell(value: string | number | null): string | number {
  if (typeof value === 'string' && /^[\s]*[=+@\-]/.test(value)) return `'${value}`;
  return value ?? '';
}

async function pdf(dataset: ReportDataset): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 34, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#102b46').text(dataset.title);
    doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor('#40566d').text(`Empresa: ${dataset.company.name} · NIF: ${dataset.company.nif ?? '—'}`);
    doc.text(`Período: ${dataset.period.start.toLocaleDateString('pt-AO')} a ${new Date(dataset.period.endExclusive.getTime() - 86400000).toLocaleDateString('pt-AO')} · Gerado em ${dataset.generatedAt.toLocaleString('pt-AO')}`);
    doc.text(`Filtros · Cliente: ${dataset.filters.customerId ?? 'Todos'} · Estado: ${dataset.filters.state ?? 'Todos'}`);
    doc.moveDown(0.8);
    const columns = dataset.headers.length;
    const widths = Array.from({ length: columns }, () => (doc.page.width - 68) / Math.max(1, columns));
    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(Math.min(8, 62 / Math.max(1, columns))).fillColor('#102b46');
      const y = doc.y;
      dataset.headers.forEach((header, index) => doc.text(header, 34 + widths.slice(0, index).reduce((sum, value) => sum + value, 0), y, { width: widths[index], height: 28 }));
      doc.moveTo(34, y + 26).lineTo(doc.page.width - 34, y + 26).strokeColor('#9eafbf').stroke();
      doc.y = y + 32;
    };
    drawHeader();
    for (const row of [...dataset.rows, dataset.totals]) {
      if (doc.y > doc.page.height - 48) { doc.addPage({ size: 'A4', layout: 'landscape', margin: 34 }); drawHeader(); }
      const y = doc.y;
      doc.font('Helvetica').fontSize(Math.min(8, 62 / Math.max(1, columns))).fillColor('#263c52');
      row.forEach((value, index) => doc.text(String(value ?? ''), 34 + widths.slice(0, index).reduce((sum, width) => sum + width, 0), y, { width: widths[index], height: 30, ellipsis: true }));
      doc.y = y + 30;
      doc.moveTo(34, doc.y).lineTo(doc.page.width - 34, doc.y).strokeColor('#e5ebf0').stroke();
    }
    if (!dataset.rows.length) doc.fontSize(10).text('Sem dados para os filtros seleccionados.', { align: 'center' });
    doc.end();
  });
}
