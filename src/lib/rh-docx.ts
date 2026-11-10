import 'server-only';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export async function renderDocx(input: { title: string; content: string; status: string }): Promise<Buffer> {
  const lines = input.content.split('\n');
  const paragraphs = lines.map((line) => new Paragraph({
    children: [new TextRun({ text: line || ' ', size: 21 })],
    spacing: { after: line ? 120 : 60 },
  }));
  const children = [
    new Paragraph({ text: input.title, heading: HeadingLevel.HEADING_1, spacing: { after: 240 } }),
    ...paragraphs,
  ];
  if (input.status !== 'EMITIDO') {
    children.push(new Paragraph({
      spacing: { before: 240 },
      children: [new TextRun({ text: 'RASCUNHO — documento não emitido. Requer validação humana antes da emissão.', color: 'B45309', italics: true })],
    }));
  }
  const doc = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBuffer(doc);
}
