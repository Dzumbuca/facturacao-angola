import { describe, expect, it } from 'vitest';
import {
  calcularTotaisItens,
  nomeFicheiroPdf,
  totaisDespesasPorCategoria,
  validarDocumentoPdf,
} from './business-docs';

const empresa = { nome: 'Comércio Kiala Lda', nif: '5417000123', contacto: '923 000 000' };

describe('calcularTotaisItens', () => {
  it('soma subtotal, IVA e total', () => {
    const r = calcularTotaisItens([
      { descricao: 'Saco de arroz 25 kg', quantidade: 10, preco: 5000 },
      { descricao: 'Óleo 5 L', quantidade: 4, preco: 2500 },
    ], 14);
    expect(r.subtotal).toBe(60000);
    expect(r.iva).toBeCloseTo(8400, 6);
    expect(r.total).toBeCloseTo(68400, 6);
  });

  it('sem IVA o total é igual ao subtotal', () => {
    const r = calcularTotaisItens([{ descricao: 'Serviço', quantidade: 1, preco: 1000 }]);
    expect(r.iva).toBe(0);
    expect(r.total).toBe(1000);
  });

  it('quantidade zero não conta e valores inválidos tratam-se como zero', () => {
    const r = calcularTotaisItens([
      { descricao: 'A', quantidade: 0, preco: 5000 },
      { descricao: 'B', quantidade: 2, preco: Number.NaN },
    ], 14);
    expect(r.subtotal).toBe(0);
  });
});

describe('validarDocumentoPdf — orçamento / proforma', () => {
  const base = {
    tipo: 'orcamento' as const,
    empresa,
    cliente: { nome: 'Padaria Bom Jesus' },
    itens: [{ descricao: 'Mesas', quantidade: 5, preco: 12000 }],
  };

  it('aceita um orçamento válido e normaliza campos', () => {
    const r = validarDocumentoPdf(base);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.documento.tipo).toBe('orcamento');
  });

  it('rejeita sem itens', () => {
    const r = validarDocumentoPdf({ ...base, itens: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/item/i);
  });

  it('rejeita item sem descrição', () => {
    const r = validarDocumentoPdf({ ...base, itens: [{ descricao: '   ', quantidade: 1, preco: 10 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/descri/i);
  });

  it('rejeita quantidades negativas e preços negativos', () => {
    expect(validarDocumentoPdf({ ...base, itens: [{ descricao: 'A', quantidade: -1, preco: 10 }] }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, itens: [{ descricao: 'A', quantidade: 1, preco: -5 }] }).ok).toBe(false);
  });

  it('rejeita sem nome de empresa ou de cliente', () => {
    expect(validarDocumentoPdf({ ...base, empresa: { nome: '' } }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, cliente: { nome: '' } }).ok).toBe(false);
  });

  it('rejeita IVA fora de 0–100 e não numérico', () => {
    expect(validarDocumentoPdf({ ...base, ivaPercent: 101 }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, ivaPercent: 'x' }).ok).toBe(false);
  });

  it('rejeita payloads que não são objectos ou tipos desconhecidos', () => {
    expect(validarDocumentoPdf(null).ok).toBe(false);
    expect(validarDocumentoPdf('recibo').ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, tipo: ' alien' }).ok).toBe(false);
  });

  it('valida facturas proforma com as mesmas regras', () => {
    const r = validarDocumentoPdf({ ...base, tipo: 'proforma', validadeDias: 15 });
    expect(r.ok).toBe(true);
  });

  it('rejeita validade fora de 1–365', () => {
    expect(validarDocumentoPdf({ ...base, tipo: 'proforma', validadeDias: 0 }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, tipo: 'proforma', validadeDias: 400 }).ok).toBe(false);
  });

  it('trunca textos demasiado longos em vez de falhar', () => {
    const r = validarDocumentoPdf({ ...base, itens: [{ descricao: 'x'.repeat(500), quantidade: 1, preco: 1 }] });
    expect(r.ok).toBe(true);
    if (r.ok && r.documento.tipo === 'orcamento') expect(r.documento.itens[0].descricao.length).toBeLessThanOrEqual(200);
  });

  it('limita o número de itens a 60', () => {
    const muitos = Array.from({ length: 61 }, (_, i) => ({ descricao: `Item ${i}`, quantidade: 1, preco: 1 }));
    const r = validarDocumentoPdf({ ...base, itens: muitos });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/60/);
  });

  it('rejeita datas que não respeitam AAAA-MM-DD', () => {
    expect(validarDocumentoPdf({ ...base, data: '27/10/2026' }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, data: '2026-10-27' }).ok).toBe(true);
  });

  it('rejeita datas no formato certo mas impossíveis no calendário', () => {
    expect(validarDocumentoPdf({ ...base, data: '2026-02-31' }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, data: '2026-13-01' }).ok).toBe(false);
  });
});

