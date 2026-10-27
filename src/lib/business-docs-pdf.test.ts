import { describe, expect, it } from 'vitest';
import { gerarDocumentoPdf } from './business-docs-pdf';
import { validarDocumentoPdf } from './business-docs';

const empresa = { nome: 'Comércio Kiala Lda', nif: '5417000123', contacto: '923 000 000' };

async function pdfDe(payload: unknown): Promise<Buffer> {
  const validado = validarDocumentoPdf(payload);
  if (!validado.ok) throw new Error(`payload de teste inválido: ${validado.erro}`);
  return gerarDocumentoPdf(validado.documento);
}

describe('gerarDocumentoPdf', () => {
  it('orçamento com IVA produz um PDF válido', async () => {
    const pdf = await pdfDe({
      tipo: 'orcamento', empresa, cliente: { nome: 'Padaria Bom Jesus' },
      numero: 'ORC-2026-01', data: '2026-10-27',
      itens: [
        { descricao: 'Mesa de madeira', quantidade: 5, preco: 12000 },
        { descricao: 'Cadeira', quantidade: 20, preco: 3500 },
      ],
      ivaPercent: 14, notas: 'Entrega em Luanda incluída.',
    });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('factura proforma produz um PDF válido', async () => {
    const pdf = await pdfDe({
      tipo: 'proforma', empresa, cliente: { nome: 'Padaria Bom Jesus' },
      validadeDias: 15,
      itens: [{ descricao: 'Serviço de transporte', quantidade: 1, preco: 45000 }],
    });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('recibo produz um PDF válido', async () => {
    const pdf = await pdfDe({
      tipo: 'recibo', empresa, cliente: { nome: 'Joana Mwangolé' },
      numero: 'REC-004', data: '2026-10-27', metodo: 'Multicaixa', valor: 25000,
      descricao: 'Pagamento da factura FT 2026/018',
    });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('mapa de despesas produz um PDF válido', async () => {
    const pdf = await pdfDe({
      tipo: 'despesas', empresa, periodoDe: '2026-10-01', periodoAte: '2026-10-31',
      linhas: [
        { data: '2026-10-02', descricao: 'Gasóleo', categoria: 'Transportes', valor: 15000 },
        { data: '2026-10-05', descricao: 'Internet', categoria: 'Serviços', valor: 25000 },
      ],
    });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('muitos itens não partem o layout (multipágina)', async () => {
    const itens = Array.from({ length: 60 }, (_, i) => ({ descricao: `Artigo número ${i + 1} com descrição longa para forçar quebra`, quantidade: 2, preco: 1000 + i }));
    const pdf = await pdfDe({ tipo: 'orcamento', empresa, cliente: { nome: 'Cliente' }, itens, ivaPercent: 14 });
    expect(pdf.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(3000);
  });
});
