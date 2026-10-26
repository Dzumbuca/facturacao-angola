import { describe, expect, it } from 'vitest';
import {
  IVA_TAXAS,
  arredondarParaCima,
  calcularLucro,
  calcularPrecoVenda,
  converterIva,
  filtrarFerramentas,
  formatKz,
  formatPercent,
  parseValor,
} from './business-tools';
import { FERRAMENTAS } from '../app/ferramentas/tools-data';

describe('parseValor', () => {
  it('lê formatos pt e en: vírgula decimal, ponto decimal e milhares', () => {
    expect(parseValor('1234,56')).toBe(1234.56);
    expect(parseValor('1234.56')).toBe(1234.56);
    expect(parseValor('1.234,56')).toBe(1234.56);
    expect(parseValor('100.000')).toBe(100000);
    expect(parseValor('1 000')).toBe(1000);
    expect(parseValor(' 42 ')).toBe(42);
  });

  it('devolve NaN para vazio ou texto inválido', () => {
    expect(Number.isNaN(parseValor(''))).toBe(true);
    expect(Number.isNaN(parseValor('   '))).toBe(true);
    expect(Number.isNaN(parseValor('abc'))).toBe(true);
    expect(Number.isNaN(parseValor('12,3,4'))).toBe(true);
  });

  it('mantém negativos e zero (a validação de intervalo é dos componentes)', () => {
    expect(parseValor('-5')).toBe(-5);
    expect(parseValor('0')).toBe(0);
  });
});

describe('calcularLucro', () => {
  const entrada = { custoAquisicao: 500, outrosCustos: 100, precoVenda: 1000, quantidade: 10 };

  it('calcula custo total, lucro unitário, margem, markup e lucro total', () => {
    const r = calcularLucro(entrada);
    expect(r.custoTotalUnitario).toBe(600);
    expect(r.lucroUnitario).toBe(400);
    expect(r.margemPercent).toBeCloseTo(40, 6);
    expect(r.markupPercent).toBeCloseTo(66.6666666667, 6);
    expect(r.lucroTotal).toBe(4000);
    expect(r.prejuizo).toBe(false);
  });

  it('margem é null quando o preço de venda é zero (evita divisão inválida)', () => {
    const r = calcularLucro({ ...entrada, precoVenda: 0 });
    expect(r.margemPercent).toBeNull();
    expect(r.lucroUnitario).toBe(-600);
    expect(r.prejuizo).toBe(true);
  });

  it('markup é null quando o custo total é zero', () => {
    const r = calcularLucro({ ...entrada, custoAquisicao: 0, outrosCustos: 0 });
    expect(r.custoTotalUnitario).toBe(0);
    expect(r.markupPercent).toBeNull();
    expect(r.margemPercent).toBe(100);
  });

  it('apresenta prejuízo quando o preço é inferior ao custo', () => {
    const r = calcularLucro({ ...entrada, precoVenda: 400 });
    expect(r.prejuizo).toBe(true);
    expect(r.lucroUnitario).toBe(-200);
    expect(r.margemPercent).toBeCloseTo(-50, 6);
    expect(r.lucroTotal).toBe(-2000);
  });

  it('lucro total é null sem quantidade (0 ou negativa)', () => {
    expect(calcularLucro({ ...entrada, quantidade: 0 }).lucroTotal).toBeNull();
    expect(calcularLucro({ ...entrada, quantidade: -2 }).lucroTotal).toBeNull();
  });
});

describe('calcularPrecoVenda', () => {
  it('aplica preço = custo total / (1 - margem/100)', () => {
    const r = calcularPrecoVenda({ custoAquisicao: 500, outrosCustos: 100, margemPretendida: 25, quantidade: 5 });
    expect(r.custoTotalUnitario).toBe(600);
    expect(r.precoRecomendado).toBe(800);
    expect(r.lucroUnitario).toBe(200);
    expect(r.lucroTotal).toBe(1000);
    expect(r.margemEfetivaPercent).toBeCloseTo(25, 6);
  });

  it('rejeita margens iguais ou superiores a 100%', () => {
    expect(calcularPrecoVenda({ custoAquisicao: 100, outrosCustos: 0, margemPretendida: 100, quantidade: 0 }).precoRecomendado).toBeNull();
    expect(calcularPrecoVenda({ custoAquisicao: 100, outrosCustos: 0, margemPretendida: 150, quantidade: 0 }).precoRecomendado).toBeNull();
  });

  it('margem negativa não produz preço recomendado', () => {
    expect(calcularPrecoVenda({ custoAquisicao: 100, outrosCustos: 0, margemPretendida: -10, quantidade: 0 }).precoRecomendado).toBeNull();
  });

  it('lucro total é null sem quantidade', () => {
    const r = calcularPrecoVenda({ custoAquisicao: 600, outrosCustos: 0, margemPretendida: 20, quantidade: 0 });
    expect(r.lucroTotal).toBeNull();
    expect(r.precoRecomendado).toBe(750);
  });

  it('arredondamento comercial ajusta o preço e recalcula lucro e margem efectiva', () => {
    // 600 / (1 - 0,58) = 1.428,57… → arredondado a 25 Kz para cima = 1.450 Kz
    const r = calcularPrecoVenda({ custoAquisicao: 600, outrosCustos: 0, margemPretendida: 58, quantidade: 3, arredondamento: 25 });
    expect(r.precoRecomendado).toBeCloseTo(1428.5714285714, 6);
    expect(r.precoAjustado).toBe(1450);
    expect(r.lucroUnitario).toBe(850);
    expect(r.lucroTotal).toBe(2550);
    expect(r.margemEfetivaPercent).toBeCloseTo((850 / 1450) * 100, 6);
  });

  it('sem arredondamento, preço ajustado é igual ao recomendado', () => {
    const r = calcularPrecoVenda({ custoAquisicao: 600, outrosCustos: 0, margemPretendida: 25, quantidade: 0 });
    expect(r.precoAjustado).toBe(r.precoRecomendado);
  });
});

