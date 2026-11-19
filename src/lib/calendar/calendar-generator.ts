/**
 * Gerador único do calendário nacional de Angola para um ano.
 *
 * Uniformidade total: o mesmo ano produz sempre a mesma lista de entradas,
 * com a mesma ordem e com o mesmo conteúdo — determinística.
 *
 * Sem acesso a base de dados, sem tenant, sem efeitos secundários.
 */

import { computeCarnivalTuesday, computeGoodFriday } from './easter';
import { FIXED_NATIONAL_HOLIDAYS, validateYear } from './holidays';
import { isoDateUTC, memorialDaysForYear } from './commemorative-dates';
import { bridgesForHolidays } from './bridges';
import type { CalendarEntry } from './calendar-types';

/** Gera o ano completo — feriados nacionais fixos + móveis (Carnaval, Sexta-Feira Santa). */
export function getNationalHolidays(year: number): CalendarEntry[] {
  validateYear(year);

  const fixedEntries: CalendarEntry[] = FIXED_NATIONAL_HOLIDAYS.map((entry) => {
    const date = new Date(Date.UTC(year, entry.month - 1, entry.day));
    return {
      id: `national-holiday-${year}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`,
      date,
      isoDate: isoDateUTC(date),
      name: entry.name,
      scope: 'NATIONAL_HOLIDAY' as const,
      layer: 'NATIONAL' as const,
      source: entry.sourceArticle,
      weekday: date.getUTCDay(),
      isHoliday: true,
      isWorkingDay: false,
    };
  });

  const carnival = computeCarnivalTuesday(year);
  const goodFriday = computeGoodFriday(year);

  const mobileEntries: CalendarEntry[] = [
    {
      id: `national-holiday-${year}-carnival`,
      date: carnival,
      isoDate: isoDateUTC(carnival),
      name: 'Carnaval',
      scope: 'NATIONAL_HOLIDAY' as const,
      layer: 'NATIONAL' as const,
      source: 'Lei n.º 10/11, art. 2.º — data móvel (47 dias antes da Páscoa); Lei n.º 11/18, art. 2.º',
      weekday: carnival.getUTCDay(),
      isHoliday: true,
      isWorkingDay: false,
    },
    {
      id: `national-holiday-${year}-good-friday`,
      date: goodFriday,
      isoDate: isoDateUTC(goodFriday),
      name: 'Sexta-Feira Santa',
      scope: 'NATIONAL_HOLIDAY' as const,
      layer: 'NATIONAL' as const,
      source: 'Lei n.º 10/11, art. 2.º — data móvel (2 dias antes da Páscoa); Lei n.º 11/18, art. 2.º',
      weekday: goodFriday.getUTCDay(),
      isHoliday: true,
      isWorkingDay: false,
    },
  ];

  return [...fixedEntries, ...mobileEntries].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

/** Gera as datas de celebração nacional do ano. Não são feriado; não suspendem actividade. */
export function getMemorialDays(year: number): CalendarEntry[] {
  return memorialDaysForYear(year);
}

/** Gera pontes associadas aos feriados nacionais restituídos por `getNationalHolidays(year)`. */
export function getPontesForYear(year: number): CalendarEntry[] {
  return bridgesForHolidays(getNationalHolidays(year));
}

/** Gera o calendário nacional completo do ano: feriados, comemorativas e pontes. */
export function getFullAngolaCalendar(year: number): CalendarEntry[] {
  const holidays = getNationalHolidays(year);
  const memorial = getMemorialDays(year);
  const pontes = getPontesForYear(year);
  return [...holidays, ...memorial, ...pontes].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

export { isoDateUTC };
