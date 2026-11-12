import 'server-only';

export type PayrollConfig = {
  inssEmployeeRate: number;
  inssEmployerRate: number;
  foodAllowance: number;
  transportAllowance: number;
  irtBrackets: Array<{ upTo: number | null; rate: number; deduction: number }>;
  monthlyHours?: number;
  overtimeRatePercent?: number;
  absenceRatePercent?: number;
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
  const optionalRate = (key: string) => {
    const raw = input[key];
    if (raw === undefined || raw === null || raw === '') return 0;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : Number.NaN;
  };
  const overtimeRatePercent = optionalRate('overtimeRatePercent');
  const absenceRatePercent = optionalRate('absenceRatePercent');
  if (Number.isNaN(overtimeRatePercent) || Number.isNaN(absenceRatePercent)) {
    return { error: 'Taxas de horas extra/falta devem estar entre 0 e 100.' };
  }
  const monthlyHoursRaw = input.monthlyHours;
  const monthlyHours = monthlyHoursRaw === undefined || monthlyHoursRaw === null || monthlyHoursRaw === '' ? 220 : Number(monthlyHoursRaw);
  if (!Number.isFinite(monthlyHours) || monthlyHours <= 0) return { error: 'Horas mensais inválidas.' };
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
  return { config: { inssEmployeeRate, inssEmployerRate, foodAllowance, transportAllowance, irtBrackets: brackets, monthlyHours, overtimeRatePercent, absenceRatePercent } };
}

export function calculateIrt(taxable: number, brackets: PayrollConfig['irtBrackets']): number {
  if (taxable <= 0) return 0;
  const bracket = brackets.find((entry) => entry.upTo === null || taxable <= entry.upTo) ?? brackets[brackets.length - 1];
  if (!bracket) return 0;
  return Math.max(0, round2((taxable * bracket.rate) / 100 - bracket.deduction));
}

export function calculatePayslip(input: { baseSalary: number; config: PayrollConfig; extraDeductions?: number; overtimePay?: number; absenceDeduction?: number; nightAllowance?: number }) {
  const base = round2(Math.max(0, input.baseSalary));
  const allowances = round2(input.config.foodAllowance + input.config.transportAllowance);
  const overtime = round2(Math.max(0, input.overtimePay ?? 0));
  const absences = round2(Math.max(0, input.absenceDeduction ?? 0));
  const gross = round2(base + allowances + overtime);
  const taxableBase = round2(Math.max(0, gross - absences));
  const inss = round2((taxableBase * input.config.inssEmployeeRate) / 100);
  const irt = calculateIrt(round2(taxableBase - inss), input.config.irtBrackets);
  const otherDeductions = round2(Math.max(0, input.extraDeductions ?? 0));
  const nightAllowance = round2(Math.max(0, input.nightAllowance ?? 0));
  const adjustedGross = round2(gross + nightAllowance);
  const taxableBaseNight = round2(Math.max(0, adjustedGross - absences));
  const inssNight = round2((taxableBaseNight * input.config.inssEmployeeRate) / 100);
  const irtNight = calculateIrt(round2(taxableBaseNight - inssNight), input.config.irtBrackets);
  const net = round2(taxableBaseNight - inssNight - irtNight - otherDeductions);
  return { baseSalary: base, allowances, overtime, absences, nightAllowance, gross: adjustedGross, inss: inssNight, irt: irtNight, otherDeductions, net };
}

export type TimeEntryLike = { type: 'ENTRADA' | 'SAIDA_ALMOCO' | 'REGRESSO_ALMOCO' | 'SAIDA'; occurredAt: Date | string };
export type ShiftLike = { startTime: string; endTime: string };

/** Horas trabalhadas num dia: pares ENTRADA→SAIDA_ALMOCO e REGRESSO_ALMOCO→SAIDA. */
export function workedHoursPerDay(entries: TimeEntryLike[]): number {
  const sorted = [...entries].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  let hours = 0;
  let currentStart: Date | null = null;
  for (const entry of sorted) {
    const at = new Date(entry.occurredAt);
    if (entry.type === 'ENTRADA' || entry.type === 'REGRESSO_ALMOCO') {
      currentStart = at;
    } else if (entry.type === 'SAIDA_ALMOCO' || entry.type === 'SAIDA') {
      if (currentStart && at > currentStart) hours += (at.getTime() - currentStart.getTime()) / 3_600_000;
      currentStart = null;
    }
  }
  return round2(hours);
}

/** Horas esperadas por dia a partir do turno (suporta janela nocturna simples). */
export function expectedHoursPerDay(shift: ShiftLike | null): number {
  if (!shift) return 0;
  const [sh, sm] = shift.startTime.split(':').map(Number);
  const [eh, em] = shift.endTime.split(':').map(Number);
  if ([sh, sm, eh, em].some((value) => Number.isNaN(value))) return 0;
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end <= start) end += 24 * 60;
  return round2((end - start) / 60);
}

/** Número de dias úteis no mês de um período AAAA-MM. */
export function businessDaysInMonth(period: string): number {
  const [year, month] = period.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return 0;
  const days = new Date(year, month, 0).getDate();
  let businessDays = 0;
  for (let day = 1; day <= days; day += 1) {
    const weekday = new Date(year, month - 1, day).getDay();
    if (weekday !== 0 && weekday !== 6) businessDays += 1;
  }
  return businessDays;
}

export type TimeAdjustments = { overtimeHours: number; absenceHours: number; overtimePay: number; absenceDeduction: number };

/**
 * Ajustes por tempo: horas extra pagas (sobre a taxa-hora) e desconto por faltas.
 * Tudo configurável; por omissão as taxas são 0 e nada é aplicado.
 */
export function computeTimeAdjustments(input: {
  baseSalary: number;
  entries: TimeEntryLike[];
  shift: ShiftLike | null;
  period: string;
  monthlyHours?: number | null;
  overtimeRatePercent?: number | null;
  absenceRatePercent?: number | null;
}): TimeAdjustments {
  const monthlyHours = Number.isFinite(input.monthlyHours as number) && Number(input.monthlyHours) > 0 ? Number(input.monthlyHours) : 220;
  const overtimeRate = Number.isFinite(input.overtimeRatePercent as number) ? Number(input.overtimeRatePercent) : 0;
  const absenceRate = Number.isFinite(input.absenceRatePercent as number) ? Number(input.absenceRatePercent) : 0;
  const hourlyRate = input.baseSalary / monthlyHours;

  const byDay = new Map<string, TimeEntryLike[]>();
  for (const entry of input.entries) {
    const day = new Date(entry.occurredAt).toLocaleDateString('en-CA', { timeZone: 'Africa/Luanda' });
    const list = byDay.get(day) ?? [];
    list.push(entry);
    byDay.set(day, list);
  }

  let worked = 0;
  for (const list of byDay.values()) worked += workedHoursPerDay(list);

  const expected = expectedHoursPerDay(input.shift) * businessDaysInMonth(input.period);
  const overtimeHours = round2(Math.max(0, worked - expected));
  const absenceHours = round2(Math.max(0, expected - worked));
  return {
    overtimeHours,
    absenceHours,
    overtimePay: round2((overtimeHours * hourlyRate * overtimeRate) / 100),
    absenceDeduction: round2((absenceHours * hourlyRate * absenceRate) / 100),
  };
}
