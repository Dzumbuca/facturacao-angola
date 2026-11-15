import { describe, expect, it } from 'vitest';
import {
  CALENDAR_ENGINE_VERSION,
  computeCarnivalTuesday,
  computeEasterSunday,
  computeGoodFriday,
  getFullAngolaCalendar,
  getMemorialDays,
  getNationalHolidays,
  getPontesForYear,
  isoDateUTC,
  CALENDAR_ENGINE_VERSION as CAL_VER,
} from './index';

function fmt(date: Date): string {
  return isoDateUTC(date);
}

/**
 * Determinismo absoluto: mesma entrada ⇒ mesma saída.
 */
describe('determinismo do motor nacional', () => {
  it('CALENDAR_ENGINE_VERSION é estável e imutável', () => {
    expect(CALENDAR_ENGINE_VERSION).toBe('b1.1.0');
    expect(CAL_VER).toBe('b1.1.0');
  });

  it('getNationalHolidays produz sempre a mesma lista para o mesmo ano', () => {
    const a = getNationalHolidays(2026);
    const b = getNationalHolidays(2026);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i].isoDate).toBe(b[i].isoDate);
      expect(a[i].id).toBe(b[i].id);
      expect(a[i].name).toBe(b[i].name);
    }
  });

  it('getFullAngolaCalendar produz sempre a mesma lista para o mesmo ano', () => {
    const a = getFullAngolaCalendar(2026);
    const b = getFullAngolaCalendar(2026);
    expect(a.length).toBe(b.length);
    for (let i = 0; i < a.length; i += 1) {
      expect(a[i].isoDate).toBe(b[i].isoDate);
      expect(a[i].id).toBe(b[i].id);
    }
  });
});

describe('Páscoa — algoritmo de Meeus', () => {
  const easterByYear: Record<number, string> = {
    2026: '2026-04-05',
    2027: '2027-03-28',
    2028: '2028-04-16',
    2029: '2029-04-01',
    2030: '2030-04-21',
  };

  for (const [y, expected] of Object.entries(easterByYear)) {
    it(`Páscoa ${y} = ${expected}`, () => {
      expect(fmt(computeEasterSunday(Number(y)))).toBe(expected);
    });
  }

  it('Sexta-feira Santa é 2 dias antes da Páscoa', () => {
    expect(fmt(computeGoodFriday(2026))).toBe('2026-04-03');
    expect(fmt(computeGoodFriday(2027))).toBe('2027-03-26');
    expect(fmt(computeGoodFriday(2028))).toBe('2028-04-14');
    expect(fmt(computeGoodFriday(2029))).toBe('2029-03-30');
    expect(fmt(computeGoodFriday(2030))).toBe('2030-04-19');
  });

  it('Carnaval é terça-feira 47 dias antes da Páscoa', () => {
    expect(fmt(computeCarnivalTuesday(2026))).toBe('2026-02-17');
    expect(fmt(computeCarnivalTuesday(2027))).toBe('2027-02-09');
    expect(fmt(computeCarnivalTuesday(2028))).toBe('2028-02-29');
    expect(fmt(computeCarnivalTuesday(2029))).toBe('2029-02-13');
    expect(fmt(computeCarnivalTuesday(2030))).toBe('2030-03-05');
  });

  it('Carnaval sempre cai terça-feira', () => {
    for (let y = 2026; y <= 2030; y += 1) {
      expect(computeCarnivalTuesday(y).getUTCDay()).toBe(2); // 2 = Dienstag
    }
  });

  it('Sexta-feira Santa sempre cai sexta-feira', () => {
    for (let y = 2026; y <= 2030; y += 1) {
      expect(computeGoodFriday(y).getUTCDay()).toBe(5);
    }
  });

  it('Páscoa sempre cai domingo', () => {
    for (let y = 2026; y <= 2030; y += 1) {
      expect(computeEasterSunday(y).getUTCDay()).toBe(0);
    }
  });

  it('Rejeita anos fora do intervalo', () => {
    expect(() => computeEasterSunday(1000)).toThrow(/Ano inválido/);
    expect(() => computeEasterSunday(10000)).toThrow(/Ano inválido/);
  });
});

