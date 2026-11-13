import { describe, it, expect } from 'vitest';
import { renderAssistantDocx } from '@/lib/documents/assistant-docx';
import { renderAssistantPdf } from '@/lib/documents/assistant-pdf';
import { parseDocumentBlocks, documentFileName } from '@/lib/document-blocks';

const body = `# Carta de Apresentação

Exmo. Senhor,

Vimos por este meio apresentar a nossa proposta.

## Âmbito dos serviços

- Auditoria inicial
- Implementação do sistema

## Proposta comercial

| Item | Prazo | Preço |
|---|---|---|
| Implementação | 30 dias | 150.000,00 Kz |
| Suporte | 12 meses | 25.000,00 Kz |

Assinatura
`;

describe('assistant document generation', () => {
  it('parses blocks', () => {
    const blocks = parseDocumentBlocks(body);
    expect(blocks.some((b) => b.kind === 'table')).toBe(true);
    expect(blocks.some((b) => b.kind === 'signature')).toBe(true);
    expect(blocks.some((b) => b.kind === 'heading')).toBe(true);
  });

  it('generates a real DOCX (zip signature PK)', async () => {
    const identity = {
      name: 'Marstore Lda',
      legalName: 'Marstore Comercial e Serviços, Lda',
      nif: '500000001',
      address: 'Luanda, Angola',
      phone: '+244 923 000 000',
      email: 'geral@marstore.co.ao',
    };
    const docx = await renderAssistantDocx({ title: 'Carta de Apresentação', body, identity });
    expect(docx.length).toBeGreaterThan(1000);
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });

  it('generates without identity', async () => {
    const docx = await renderAssistantDocx({ title: 'Carta', body: '# Olá\n\nConteúdo.' });
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });

  it('documentFileName sanitizes', () => {
    expect(documentFileName('Carta de Apresentação à Empresa', 'docx').endsWith('.docx')).toBe(true);
    expect(documentFileName('Relatório 2025 — Versão 1', 'pdf')).toContain('Relatorio');
  });
});

describe('assistant PDF generation', () => {
  it('generates a real PDF (magic bytes)', async () => {
    const identity = { legalName: 'Marstore Comercial e Serviços, Lda' };
    const pdf = await renderAssistantPdf({ title: 'Carta de Apresentação', body, identity });
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('generates PDF without identity and tables', async () => {
    const tableBody = ['# Tabela', '', '| A | B |', '|---|---|', '| 1 | 2 |'].join(String.fromCharCode(10));
    const pdf = await renderAssistantPdf({ title: 'Tabela', body: tableBody });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
