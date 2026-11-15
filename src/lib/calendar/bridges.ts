/**
 * Pontes previstas na Lei n.º 11/18, de 28 de Setembro, artigo 6.º.
 * (Alteração à Lei n.º 10/11, de 16 de Fevereiro, artigo 6.º.)
 *
 * Redacção da Lei n.º 11/18:
 *   "1. Quando o dia de feriado nacional coincidir com o dia de Terça ou Quinta-feira,
 *    há lugar à suspensão da actividade laboral no dia útil anterior ou no dia imediatamente
 *    a seguir, respectivamente, Segunda ou Sexta-feira.
 *    2. A suspensão da actividade laboral nos dias referidos no número anterior dá lugar a denominada «Ponte».
 *    3. Na semana que anteceder a ponte é acrescida uma hora e meia diária no período normal de trabalho."
 *
 * Âmbito B1.1 (NÃO implementar):
 *  - acréscimo de 1h30 diária na semana anterior à ponte (interpretação pendente);
 *  - aplicação de ponte a trabalhadores em turnos contínuos ou funcionamento contínuo;
 *  - feriados locais e tolerâncias de ponto.
 *
 * O que B1.1 faz:
 *  - detectar feriado nacional à terça ou quinta-feira;
 *  - gerar a entrada `PONTE` para o dia útil anterior (segunda) ou seguinte (sexta);
 *  - não alterar o número de trabalhadores nem o horário efectivo.
 */

import { isoDateUTC } from './commemorative-dates';
import type { CalendarEntry } from './calendar-types';

const WEEKDAY_MON = 1;
const WEEKDAY_THU = 4;
const WEEKDAY_TUE = 2;
const WEEKDAY_FRI = 5;

export type NationalHolidayInput = {
  date: Date;
  isoDate: string;
  name: string;
};

/** Gera entradas de ponte para feriados nacionais que ocorram à terça ou quinta-feira. */
export function bridgesForHolidays(holidays: NationalHolidayInput[]): CalendarEntry[] {
  const bridges: CalendarEntry[] = [];

  for (const holiday of holidays) {
    const w = holiday.date.getUTCDay();
    if (w === WEEKDAY_TUE) {
      const bridgeDate = new Date(Date.UTC(
        holiday.date.getUTCFullYear(),
        holiday.date.getUTCMonth(),
        holiday.date.getUTCDate() - 1,
      ));
      if (bridgeDate.getUTCDay() === WEEKDAY_MON) {
        bridges.push({
          id: `ponte-${isoDateUTC(bridgeDate)}`,
          date: bridgeDate,
          isoDate: isoDateUTC(bridgeDate),
          name: `Ponte (${holiday.name})`,
          scope: 'PONTE',
          layer: 'OPERATIONAL',
          source: `Lei n.º 11/18, art. 6.º n.º 1`,
          weekday: WEEKDAY_MON,
          isHoliday: true,
          isWorkingDay: false,
          ponteSourceDate: holiday.isoDate,
          ponteSourceName: holiday.name,
        });
      }
    } else if (w === WEEKDAY_THU) {
      const bridgeDate = new Date(Date.UTC(
        holiday.date.getUTCFullYear(),
        holiday.date.getUTCMonth(),
        holiday.date.getUTCDate() + 1,
      ));
      if (bridgeDate.getUTCDay() === WEEKDAY_FRI) {
        bridges.push({
          id: `ponte-${isoDateUTC(bridgeDate)}`,
          date: bridgeDate,
          isoDate: isoDateUTC(bridgeDate),
          name: `Ponte (${holiday.name})`,
          scope: 'PONTE',
          layer: 'OPERATIONAL',
          source: `Lei n.º 11/18, art. 6.º n.º 1`,
          weekday: WEEKDAY_FRI,
          isHoliday: true,
          isWorkingDay: false,
          ponteSourceDate: holiday.isoDate,
          ponteSourceName: holiday.name,
        });
      }
    }
  }

  return bridges.sort((a, b) => a.date.getTime() - b.date.getTime());
}
