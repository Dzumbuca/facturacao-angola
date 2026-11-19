/**
 * Tipos do módulo `calendar` — Etapa B1.1 (Motor nacional).
 *
 * Escopo autorizado (B1.1):
 *  - Feriados nacionais fixos
 *  - Datas comemorativas
 *  - Carnaval, Sexta-Feira Santa (cálculo determinístico da Páscoa)
 *  - Pontes previstas na Lei n.º 11/18 (art. 6.º)
 *  - Geração determinística anual
 *
 * Fora de escopo (NÃO implementar nesta fase):
 *  - Feriados locais
 *  - Tolerâncias de ponto
 *  - Acréscimo de 1h30 na semana anterior à ponte
 *  - Vésperas de 24/31 dez
 *  - Regimes de turnos / funcionamento contínuo
 *  - Ligação com payroll ou snapshot legal
 */

/** Origem/camada técnica do evento. Representa um agrupamento de regras — não uma camada conceptual. */
export type CalendarScope =
  | 'NATIONAL_HOLIDAY'
  | 'MEMORIAL_DAY'
  | 'PONTE';

/** Categoria legal aplicável ao evento. */
export type CalendarLayer =
  | 'NATIONAL'
  | 'OPERATIONAL';

/**
 * Entrada de calendário — representação imutável de um evento.
 *
 * `date` é guardada como `Date` em UTC. As consultas de apresentação devem
 * usar `Africa/Luanda` para construir a string local.
 */
export type CalendarEntry = {
  /** Identificador estável, único por escopo+data. */
  readonly id: string;
  /** Data UTC (instante independente de fuso). */
  readonly date: Date;
  /** Data ISO 8601, formato `YYYY-MM-DD`. */
  readonly isoDate: string;
  /** Nome canónico do evento. */
  readonly name: string;
  /** Categoria jurídica do evento. */
  readonly scope: CalendarScope;
  /** Camada técnica. */
  readonly layer: CalendarLayer;
  /** Fonte legal / diplomática (Lei + artigo). */
  readonly source: string;
  /** Dia da semana em UTC (`0=Dom` … `6=Sáb`). */
  readonly weekday: number;
  /** Pergunta-resposta para perguntas operacionais imediatas. */
  readonly isHoliday: boolean;
  /** Se `scope === 'NATIONAL_HOLIDAY' || scope === 'PONTE'`, não é dia útil. */
  readonly isWorkingDay: boolean;
  /** Se `scope === 'PONTE'`, data do feriado que justifica a ponte. */
  readonly ponteSourceDate?: string;
  /** Se `scope === 'PONTE'`, nome canónico desse feriado. */
  readonly ponteSourceName?: string;
};

/** Versão do motor de calendário. Incrementada para cada release estrutural. */
export const CALENDAR_ENGINE_VERSION = 'b1.1.0';