describe('arredondarParaCima', () => {
  it('arredonda o preço para um valor comercial (exemplo do projecto: 1.428 → 1.450)', () => {
    expect(arredondarParaCima(1428, 25)).toBe(1450);
    expect(arredondarParaCima(1437, 10)).toBe(1440);
    expect(arredondarParaCima(1000, 100)).toBe(1000);
  });

  it('incremento inválido devolve o valor original', () => {
    expect(arredondarParaCima(1428, 0)).toBe(1428);
    expect(arredondarParaCima(1428, -5)).toBe(1428);
  });
});

describe('converterIva', () => {
  it('MODO A — acrescentar IVA: 100.000 Kz a 14% → IVA 14.000, total 114.000', () => {
    const r = converterIva(100000, 14, 'acrescentar');
    expect(r.valorSemIva).toBe(100000);
    expect(r.iva).toBeCloseTo(14000, 6);
    expect(r.totalComIva).toBeCloseTo(114000, 6);
  });

  it('MODO B — retirar IVA: total 114.000 Kz a 14% → base 100.000, IVA incluído 14.000', () => {
    const r = converterIva(114000, 14, 'retirar');
    expect(r.valorSemIva).toBeCloseTo(100000, 6);
    expect(r.iva).toBeCloseTo(14000, 6);
    expect(r.totalComIva).toBeCloseTo(114000, 6);
  });

  it('taxa isenta (0%) mantém os valores iguais', () => {
    const add = converterIva(50000, 0, 'acrescentar');
    const rem = converterIva(50000, 0, 'retirar');
    expect(add.iva).toBe(0);
    expect(add.totalComIva).toBe(50000);
    expect(rem.valorSemIva).toBe(50000);
    expect(rem.iva).toBe(0);
  });

  it('taxas disponíveis são as configuradas no projecto: 14, 7, 2 e 0', () => {
    expect(IVA_TAXAS.map((t) => t.valor)).toEqual([14, 7, 2, 0]);
  });
});

describe('formatação pt-AO', () => {
  it('formatKz apresenta kwanzas com agrupamento de milhares', () => {
    const texto = formatKz(100000).replace(/\u00a0/g, ' ');
    expect(texto).toContain('Kz');
    expect(texto).toMatch(/100[ .]000/);
  });

  it('formatPercent usa vírgula decimal e traço para nulo', () => {
    expect(formatPercent(40)).toBe('40%');
    expect(formatPercent(12.5)).toBe('12,5%');
    expect(formatPercent(null)).toBe('—');
  });
});

describe('filtrarFerramentas', () => {
  it('pesquisa sem acentos encontra ferramentas (iva, salario, margem)', () => {
    expect(filtrarFerramentas(FERRAMENTAS, 'iva', 'Todas').map((f) => f.id)).toEqual(
      expect.arrayContaining(['iva', 'conversor-iva']),
    );
    expect(filtrarFerramentas(FERRAMENTAS, 'salario', 'Todas').map((f) => f.id)).toContain('salario');
    expect(filtrarFerramentas(FERRAMENTAS, 'margem', 'Todas').map((f) => f.id)).toContain('lucro');
  });

  it('filtra por categoria', () => {
    const fiscalidade = filtrarFerramentas(FERRAMENTAS, '', 'Fiscalidade');
    expect(fiscalidade.length).toBeGreaterThan(0);
    expect(fiscalidade.every((f) => f.categoria === 'Fiscalidade')).toBe(true);
  });

  it('pesquisa sem resultados devolve lista vazia (estado vazio)', () => {
    expect(filtrarFerramentas(FERRAMENTAS, 'zzzz', 'Todas')).toEqual([]);
  });

  it('pesquisa vazia com todas as categorias devolve o catálogo completo', () => {
    expect(filtrarFerramentas(FERRAMENTAS, '', 'Todas')).toHaveLength(FERRAMENTAS.length);
  });
});
