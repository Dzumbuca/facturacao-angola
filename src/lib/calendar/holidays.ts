/**
 * Feriados nacionais fixos de Angola.
 *
 * Base legal: Lei n.º 10/11, de 16 de Fevereiro (Lei dos Feriados Nacionais e Locais e Datas de Celebração Nacional),
 * na redacção da Lei n.º 11/18, de 28 de Setembro (alteração do artigo 2.º e introdução do "Dia da Libertação da África Austral").
 */

export type FixedHoliday = {
  month: number; // 1-12
  day: number;
  name: string;
  sourceArticle: string; // Lei 10/11, art. 2.º, al. …
};

export const FIXED_NATIONAL_HOLIDAYS: ReadonlyArray<FixedHoliday> = [
  { month: 1,  day: 1,  name: 'Ano Novo',                          sourceArticle: 'Lei n.º 10/11, art. 2.º, al. a); Lei n.º 11/18' },
  { month: 2,  day: 4,  name: 'Luta Armada de Libertação Nacional', sourceArticle: 'Lei n.º 10/11, art. 2.º, al. b); Lei n.º 11/18' },
  { month: 3,  day: 8,  name: 'Dia Internacional da Mulher',         sourceArticle: 'Lei n.º 10/11, art. 2.º, al. c); Lei n.º 11/18' },
  { month: 3,  day: 23, name: 'Dia da Libertação da África Austral', sourceArticle: 'Lei n.º 11/18, art. 2.º, al. d)' },
  { month: 4,  day: 4,  name: 'Dia da Paz e da Reconciliação Nacional', sourceArticle: 'Lei n.º 10/11, art. 2.º, al. e); Lei n.º 11/18' },
  { month: 5,  day: 1,  name: 'Dia Internacional do Trabalhador',     sourceArticle: 'Lei n.º 10/11, art. 2.º, al. f); Lei n.º 11/18' },
  { month: 9,  day: 17, name: 'Dia do Fundador da Nação e do Herói Nacional', sourceArticle: 'Lei n.º 10/11, art. 2.º, al. g); Lei n.º 11/18' },
  { month: 11, day: 2,  name: 'Dia dos Finados',                     sourceArticle: 'Lei n.º 10/11, art. 2.º, al. h); Lei n.º 11/18' },
  { month: 11, day: 11, name: 'Dia da Independência',                sourceArticle: 'Lei n.º 10/11, art. 2.º, al. i); Lei n.º 11/18' },
  { month: 12, day: 25, name: 'Dia de Natal e da Família',           sourceArticle: 'Lei n.º 10/11, art. 2.º, al. j); Lei n.º 11/18' },
];

export function validateYear(year: number): void {
  if (!Number.isInteger(year) || year < 1583 || year > 9999) {
    throw new RangeError(`Ano inválido: ${String(year)}`);
  }
}