describe('validarDocumentoPdf — recibo', () => {
  const base = { tipo: 'recibo' as const, empresa, cliente: { nome: 'Joana M.' }, metodo: 'Multicaixa', valor: 25000 };

  it('aceita um recibo válido', () => {
    const r = validarDocumentoPdf(base);
    expect(r.ok).toBe(true);
  });

  it('rejeita valor zero, negativo ou ausente', () => {
    expect(validarDocumentoPdf({ ...base, valor: 0 }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, valor: -10 }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, valor: undefined }).ok).toBe(false);
  });

  it('metodo ausente passa a Numerário', () => {
    const r = validarDocumentoPdf({ ...base, metodo: undefined });
    expect(r.ok).toBe(true);
    if (r.ok && r.documento.tipo === 'recibo') expect(r.documento.metodo).toBe('Numerário');
  });
});

describe('validarDocumentoPdf — mapa de despesas', () => {
  const base = {
    tipo: 'despesas' as const,
    empresa,
    periodoDe: '2026-10-01',
    periodoAte: '2026-10-31',
    linhas: [
      { data: '2026-10-02', descricao: 'Gasóleo', categoria: 'Transportes', valor: 15000 },
      { data: '2026-10-05', descricao: 'Internet', categoria: 'Serviços', valor: 25000 },
      { data: '2026-10-09', descricao: 'Gasóleo', categoria: 'Transportes', valor: 10000 },
    ],
  };

  it('aceita um mapa válido', () => {
    const r = validarDocumentoPdf(base);
    expect(r.ok).toBe(true);
  });

  it('rejeita sem linhas', () => {
    expect(validarDocumentoPdf({ ...base, linhas: [] }).ok).toBe(false);
  });

  it('rejeita linhas com valor negativo ou zero', () => {
    expect(validarDocumentoPdf({ ...base, linhas: [{ data: '2026-10-02', descricao: 'A', categoria: 'B', valor: 0 }] }).ok).toBe(false);
    expect(validarDocumentoPdf({ ...base, linhas: [{ data: '2026-10-02', descricao: 'A', categoria: 'B', valor: -1 }] }).ok).toBe(false);
  });
});

describe('totaisDespesasPorCategoria', () => {
  it('agrupa por categoria preservando a ordem da primeira ocorrência', () => {
    const grupos = totaisDespesasPorCategoria([
      { data: '2026-10-02', descricao: 'Gasóleo', categoria: 'Transportes', valor: 15000 },
      { data: '2026-10-05', descricao: 'Internet', categoria: 'Serviços', valor: 25000 },
      { data: '2026-10-09', descricao: 'Gasóleo', categoria: 'Transportes', valor: 10000 },
    ]);
    expect(grupos).toEqual([
      { categoria: 'Transportes', total: 25000 },
      { categoria: 'Serviços', total: 25000 },
    ]);
  });
});

describe('nomeFicheiroPdf', () => {
  it('gera nomes seguros por tipo', () => {
    expect(nomeFicheiroPdf({ tipo: 'orcamento', numero: 'ORÇ 12/6' } as any)).toBe('Orcamento_ORC_12_6.pdf');
    expect(nomeFicheiroPdf({ tipo: 'recibo' } as any)).toMatch(/^Recibo_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(nomeFicheiroPdf({ tipo: 'despesas' } as any)).toMatch(/^Mapa_de_despesas_\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(nomeFicheiroPdf({ tipo: 'proforma' } as any)).toMatch(/^Factura_proforma_\d{4}-\d{2}-\d{2}\.pdf$/);
  });
});
