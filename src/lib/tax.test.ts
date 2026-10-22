import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals } from './tax';

describe('Cálculos de Impostos e Totais (IVA Angola 14%)', () => {
  it('deve calcular corretamente o IVA de 14% para um item padrão', () => {
    const items = [{ qty: 2, rate: 5000 }]; // 10.000 Kz subtotal
    const result = calculateInvoiceTotals(items);

    expect(result.subTotal).toBe(10000);
    expect(result.taxTotal).toBe(1400); // 14% de 10.000
    expect(result.total).toBe(11400);
  });

  it('deve tratar arredondamentos de casas decimais corretamente', () => {
    const items = [{ qty: 1, rate: 33.33 }];
    const result = calculateInvoiceTotals(items);

    expect(result.subTotal).toBe(33.33);
    expect(result.taxTotal).toBe(4.67); // 33.33 * 0.14 = 4.6662 -> 4.67
    expect(result.total).toBe(38);
  });

  it('deve aplicar a taxa de IVA especificada em cada linha', () => {
    const result = calculateInvoiceTotals([
      { qty: 1, rate: 100, taxRate: 14 },
      { qty: 1, rate: 100, taxRate: 5 },
    ]);

    expect(result.subTotal).toBe(200);
    expect(result.taxTotal).toBe(19);
    expect(result.total).toBe(219);
  });
});
