/** Parser partilhado do corpo de documentos Markdown-lite → blocos estruturados. */

export type DocumentBlock =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { kind: 'paragraph'; text: string; align?: 'left' | 'center' | 'right' | 'justify' }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'numbered'; items: string[] }
  | { kind: 'table'; rows: string[][] }
  | { kind: 'signature'; label: string }
  | { kind: 'hr' };

export type DocumentIdentity = {
  name?: string;
  legalName?: string;
  nif?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoDataUrl?: string | null;
  includeLogo?: boolean;
};

const stripCell = (cell: string) => cell.replace(/^\s*\|?|\|?\s*$/g, '').trim();

function splitTableLine(line: string): string[] {
  return line.split('|').map(stripCell).filter((_, index, arr) => !(index === 0 && arr[0] === '') && !(index === arr.length - 1 && arr[arr.length - 1] === ''));
}

const isSeparatorRow = (cells: string[]) =>
  cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c.replace(/\s/g, '')));

export function parseDocumentBlocks(body: string): DocumentBlock[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const blocks: DocumentBlock[] = [];
  let currentBullets: string[] | null = null;
  let currentNumbered: string[] | null = null;
  let currentTable: string[][] | null = null;

  const flushLists = () => {
    if (currentBullets && currentBullets.length) blocks.push({ kind: 'bullets', items: currentBullets });
    if (currentNumbered && currentNumbered.length) blocks.push({ kind: 'numbered', items: currentNumbered });
    currentBullets = null; currentNumbered = null;
  };
  const flushTable = () => {
    if (currentTable && currentTable.length >= 2) blocks.push({ kind: 'table', rows: currentTable });
    currentTable = null;
  };

  const signatureLine = (line: string): boolean =>
    /^\s*(assinatura|carimbo( e assinatura)?|local e data|assina[dt])\b/i.test(line)
    || /^\s*_{6,}\s*$/.test(line);

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flushLists(); flushTable(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) { flushLists(); flushTable(); blocks.push({ kind: 'hr' }); continue; }

    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushLists(); flushTable();
      blocks.push({ kind: 'heading', level: Math.min(4, heading[1].length) as 1 | 2 | 3 | 4, text: heading[2].trim() });
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      flushTable();
      if (currentNumbered) { blocks.push({ kind: 'numbered', items: currentNumbered }); currentNumbered = null; }
      currentBullets = currentBullets ?? [];
      currentBullets.push(trimmed.replace(/^[-*•]\s+/, '').trim());
      continue;
    }

    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushTable();
      if (currentBullets) { blocks.push({ kind: 'bullets', items: currentBullets }); currentBullets = null; }
      currentNumbered = currentNumbered ?? [];
      currentNumbered.push(numbered[1].trim());
      continue;
    }

    if (trimmed.includes('|')) {
      const cells = splitTableLine(trimmed);
      if (cells.length >= 2) {
        if (isSeparatorRow(cells)) continue;
        flushLists();
        currentTable = currentTable ?? [];
        currentTable.push(cells);
        continue;
      }
    }

    flushLists(); flushTable();
    if (signatureLine(trimmed)) {
      blocks.push({ kind: 'signature', label: trimmed.replace(/^(assinatura|carimbo|local e data|assina[dt])\s*[:\-.]?\s*/i, '').trim() || 'Assinatura' });
      continue;
    }
    blocks.push({ kind: 'paragraph', text: trimmed });
  }
  flushLists(); flushTable();
  return blocks;
}

export function titleFromBody(body: string): string | null {
  const firstHeading = body.split('\n').map((l) => l.trim()).find((l) => /^#\s+/.test(l));
  return firstHeading ? firstHeading.replace(/^#\s+/, '').trim() : null;
}

export function documentFileName(title: string, ext: string): string {
  const safe = title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\- ]/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'documento';
  return `${safe}.${ext}`;
}
