import { describe, it, expect } from 'vitest';
import { parsePayrollConfig, calculateIrt, calculatePayslip } from './rh-payroll';
import { lateMinutesFor, maskAccount } from './rh-service';

describe('parsePayrollConfig', () => {
  const valid = {
    inssEmployeeRate: 3, inssEmployerRate: 8, foodAllowance: 0, transportAllowance: 0,
    irtBrackets: [{ upTo: 100000, rate: 0, deduction: 0 }, { upTo: null, rate: 10, deduction: 0 }],
  };
  it('aceita configuração válida', () => {
    expect(parsePayrollConfig(valid)).toEqual({ config: { ...valid } });
  });
  it('rejeita taxas fora de 0-100', () => {
    expect(parsePayrollConfig({ ...valid, inssEmployeeRate: 101 })).toHaveProperty('error');
    expect(parsePayrollConfig({ ...valid, inssEmployerRate: -1 })).toHaveProperty('error');
  });
  it('rejeita escalões fora de ordem ou sem limite final', () => {
    expect(parsePayrollConfig({ ...valid, irtBrackets: [] })).toHaveProperty('error');
    expect(parsePayrollConfig({ ...valid, irtBrackets: [{ upTo: 200000, rate: 0, deduction: 0 }, { upTo: 100000, rate: 5, deduction: 0 }] })).toHaveProperty('error');
    expect(parsePayrollConfig({ ...valid, irtBrackets: [{ upTo: null, rate: 0, deduction: 0 }, { upTo: 50000, rate: 5, deduction: 0 }] })).toHaveProperty('error');
  });
});

describe('calculateIrt', () => {
  const brackets = [
    { upTo: 100000, rate: 0, deduction: 0 },
    { upTo: 250000, rate: 10, deduction: 0 },
    { upTo: null, rate: 15, deduction: 5000 },
  ];
  it('isento abaixo do primeiro escalão', () => {
    expect(calculateIrt(90000, brackets)).toBe(0);
  });
  it('aplica taxa do escalão', () => {
    expect(calculateIrt(200000, brackets)).toBe(20000);
  });
  it('aplica dedução do escalão superior', () => {
    expect(calculateIrt(300000, brackets)).toBe(40000);
  });
  it('base não positiva dá zero', () => {
    expect(calculateIrt(0, brackets)).toBe(0);
    expect(calculateIrt(-5, brackets)).toBe(0);
  });
});

describe('calculatePayslip', () => {
  const config = {
    inssEmployeeRate: 3, inssEmployerRate: 8, foodAllowance: 10000, transportAllowance: 5000,
    irtBrackets: [{ upTo: null, rate: 10, deduction: 0 }],
  };
  it('soma subsídios ao bruto e desconta INSS/IRT', () => {
    const slip = calculatePayslip({ baseSalary: 350000, config });
    expect(slip.allowances).toBe(15000);
    expect(slip.gross).toBe(365000);
    expect(slip.inss).toBe(10950);
    expect(slip.irt).toBe(35405);
    expect(slip.net).toBe(318645);
  });
  it('arredonda a 2 casas decimais', () => {
    const slip = calculatePayslip({ baseSalary: 1000.555, config });
    expect(slip.baseSalary).toBe(1000.56);
  });
});

describe('lateMinutesFor', () => {
  const shift = { startTime: '08:00', toleranceMinutes: 5 };
  function luanda(y: number, m: number, d: number, hh: number, mm: number) {
    return new Date(Date.UTC(y, m - 1, d, hh - 1, mm)); // Angola = UTC+1
  }
  it('dentro da tolerância dá zero', () => {
    expect(lateMinutesFor(luanda(2026, 3, 2, 8, 5), shift)).toBe(0);
  });
  it('conta atraso além da tolerância', () => {
    expect(lateMinutesFor(luanda(2026, 3, 2, 8, 20), shift)).toBe(15);
  });
  it('entrada antecipada dá zero', () => {
    expect(lateMinutesFor(luanda(2026, 3, 2, 7, 30), shift)).toBe(0);
  });
  it('sem horário dá zero', () => {
    expect(lateMinutesFor(luanda(2026, 3, 2, 9, 0), null)).toBe(0);
  });
});

describe('maskAccount', () => {
  it('mascara mantendo os últimos 3 caracteres', () => {
    expect(maskAccount('0012345678')).toBe('•••••678');
  });
  it('mascara valores curtos e vazios', () => {
    expect(maskAccount('abc')).toBe('••••');
    expect(maskAccount(null)).toBeNull();
    expect(maskAccount('')).toBeNull();
  });
});