describe('Feriados nacionais fixos', () => {
  const FIXED: Record<string, string> = {
    '2026-01-01': 'Ano Novo',
    '2026-02-04': 'Luta Armada de Libertação Nacional',
    '2026-03-08': 'Dia Internacional da Mulher',
    '2026-03-23': 'Dia da Libertação da África Austral',
    '2026-04-04': 'Dia da Paz e da Reconciliação Nacional',
    '2026-05-01': 'Dia Internacional do Trabalhador',
    '2026-09-17': 'Dia do Fundador da Nação e do Herói Nacional',
    '2026-11-02': 'Dia dos Finados',
    '2026-11-11': 'Dia da Independência',
    '2026-12-25': 'Dia de Natal e da Família',
  };

  for (const [iso, name] of Object.entries(FIXED)) {
    it(`${iso} = ${name}`, () => {
      const [y] = iso.split('-');
      const list = getNationalHolidays(Number(y));
      const found = list.find((h) => h.isoDate === iso);
      expect(found).toBeDefined();
      expect(found?.name).toBe(name);
      expect(found?.scope).toBe('NATIONAL_HOLIDAY');
      expect(found?.isHoliday).toBe(true);
      expect(found?.isWorkingDay).toBe(false);
    });
  }

  it('Total de feriados fixos 2026 = 10', () => {
    expect(getNationalHolidays(2026).filter((h) => !h.id.startsWith('national-holiday-2026-carnival') && !h.id.startsWith('national-holiday-2026-good-friday')).length).toBe(10);
  });

  it('Inclui os móveis Carnaval e Sexta-feira Santa', () => {
    const list = getNationalHolidays(2026);
    const carnival = list.find((h) => h.isoDate === '2026-02-17');
    const goodFriday = list.find((h) => h.isoDate === '2026-04-03');
    expect(carnival?.name).toBe('Carnaval');
    expect(goodFriday?.name).toBe('Sexta-Feira Santa');
  });
});

describe('Datas comemorativas', () => {
  it('Total 2026 = 8', () => {
    expect(getMemorialDays(2026).length).toBe(8);
  });

  it('Indica que dia não é feriado nem suspensão', () => {
    const mem = getMemorialDays(2026);
    for (const m of mem) {
      expect(m.isHoliday).toBe(false);
      expect(m.isWorkingDay).toBe(true);
      expect(m.scope).toBe('MEMORIAL_DAY');
    }
  });

  it('15 de Janeiro 2026 é data de celebração nacional (Lei n.º 11/18)', () => {
    const mem = getMemorialDays(2026);
    const found = mem.find((m) => m.isoDate === '2026-01-15');
    expect(found?.name).toBe('Dia do Antigo Combatente e Veterano da Pátria');
  });

  it('4 de Abril (Paz) está nos feriados e não nas comemorativas', () => {
    const mem = getMemorialDays(2026);
    const list = getNationalHolidays(2026);
    expect(list.find((h) => h.isoDate === '2026-04-04' && h.name.includes('Paz'))).toBeDefined();
    expect(mem.find((m) => m.isoDate === '2026-04-04')).toBeUndefined();
  });
});

describe('Pontes — Lei n.º 11/18, art. 6.º', () => {
  it('2026-01-02 é ponte (Ano Novo à quinta → ponte na sexta)', () => {
    const pontes = getPontesForYear(2026);
    const found = pontes.find((p) => p.isoDate === '2026-01-02');
    expect(found).toBeDefined();
    expect(found?.scope).toBe('PONTE');
    expect(found?.ponteSourceDate).toBe('2026-01-01');
  });

  it('2026-02-16 é ponte (17 Fev, Carnaval, à terça)', () => {
    const pontes = getPontesForYear(2026);
    const found = pontes.find((p) => p.isoDate === '2026-02-16');
    expect(found).toBeDefined();
    expect(found?.ponteSourceName).toBe('Carnaval');
  });

  it('2026-09-18 é ponte (17 Set, Herói Nacional, à quinta)', () => {
    const pontes = getPontesForYear(2026);
    const found = pontes.find((p) => p.isoDate === '2026-09-18');
    expect(found).toBeDefined();
    expect(found?.ponteSourceDate).toBe('2026-09-17');
  });

  it('2026 tem exactamente 3 pontes', () => {
    expect(getPontesForYear(2026).length).toBe(3);
  });

  it('Pontes não overlapcom nenhum feriado nacional', () => {
    const holidays = getNationalHolidays(2026).map((h) => h.isoDate);
    const pontes = getPontesForYear(2026).map((p) => p.isoDate);
    for (const p of pontes) {
      expect(holidays).not.toContain(p);
    }
  });

  it('2026-03-23 (segunda) não gera ponte', () => {
    const pontes = getPontesForYear(2026);
    expect(pontes.find((p) => p.isoDate === '2026-03-23')).toBeUndefined();
    expect(pontes.find((p) => p.isoDate === '2026-03-22')).toBeUndefined();
    expect(pontes.find((p) => p.isoDate === '2026-03-24')).toBeUndefined();
  });

  it('2026-12-25 (sexta) não gera ponte', () => {
    const pontes = getPontesForYear(2026);
    expect(pontes.find((p) => p.isoDate === '2026-12-25')).toBeUndefined();
    expect(pontes.find((p) => p.isoDate === '2026-12-26')).toBeUndefined();
  });

  it('2026-04-03 (sexta) não gera ponte', () => {
    const pontes = getPontesForYear(2026);
    expect(pontes.find((p) => p.isoDate === '2026-04-03')).toBeUndefined();
    expect(pontes.find((p) => p.isoDate === '2026-04-04')).toBeUndefined();
  });
});

