/**
 * Datas de celebração nacional — art. 3.º da Lei n.º 10/11 (na redacção do art. 3.º da Lei n.º 11/18).
 *
 * Importante: estas datas NÃO suspendem actividade laboral; NÃO contam como feriados; NÃO movem dias úteis.
 * Apenas classificam eventos de cerimónia pública.
 */

import { validateYear, type FixedHoliday } from './holidays';

/** Datas fixas de celebração nacional (8 categorias). */
export const MEMORIAL_DAYS_FIXED: ReadonlyArray<FixedHoliday> = [
  { month: 1,  day: 4,  name: 'Dia dos Mártires da Repressão Colonial', sourceArticle: 'Lei n.º 10/11, art. 3.º, al. a); Lei n.º 11/18, art. 3.º, al. a)' },
  { month: 1,  day: 15, name: 'Dia do Antigo Combatente e Veterano da Pátria', sourceArticle: 'Lei n.º 11/18, art. 3.º, al. b)' },
  { month: 3,  day: 2,  name: 'Dia da Mulher Angolana',                     sourceArticle: 'Lei n.º 10/11, art. 3.º, al. b); Lei n.º 11/18, art. 3.º, al. c)' },
  { month: 3,  day: 15, name: 'Dia da Expansão da Luta Armada de Libertação Nacional', sourceArticle: 'Lei n.º 10/11, art. 3.º, al. c); Lei n.º 11/18, art. 3.º, al. d)' },
  { month: 4,  day: 14, name: 'Dia da Juventude Angolana',                  sourceArticle: 'Lei n.º 10/11, art. 3.º, al. d); Lei n.º 11/18, art. 3.º, al. e)' },
  { month: 5,  day: 25, name: 'Dia de África',                              sourceArticle: 'Lei n.º 10/11, art. 3.º, al. e); Lei n.º 11/18, art. 3.º, al. f)' },
  { month: 6,  day: 1,  name: 'Dia Internacional da Criança',                sourceArticle: 'Lei n.º 10/11, art. 3.º, al. f); Lei n.º 11/18, art. 3.º, al. g)' },
  { month: 12, day: 10, name: 'Dia Internacional dos Direitos Humanos',      sourceArticle: 'Lei n.º 10/11, art. 3.º, al. g); Lei n.º 11/18, art. 3.º, al. h)' },
];

/** Gera entradas do ano para os dias memoráveis (não é feriado; não suspende). */
export function memorialDaysForYear(year: number) {
  validateYear(year);
  return MEMORIAL_DAYS_FIXED.map((entry) => {
    const date = new Date(Date.UTC(year, entry.month - 1, entry.day));
    return {
      id: `memorial-${year}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`,
      date,
      isoDate: isoDateUTC(date),
      name: entry.name,
      scope: 'MEMORIAL_DAY' as const,
      layer: 'NATIONAL' as const,
      source: entry.sourceArticle,
      weekday: date.getUTCDay(),
      isHoliday: false,
      isWorkingDay: true,
    };
  });
}

export function isoDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
