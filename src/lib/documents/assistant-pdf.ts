import 'server-only';
import PDFDocument from 'pdfkit';
import { parseDocumentBlocks, parseInlineRuns, inlineRunsToText, type DocumentIdentity } from '../document-blocks';

const BRAND = '#021f87';
const INK = '#171c27';
const MUTED = '#647184';
const LINE = '#dce2ea';
const PALE = '#f3f6fa';
const HEADER_FILL = '#e7ecf8';
const PAGE_W = 595.28;
const PAGE_MARGIN = 48;
const CONTENT_W = PAGE_W - PAGE_MARGIN * 2;



export type AssistantPdfInput = { title: string; body: string; identity?: DocumentIdentity };

export function renderAssistantPdf(input: AssistantPdfInput): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: PAGE_MARGIN, right: PAGE_MARGIN }, bufferPages: true });
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const identity = input.identity;
  const emitHeader = () => {
    if (!identity?.legalName && !identity?.name) return;
    const name = identity.legalName || identity.name || '';
    const line = [identity.address, identity.nif ? `NIF ${identity.nif}` : null, identity.phone, identity.email].filter(Boolean).join('  ·  ');
    doc.rect(0, 0, PAGE_W, 8).fill(BRAND);
    doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(name, PAGE_MARGIN, 18, { width: CONTENT_W, align: 'left' });
    if (line) doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(line, PAGE_MARGIN, doc.y + 1, { width: CONTENT_W });
    doc.moveTo(PAGE_MARGIN, doc.y + 6).lineTo(PAGE_MARGIN + CONTENT_W, doc.y + 6).strokeColor(BRAND).lineWidth(1.2).stroke();
    doc.y += 16;
  };
  const emitFooter = () => {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.rect(0, doc.page.height - 30, PAGE_W, 30).fill('#f8fafc');
      doc.fillColor(MUTED).font('Helvetica').fontSize(7);
      const name = identity?.legalName || identity?.name || '';
      if (name) doc.text(name, PAGE_MARGIN, doc.page.height - 18, { width: 300, align: 'left' });
      doc.text(`Página ${i - range.start + 1} de ${range.count}`, PAGE_MARGIN, doc.page.height - 18, { width: CONTENT_W, align: 'right' });
    }
  };

  emitHeader();
  doc.moveDown(0.4);
  doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(20).text(input.title, { width: CONTENT_W });
  doc.moveDown(0.6);

  const blocks = parseDocumentBlocks(input.body);
  const runsOf = (text: string) => parseInlineRuns(text);
  const drawRuns = (runs: { text: string; bold?: boolean; italic?: boolean; code?: boolean }[], fontSize: number, color: string, align: 'left' | 'center' | 'right' | 'justify' = 'justify') => {
    if (!runs.length) return;
    doc.fillColor(color).font('Helvetica').fontSize(fontSize);
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      const isLast = i === runs.length - 1;
      const font = run.bold ? 'Helvetica-Bold' : run.italic ? 'Helvetica-Oblique' : run.code ? 'Courier' : 'Helvetica';
      doc.font(font).text(run.text, { continued: !isLast, width: CONTENT_W, align, lineGap: 2 });
    }
    doc.moveDown(0.25);
  };

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading': {
        const cfg = ({ 1: { size: 15, before: 16, color: BRAND }, 2: { size: 12.5, before: 13, color: INK }, 3: { size: 10.5, before: 10, color: INK }, 4: { size: 9, before: 8, color: MUTED } } as const)[block.level];
        doc.moveDown(cfg.before / 18);
        doc.fillColor(cfg.color).font('Helvetica-Bold').fontSize(cfg.size).text(inlineRunsToText(parseInlineRuns(block.text)), { width: CONTENT_W });
        doc.moveDown(0.18);
        break;
      }
      case 'paragraph':
        drawRuns(runsOf(block.text), 10.5, INK, 'justify');
        break;
      case 'bullets':
        for (const item of block.items) {
          doc.moveDown(0.05);
          drawRuns([{ text: '•  ' }, ...runsOf(item)], 10, INK, 'left');
        }
        doc.moveDown(0.2);
        break;
      case 'numbered':
        block.items.forEach((item, index) => {
          doc.moveDown(0.05);
          drawRuns([{ text: `${index + 1}.  ` }, ...runsOf(item)], 10, INK, 'left');
        });
        doc.moveDown(0.2);
        break;
      case 'table': {
        const rows = block.rows;
        const colWidth = CONTENT_W / Math.max(...rows.map((r) => r.length));
        const rowHeight = 22;
        rows.forEach((row, rowIndex) => {
          // keep the whole row together if it fits
          const yAnchor = doc.y;
          row.forEach((cell, index) => {
            const isHeader = rowIndex === 0;
            doc.roundedRect(PAGE_MARGIN + index * colWidth, yAnchor - 3, colWidth - 4, rowHeight, 3).fillAndStroke(isHeader ? HEADER_FILL : rowIndex % 2 === 0 ? PALE : '#ffffff', LINE);
            const cellText = cell.trim();
            doc.fillColor(isHeader ? BRAND : INK).font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).text(cellText, PAGE_MARGIN + index * colWidth + 5, yAnchor + 3, { width: colWidth - 10, height: rowHeight - 6 });
          });
          doc.y = yAnchor + rowHeight + 2;
        });
        doc.moveDown(0.5);
        break;
      }
      case 'signature':
        doc.moveDown(1.5);
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(10).text('____________________________', { width: CONTENT_W, align: 'center' });
        doc.moveDown(0.25);
        doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(identity?.legalName || block.label, { width: CONTENT_W, align: 'center' });
        break;
      case 'hr':
        doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + CONTENT_W, doc.y).lineWidth(0.7).strokeColor(LINE).stroke();
        doc.moveDown(0.5);
        break;
    }
  }

  emitFooter();
  doc.end();
  return done;
}