describe('Geração de ano completo', () => {
  for (const y of [2026, 2027, 2028, 2029, 2030]) {
    it(`${y}: sem duplicações e ordenado cronologicamente`, () => {
      const all = getFullAngolaCalendar(y);
      const ids = all.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      const times = all.map((e) => e.date.getTime());
      for (let i = 1; i < times.length; i += 1) {
        expect(times[i - 1]).toBeLessThanOrEqual(times[i]);
      }
    });
  }

  it('2026: feriados nacionais = 12; comemorativas = 8; pontes = 3', () => {
    const all = getFullAngolaCalendar(2026);
    expect(all.filter((e) => e.scope === 'NATIONAL_HOLIDAY').length).toBe(12);
    expect(all.filter((e) => e.scope === 'MEMORIAL_DAY').length).toBe(8);
    expect(all.filter((e) => e.scope === 'PONTE').length).toBe(3);
  });

  it('2026: lista tem 23 entradas', () => {
    expect(getFullAngolaCalendar(2026).length).toBe(23);
  });

  it('2027: feriados fixos = 10; Carnaval = 2027-02-09; Sexta-Feira Santa = 2027-03-26', () => {
    const holidays = getNationalHolidays(2027);
    expect(holidays.filter((h) => h.scope === 'NATIONAL_HOLIDAY').length).toBe(12);
    expect(holidays.find((h) => h.isoDate === '2027-02-09')?.name).toBe('Carnaval');
    expect(holidays.find((h) => h.isoDate === '2027-03-26')?.name).toBe('Sexta-Feira Santa');
  });

  it('2028: ano bissexto, Carnaval = 2028-02-29', () => {
    const holidays = getNationalHolidays(2028);
    expect(holidays.find((h) => h.isoDate === '2028-02-29')?.name).toBe('Carnaval');
  });
});

describe('Dias úteis em 2026 (cross-check com B1 da especificação)', () => {
  // B1 v0.5 §5.1: Janeiro=20, Fevereiro=17, Março=21, Abril=21, Maio=20,
  // Junho=21, Julho=23, Agosto=21, Setembro=20, Outubro=22, Novembro=19, Dezembro=22
  const expected: Record<string, number> = {
    '2026-01': 20,
    '2026-02': 17,
    '2026-03': 21,
    '2026-04': 21,
    '2026-05': 20,
    '2026-06': 22,
    '2026-07': 23,
    '2026-08': 21,
    '2026-09': 20,
    '2026-10': 22,
    '2026-11': 19,
    '2026-12': 22,
  };

  function workingDays(period: string, entries: { isoDate: string; isWorkingDay: boolean }[]): number {
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let days = 0;
    for (let d = 1; d <= lastDay; d += 1) {
      const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      const hit = entries.find((e) => e.isoDate === iso);
      if (hit && hit.isWorkingDay === false) continue;
      days += 1;
    }
    return days;
  }

  for (const [period, expectedDays] of Object.entries(expected)) {
    it(`${period}: ${expectedDays} dias úteis`, () => {
      const calendar = getFullAngolaCalendar(2026);
      const result = workingDays(period, calendar);
      expect(result).toBe(expectedDays);
    });
  }
});
