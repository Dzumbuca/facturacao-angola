import 'server-only';

export type PayrollConfig = {
  inssEmployeeRate: number;
  inssEmployerRate: number;
  foodAllowance: number;
  transportAllowance: number;
  irtBrackets: Array<{ upTo: number | null; rate: number; deduction: number }>;
};

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function parsePayrollConfig(raw: unknown): { config: PayrollConfig } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Configuração salarial inválida.' };
  const input = raw as Record<string, unknown>;
  const num = (key: string) => Number(input[key]);
  const inssEmployeeRate = num('inssEmployeeRate');
  const inssEmployerRate = num('inssEmployerRate');
  const foodAllowance = num('foodAllowance');
  const transportAllowance = num('transportAllowance');
  if (![inssEmployeeRate, inssEmployerRate].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
    return { error: 'Taxas de INSS devem estar entre 0 e 100.' };
  }
  if (![foodAllowance, transportAllowance].every((value) => Number.isFinite(value) && value >= 0)) {
    return { error: 'Subsídios inválidos.' };
  }
  if (!Array.isArray(input.irtBrackets) || input.irtBrackets.length === 0) {
    return { error: 'É necessário configurar pelo menos um escalão de IRT.' };
  }
  const brackets: PayrollConfig['irtBrackets'] = [];
  let previous = 0;
  for (const [index, rawBracket] of input.irtBrackets.entries()) {
    const bracket = rawBracket as Record<string, unknown>;
    const upToRaw = bracket.upTo;
    const upTo = upToRaw === null || upToRaw === '' ? null : Number(upToRaw);
    const rate = Number(bracket.rate);
    const deduction = Number(bracket.deduction ?? 0);
    if (upTo !== null && (!Number.isFinite(upTo) || upTo <= previous)) return { error: `Escalão IRT ${index + 1}: limite inválido ou fora de ordem.` };
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return { error: `Escalão IRT ${index + 1}: taxa inválida.` };
    if (!Number.isFinite(deduction) || deduction < 0) return { error: `Escalão IRT ${index + 1}: dedução inválida.` };
    if (upTo === null && index !== input.irtBrackets.length - 1) return { error: 'O escalão sem limite deve ser o último.' };
    brackets.push({ upTo, rate, deduction });
    previous = upTo ?? previous;
  }
  return { config: { inssEmployeeRate, inssEmployerRate, foodAllowance, transportAllowance, irtBrackets: brackets } };
}

export function calculateIrt(taxable: number, brackets: PayrollConfig['irtBrackets']): number {
  if (taxable <= 0) return 0;
  const bracket = brackets.find((entry) => entry.upTo === null || taxable <= entry.upTo) ?? brackets[brackets.length - 1];
  if (!bracket) return 0;
  return Math.max(0, round2((taxable * bracket.rate) / 100 - bracket.deduction));
}

export function calculatePayslip(input: { baseSalary: number; config: PayrollConfig; extraDeductions?: number }) {
  const base = round2(Math.max(0, input.baseSalary));
  const allowances = round2(input.config.foodAllowance + input.config.transportAllowance);
  const gross = round2(base + allowances);
  const inss = round2((gross * input.config.inssEmployeeRate) / 100);
  const irt = calculateIrt(round2(gross - inss), input.config.irtBrackets);
  const otherDeductions = round2(Math.max(0, input.extraDeductions ?? 0));
  const net = round2(gross - inss - irt - otherDeductions);
  return { baseSalary: base, allowances, gross, inss, irt, otherDeductions, net };
}
