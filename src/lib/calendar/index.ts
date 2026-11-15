/**
 * Módulo `calendar` — export público para o resto do projecto.
 *
 * Escopo autorizado (B1.1):
 *   - Feriados nacionais fixos
 *   - Datas comemorativas
 *   - Carnaval / Sexta-Feira Santa / Páscoa
 *   - Pontes previsto na Lei n.º 11/18
 *   - Geração determinística anual
 *
 * Fora de escopo: feriados locais, tolerâncias, 1h30, turnos, ou qualquer
 * integração com processamento salarial.
 */

export type { CalendarEntry, CalendarScope, CalendarLayer } from './calendar-types';
export { CALENDAR_ENGINE_VERSION } from './calendar-types';

export {
  getNationalHolidays,
  getMemorialDays,
  getPontesForYear,
  getFullAngolaCalendar,
  isoDateUTC,
} from './calendar-generator';

export {
  computeEasterSunday,
  computeGoodFriday,
  computeCarnivalTuesday,
} from './easter';

export { FIXED_NATIONAL_HOLIDAYS } from './holidays';
export { MEMORIAL_DAYS_FIXED } from './commemorative-dates';
