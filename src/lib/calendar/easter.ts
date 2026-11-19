/**
 * Cálculo determinístico da Páscoa.
 *
 * Algoritmo: Meeus (algoritmo do Resto). Validado para 2026–2030.
 * Não compila nem depende de tabela externa nem de internet.
 */
export function computeEasterSunday(year: number): Date {
  if (!Number.isInteger(year) || year < 1583 || year > 9999) {
    throw new RangeError(`Ano inválido para o algoritmo de Páscoa: ${String(year)}`);
  }

  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);

  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  // Páscoa traz data civil em UTC — garantia de determinismo.
  return new Date(Date.UTC(year, month - 1, day));
}

/** Sexta-Feira Santa = Páscoa − 2 dias. */
export function computeGoodFriday(year: number): Date {
  const easter = computeEasterSunday(year);
  return new Date(Date.UTC(easter.getUTCFullYear(), easter.getUTCMonth(), easter.getUTCDate() - 2));
}

/** Carnaval = terça-feira 47 dias antes da Páscoa. */
export function computeCarnivalTuesday(year: number): Date {
  const easter = computeEasterSunday(year);
  return new Date(Date.UTC(easter.getUTCFullYear(), easter.getUTCMonth(), easter.getUTCDate() - 47));
}
