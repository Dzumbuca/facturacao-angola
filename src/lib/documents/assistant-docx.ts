import 'server-only';
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel,
  ImageRun, LevelFormat, Packer, PageNumber, Paragraph, Table, TableCell, TableLayoutType,
  TableRow, TextRun, WidthType,
} from 'docx';
import { parseDocumentBlocks, parseInlineRuns, type DocumentIdentity } from '../document-blocks';

const BRAND = '021F87';
const INK = '171C27';
const MUTED = '647184';
const LINE = 'DCE2EA';
const PALE = 'F3F6FA';

const PT_FONT = 'Calibri';

function heading(text: string, level: 1 | 2 | 3 | 4): Paragraph {
  const levels = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4 } as const;
  const config = {
    1: { size: 34, bold: true, color: BRAND, before: 280, after: 200 },
    2: { size: 26, bold: true, color: INK, before: 220, after: 120 },
    3: { size: 22, bold: true, color: INK, before: 180, after: 100 },
    4: { size: 20, bold: true, color: MUTED, before: 140, after: 80 },
  }[level];
  return new Paragraph({
    heading: levels[level],
    spacing: { before: config.before, after: config.after },
    children: [new TextRun({ text, bold: config.bold, size: config.size, color: config.color, font: PT_FONT })],
  });
}

const paraRuns = (runs: { text: string; bold?: boolean; italic?: boolean; code?: boolean }[], options: { align?: 'left' | 'center' | 'right' | 'justify'; size?: number; color?: string } = {}) =>
  new Paragraph({
    alignment: options.align === 'justify' ? AlignmentType.JUSTIFIED : options.align === 'center' ? AlignmentType.CENTER : options.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: 140, line: 276 },
    children: runs.map((run) => new TextRun({
      text: run.text,
      size: options.size ?? 21,
      color: options.color ?? INK,
      bold: run.bold ?? false,
      italics: run.italic ?? false,
      font: run.code ? 'Consolas' : PT_FONT,
    })),
  });

const paraInline = (text: string, options: { align?: 'left' | 'center' | 'right' | 'justify'; size?: number; color?: string } = {}) =>
  paraRuns(parseInlineRuns(text), options);

/** Tabela profissional: cabeçalho azul pálido, linhas alternadas, bordas finas. */
function tableFromRows(rows: string[][]): Table {
  const maxCols = Math.max(...rows.map((r) => r.length));
  const pct = 100 / maxCols;
  return new Table({
    layout: TableLayoutType.AUTOFIT,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      left: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      right: { style: BorderStyle.SINGLE, size: 4, color: LINE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: LINE },
    },
    rows: rows.map((row, index) => new TableRow({
      tableHeader: index === 0,
      children: row.map((cell) => new TableCell({
        width: { size: pct, type: WidthType.PERCENTAGE },
        shading: index === 0 ? { type: 'clear' as any, fill: 'E7ECF8' } : index % 2 === 0 ? { type: 'clear' as any, fill: PALE } : undefined,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          spacing: { after: 0 },
          children: [new TextRun({ text: cell, size: 19, bold: index === 0, color: index === 0 ? BRAND : INK, font: PT_FONT })],
        })],
      })),
    })),
  });
}

const bulletItem = (text: string): Paragraph =>
  new Paragraph({
    numbering: { reference: 'bullet-list', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 21, color: INK, font: PT_FONT })],
  });

const numberedItem = (text: string): Paragraph =>
  new Paragraph({
    numbering: { reference: 'numbered-list', level: 0 },
    spacing: { after: 60 },
    children: parseInlineRuns(text).map((run) => new TextRun({ text: run.text, size: 21, color: INK, bold: run.bold ?? false, italics: run.italic ?? false, font: PT_FONT })),
  });

export interface AssistantDocumentInput {
  title: string;
  body: string;
  identity?: DocumentIdentity;
}

const numbering = {
  config: [
    { reference: 'numbered-list', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, start: 1, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }] },
    { reference: 'bullet-list', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] },
  ],
};

function headerFromIdentity(identity: DocumentIdentity | undefined): Header | undefined {
  if (!identity?.legalName && !identity?.name) return undefined;
  const name = identity.legalName || identity.name || '';
  const line = [identity.address, identity.nif ? `NIF ${identity.nif}` : null, identity.phone, identity.email].filter(Boolean).join('  ·  ');
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 0 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BRAND, space: 4 } },
        children: [
          new TextRun({ text: name, bold: true, size: 21, color: BRAND, font: PT_FONT }),
          new TextRun({ text: line ? `   ${line}` : '', size: 14, color: MUTED, font: PT_FONT }),
        ],
      }),
    ],
  });
}

function footerFromIdentity(identity: DocumentIdentity | undefined): Footer {
  const name = identity?.legalName || identity?.name || '';
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
        spacing: { before: 60 },
        children: [
          new TextRun({ text: name ? `${name}  ·  ` : '', size: 14, color: MUTED, font: PT_FONT }),
          new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 14, color: MUTED, font: PT_FONT }),
        ],
      }),
    ],
  });
}

export async function renderAssistantDocx(input: AssistantDocumentInput): Promise<Buffer> {
  const blocks = parseDocumentBlocks(input.body);
  const children: Array<Paragraph | Table> = [];

  children.push(new Paragraph({
    heading: HeadingLevel.TITLE,
    spacing: { after: 280 },
    children: [new TextRun({ text: input.title, size: 40, bold: true, color: BRAND, font: PT_FONT })],
  }));

  // Logo opcional entre o título e o corpo
  if (input.identity?.includeLogo && input.identity.logoDataUrl?.startsWith('data:image/')) {
    try {
      const base64 = input.identity.logoDataUrl.split(',')[1] ?? '';
      const mime = /data:image\/(png|jpeg|jpg|webp|gif)/.exec(input.identity.logoDataUrl)?.[0]?.replace('image/', '') ?? 'png';
      if (base64) {
        children.push(new Paragraph({
          spacing: { after: 160 },
          children: [new ImageRun({ type: mime as any, data: Buffer.from(base64, 'base64'), transformation: { width: 140, height: 52 } })],
        }));
      }
    } catch { /* logo inválido → ignorar */ }
  }

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        children.push(heading(block.text, block.level));
        break;
      case 'paragraph':
        children.push(paraInline(block.text, { align: 'justify' }));
        break;
      case 'bullets':
        for (const item of block.items) children.push(bulletItem(item));
        break;
      case 'numbered':
        block.items.forEach((item) => children.push(numberedItem(item)));
        break;
      case 'table':
        children.push(tableFromRows(block.rows));
        break;
      case 'signature':
        children.push(paraInline('', {}));
        children.push(paraInline('________________________________', { align: 'center', color: INK }));
        children.push(paraInline(input.identity?.legalName || block.label, { align: 'center', size: 18, color: MUTED }));
        break;
      case 'hr':
        children.push(new Paragraph({
          spacing: { before: 80, after: 200 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE, space: 1 } },
          children: [new TextRun({ text: ' ', size: 1, font: PT_FONT })],
        }));
        break;
    }
  }

  const header = headerFromIdentity(input.identity);
  const footer = footerFromIdentity(input.identity);

  const doc = new Document({
    numbering,
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 720, footer: 720 } } },
      headers: header ? { default: header } : undefined,
      footers: { default: footer },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
