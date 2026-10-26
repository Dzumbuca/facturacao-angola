// Cálculos e utilitários partilhados pelas ferramentas públicas (/ferramentas/*).
// Funções puras, sem dependências de React ou base de dados — fáceis de testar
// e reutilizáveis tanto no servidor (páginas) como no cliente (calculadoras).

export type ModoIva = 'acrescentar' | 'retirar';

export type IvaTaxa = { valor: number; etiqueta: string };

// Taxas de IVA em vigor em Angola, tal como na calculadora de IVA existente.
export const IVA_TAXAS: IvaTaxa[] = [
  { valor: 14, etiqueta: '14% — taxa geral (Angola)' },
  { valor: 7, etiqueta: '7% — taxa reduzida' },
  { valor: 2, etiqueta: '2% — taxa especial' },
  { valor: 0, etiqueta: '0% — isento' },
];

/**
 * Lê um valor monetário escrito em formato português ou inglês.
 * Aceita "1234,56", "1234.56", "1.234,56", "100.000" e "1 000".
 * Devolve NaN para texto vazio ou inválido (o componente decide o estado).
 */
export function parseValor(input: string): number {
  const limpo = input.trim().replace(/\s/g, '');
  if (limpo === '') return Number.NaN;
  let normalizado = limpo;
  if (limpo.includes(',') && limpo.includes('.')) {
    // Ambos os separadores: o ponto é de milhares, a vírgula é decimal (pt-AO).
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else if (limpo.includes(',')) {
    normalizado = limpo.replace(',', '.');
  } else if (/\.\d{3}(?:\.\d{3})*$/.test(limpo)) {
    // Apenas pontos e grupos exactos de 3 dígitos: milhares ("100.000").
    normalizado = limpo.replace(/\./g, '');
  }
  if (!/^-?\d*\.?\d*$/.test(normalizado) || normalizado === '' || normalizado === '-') {
    return Number.NaN;
  }
  return Number(normalizado);
}

export type LucroEntrada = {
  custoAquisicao: number;
  outrosCustos: number;
  precoVenda: number;
  quantidade: number;
};

export type LucroResultado = {
  custoTotalUnitario: number;
  lucroUnitario: number;
  /** Percentagem sobre o preço de venda; null quando o preço é zero ou negativo. */
  margemPercent: number | null;
  /** Percentagem sobre o custo total; null quando o custo total é zero. */
  markupPercent: number | null;
  /** Lucro unitário × quantidade; null quando a quantidade é zero ou negativa. */
  lucroTotal: number | null;
  prejuizo: boolean;
};

export function calcularLucro(entrada: LucroEntrada): LucroResultado {
  const custoTotalUnitario = entrada.custoAquisicao + entrada.outrosCustos;
  const lucroUnitario = entrada.precoVenda - custoTotalUnitario;
  const margemPercent = entrada.precoVenda > 0 ? (lucroUnitario / entrada.precoVenda) * 100 : null;
  const markupPercent = custoTotalUnitario > 0 ? (lucroUnitario / custoTotalUnitario) * 100 : null;
  const lucroTotal = entrada.quantidade > 0 ? lucroUnitario * entrada.quantidade : null;
  return {
    custoTotalUnitario,
    lucroUnitario,
    margemPercent,
    markupPercent,
    lucroTotal,
    prejuizo: lucroUnitario < 0,
  };
}

export type PrecoVendaEntrada = {
  custoAquisicao: number;
  outrosCustos: number;
  margemPretendida: number;
  quantidade: number;
  /** Incremento comercial em Kz (ex.: 25 arredonda 1.428 Kz para 1.450 Kz). Opcional. */
  arredondamento?: number;
};

export type PrecoVendaResultado = {
  custoTotalUnitario: number;
  /** Preço = custoTotal / (1 - margem/100); null para margem fora de [0, 100). */
  precoRecomendado: number | null;
  lucroUnitario: number | null;
  lucroTotal: number | null;
  /** Preço depois do arredondamento comercial; igual ao recomendado quando não há arredondamento. */
  precoAjustado: number | null;
  /** Margem real obtida com o preço ajustado; null sem preço válido. */
  margemEfetivaPercent: number | null;
};

export function calcularPrecoVenda(entrada: PrecoVendaEntrada): PrecoVendaResultado {
  const custoTotalUnitario = entrada.custoAquisicao + entrada.outrosCustos;
  const margemValida = entrada.margemPretendida >= 0 && entrada.margemPretendida < 100;
  const precoRecomendado = margemValida ? custoTotalUnitario / (1 - entrada.margemPretendida / 100) : null;
  const precoAjustado = precoRecomendado !== null && (entrada.arredondamento ?? 0) > 0
    ? arredondarParaCima(precoRecomendado, entrada.arredondamento as number)
    : precoRecomendado;
  const lucroUnitario = precoAjustado !== null ? precoAjustado - custoTotalUnitario : null;
  const lucroTotal =
    lucroUnitario !== null && entrada.quantidade > 0 ? lucroUnitario * entrada.quantidade : null;
  const margemEfetivaPercent =
    precoAjustado !== null && precoAjustado > 0 ? ((precoAjustado - custoTotalUnitario) / precoAjustado) * 100 : null;
  return {
    custoTotalUnitario,
    precoRecomendado,
    lucroUnitario,
    lucroTotal,
    precoAjustado,
    margemEfetivaPercent,
  };
}

/** Arredonda o preço SEMPRE PARA CIMA até ao múltiplo do incremento comercial. */
export function arredondarParaCima(valor: number, incremento: number): number {
  if (!Number.isFinite(valor) || !Number.isFinite(incremento) || incremento <= 0) return valor;
  return Math.ceil(valor / incremento - 1e-9) * incremento;
}

export type IvaResultado = { valorSemIva: number; iva: number; totalComIva: number };

export function converterIva(valor: number, taxaPercent: number, modo: ModoIva): IvaResultado {
  if (modo === 'acrescentar') {
    const iva = valor * (taxaPercent / 100);
    return { valorSemIva: valor, iva, totalComIva: valor + iva };
  }
  const valorSemIva = valor / (1 + taxaPercent / 100);
  return { valorSemIva, iva: valor - valorSemIva, totalComIva: valor };
}

/** Formata valores em kwanzas com o padrão pt-AO usado em toda a aplicação. */
export function formatKz(valor: number): string {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(
    Number.isFinite(valor) ? valor : 0,
  );
}

/** Formata percentagens com vírgula decimal; traço quando o valor é null. */
export function formatPercent(valor: number | null, casasDecimais = 1): string {
  if (valor === null || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat('pt-AO', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: casasDecimais,
  }).format(valor / 100);
}

export type FerramentaEstado = 'ativa' | 'em-breve';

export type FerramentaCategoria = 'Fiscalidade' | 'Gestão Financeira' | 'Documentos Empresariais';

export type FerramentaResumo = {
  id: string;
  nome: string;
  descricao: string;
  categoria: FerramentaCategoria;
  /** Rota da ferramenta; null quando ainda não está disponível ("Em breve"). */
  href: string | null;
  estado: FerramentaEstado;
  /** Identificador do ícone desenhado no cartão (ver tools-icon.tsx). */
  icone: string;
};

export const CATEGORIAS_FERRAMENTAS: FerramentaCategoria[] = [
  'Fiscalidade',
  'Gestão Financeira',
  'Documentos Empresariais',
];

/** Remove acentos e normaliza para comparação de pesquisa ("salário" === "salario"). */
function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Pesquisa por nome ou descrição (sem acentos, insensível a maiúsculas)
 * combinada com o filtro de categoria ('Todas' devolve todas).
 */
export function filtrarFerramentas(
  ferramentas: FerramentaResumo[],
  pesquisa: string,
  categoria: FerramentaCategoria | 'Todas',
): FerramentaResumo[] {
  const termo = normalizar(pesquisa.trim());
  return ferramentas.filter((ferramenta) => {
    if (categoria !== 'Todas' && ferramenta.categoria !== categoria) return false;
    if (termo === '') return true;
    const alvo = normalizar(`${ferramenta.nome} ${ferramenta.descricao}`);
    return alvo.includes(termo);
  });
}
