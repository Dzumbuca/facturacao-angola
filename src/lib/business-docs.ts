// Documentos empresariais gerados pelas ferramentas públicas (/ferramentas/*).
// Validação rigorosa do payload (endpoint público, sem base de dados) e
// cálculos puros partilhados entre o cliente (pré-visualização) e o servidor (PDF).

export type TipoDocumento = 'orcamento' | 'proforma' | 'recibo' | 'despesas';

export type DocEmpresa = { nome: string; nif?: string; contacto?: string };

export type DocItem = { descricao: string; quantidade: number; preco: number };

export type DocumentoItens = {
  tipo: 'orcamento' | 'proforma';
  empresa: DocEmpresa;
  cliente: DocEmpresa;
  numero?: string;
  data?: string;
  validadeDias?: number;
  notas?: string;
  itens: DocItem[];
  ivaPercent?: number;
};

export type DocumentoRecibo = {
  tipo: 'recibo';
  empresa: DocEmpresa;
  cliente: DocEmpresa;
  numero?: string;
  data?: string;
  metodo: string;
  valor: number;
  descricao?: string;
};

export type DespesaLinha = { data: string; descricao: string; categoria: string; valor: number };

export type DocumentoDespesas = {
  tipo: 'despesas';
  empresa: DocEmpresa;
  periodoDe: string;
  periodoAte: string;
  linhas: DespesaLinha[];
};

export type DocumentoPayload = DocumentoItens | DocumentoRecibo | DocumentoDespesas;

export type ResultadoValidacao<T> = { ok: true; documento: T } | { ok: false; erro: string };

const LIMITE_ITENS = 60;
const LIMITE_LINHAS_DESPESAS = 120;
const VALOR_MAXIMO = 1e9;

/** Remove caracteres de controlo, colapsa espaços e limita o comprimento. */
function texto(valor: unknown, maximo: number): string {
  if (typeof valor !== 'string') return '';
  return valor
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo);
}

function numeroFinito(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

function validarEmpresa(bruto: unknown, rotulo: string): ResultadoValidacao<DocEmpresa> {
  if (typeof bruto !== 'object' || bruto === null) return { ok: false, erro: `${rotulo}: dados ausentes.` };
  const e = bruto as Record<string, unknown>;
  const nome = texto(e.nome, 120);
  if (!nome) return { ok: false, erro: `${rotulo}: indique o nome.` };
  return { ok: true, documento: { nome, nif: texto(e.nif, 40) || undefined, contacto: texto(e.contacto, 80) || undefined } };
}

function validarDataOpcional(valor: unknown, rotulo: string): ResultadoValidacao<string | undefined> {
  if (valor === undefined || valor === null || valor === '') return { ok: true, documento: undefined };
  const data = texto(valor, 10);
  const instante = DATA_RE.test(data) ? new Date(`${data}T00:00:00.000Z`) : null;
  const dataNormalizada = instante && Number.isFinite(instante.getTime())
    ? instante.toISOString().slice(0, 10)
    : '';
  if (dataNormalizada !== data) return { ok: false, erro: `${rotulo}: indique uma data real no formato AAAA-MM-DD.` };
  return { ok: true, documento: data };
}

function validarItens(bruto: unknown): ResultadoValidacao<DocItem[]> {
  if (!Array.isArray(bruto) || bruto.length === 0) {
    return { ok: false, erro: 'Adicione pelo menos um item ao documento.' };
  }
  if (bruto.length > LIMITE_ITENS) {
    return { ok: false, erro: `Máximo de 60 itens por documento.` };
  }
  const itens: DocItem[] = [];
  for (const brutoItem of bruto) {
    if (typeof brutoItem !== 'object' || brutoItem === null) {
      return { ok: false, erro: 'Item inválido no documento.' };
    }
    const item = brutoItem as Record<string, unknown>;
    const descricao = texto(item.descricao, 200);
    if (!descricao) return { ok: false, erro: 'Cada item precisa de uma descrição.' };
    const quantidade = numeroFinito(item.quantidade);
    if (quantidade === null || quantidade <= 0 || quantidade > VALOR_MAXIMO) {
      return { ok: false, erro: `Quantidade inválida em «${descricao}».` };
    }
    const preco = numeroFinito(item.preco);
    if (preco === null || preco < 0 || preco > VALOR_MAXIMO) {
      return { ok: false, erro: `Preço inválido em «${descricao}».` };
    }
    itens.push({ descricao, quantidade, preco });
  }
  return { ok: true, documento: itens };
}

function validarDocumentoItens(bruto: Record<string, unknown>): ResultadoValidacao<DocumentoItens> {
  const empresa = validarEmpresa(bruto.empresa, 'A empresa');
  if (!empresa.ok) return empresa;
  const cliente = validarEmpresa(bruto.cliente, 'O cliente');
  if (!cliente.ok) return cliente;
  const itens = validarItens(bruto.itens);
  if (!itens.ok) return itens;

  const data = validarDataOpcional(bruto.data, 'A data');
  if (!data.ok) return data;

  let validadeDias: number | undefined;
  if (bruto.validadeDias !== undefined && bruto.validadeDias !== null && bruto.validadeDias !== '') {
    const valor = numeroFinito(bruto.validadeDias);
    if (valor === null || !Number.isInteger(valor) || valor < 1 || valor > 365) {
      return { ok: false, erro: 'A validade deve ser um número inteiro de 1 a 365 dias.' };
    }
    validadeDias = valor;
  }

  let ivaPercent: number | undefined;
  if (bruto.ivaPercent !== undefined && bruto.ivaPercent !== null && bruto.ivaPercent !== '') {
    const valor = numeroFinito(bruto.ivaPercent);
    if (valor === null || valor < 0 || valor > 100) {
      return { ok: false, erro: 'A taxa de IVA deve estar entre 0 e 100.' };
    }
    ivaPercent = valor;
  }

  return {
    ok: true,
    documento: {
      tipo: bruto.tipo === 'proforma' ? 'proforma' : 'orcamento',
      empresa: empresa.documento,
      cliente: cliente.documento,
      numero: texto(bruto.numero, 30) || undefined,
      data: data.documento,
      validadeDias,
      notas: texto(bruto.notas, 600) || undefined,
      itens: itens.documento,
      ivaPercent,
    },
  };
}

function validarDocumentoRecibo(bruto: Record<string, unknown>): ResultadoValidacao<DocumentoRecibo> {
  const empresa = validarEmpresa(bruto.empresa, 'A empresa');
  if (!empresa.ok) return empresa;
  const cliente = validarEmpresa(bruto.cliente, 'Quem pagou');
  if (!cliente.ok) return cliente;
  const data = validarDataOpcional(bruto.data, 'A data');
  if (!data.ok) return data;

  const valor = numeroFinito(bruto.valor);
  if (valor === null || valor <= 0 || valor > VALOR_MAXIMO) {
    return { ok: false, erro: 'Indique o valor recebido (maior que zero).' };
  }

  return {
    ok: true,
    documento: {
      tipo: 'recibo',
      empresa: empresa.documento,
      cliente: cliente.documento,
      numero: texto(bruto.numero, 30) || undefined,
      data: data.documento,
      metodo: texto(bruto.metodo, 30) || 'Numerário',
      valor,
      descricao: texto(bruto.descricao, 300) || undefined,
    },
  };
}

function validarDocumentoDespesas(bruto: Record<string, unknown>): ResultadoValidacao<DocumentoDespesas> {
  const empresa = validarEmpresa(bruto.empresa, 'A empresa');
  if (!empresa.ok) return empresa;
  const periodoDe = validarDataOpcional(bruto.periodoDe, 'O início do período');
  if (!periodoDe.ok) return periodoDe;
  const periodoAte = validarDataOpcional(bruto.periodoAte, 'O fim do período');
  if (!periodoAte.ok) return periodoAte;

  if (!Array.isArray(bruto.linhas) || bruto.linhas.length === 0) {
    return { ok: false, erro: 'Adicione pelo menos uma despesa ao mapa.' };
  }
  if (bruto.linhas.length > LIMITE_LINHAS_DESPESAS) {
    return { ok: false, erro: `Máximo de ${LIMITE_LINHAS_DESPESAS} linhas por mapa de despesas.` };
  }

  const linhas: DespesaLinha[] = [];
  for (const brutoLinha of bruto.linhas) {
    if (typeof brutoLinha !== 'object' || brutoLinha === null) {
      return { ok: false, erro: 'Linha de despesa inválida.' };
    }
    const linha = brutoLinha as Record<string, unknown>;
    const dataLinha = validarDataOpcional(linha.data, 'A data da despesa');
    if (!dataLinha.ok) return dataLinha;
    const descricao = texto(linha.descricao, 200);
    if (!descricao) return { ok: false, erro: 'Cada despesa precisa de uma descrição.' };
    const valor = numeroFinito(linha.valor);
    if (valor === null || valor <= 0 || valor > VALOR_MAXIMO) {
      return { ok: false, erro: `Valor inválido na despesa «${descricao}».` };
    }
    linhas.push({
      data: dataLinha.documento ?? '',
      descricao,
      categoria: texto(linha.categoria, 60) || 'Outras',
      valor,
    });
  }

  return {
    ok: true,
    documento: {
      tipo: 'despesas',
      empresa: empresa.documento,
      periodoDe: periodoDe.documento ?? '',
      periodoAte: periodoAte.documento ?? '',
      linhas,
    },
  };
}

/**
 * Valida e normaliza um payload arbitrário vindo de um endpoint público.
 * Nunca lança: devolve sempre um resultado com erro em português.
 */
export function validarDocumentoPdf(payload: unknown): ResultadoValidacao<DocumentoPayload> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, erro: 'Pedido inválido.' };
  }
  const bruto = payload as Record<string, unknown>;
  switch (bruto.tipo) {
    case 'orcamento':
    case 'proforma':
      return validarDocumentoItens(bruto);
    case 'recibo':
      return validarDocumentoRecibo(bruto);
    case 'despesas':
      return validarDocumentoDespesas(bruto);
    default:
      return { ok: false, erro: 'Tipo de documento desconhecido.' };
  }
}

const arredondar = (valor: number) => Math.round((valor + Number.EPSILON) * 100) / 100;

/** Totais de um documento com itens: subtotal, IVA e total (em kwanzas). */
export function calcularTotaisItens(
  itens: Array<{ descricao?: unknown; quantidade: unknown; preco: unknown }>,
  ivaPercent?: number,
): { subtotal: number; iva: number; total: number } {
  let subtotal = 0;
  for (const item of itens) {
    const quantidade = numeroFinito(item.quantidade);
    const preco = numeroFinito(item.preco);
    const q = quantidade !== null && quantidade > 0 ? quantidade : 0;
    const p = preco !== null && preco > 0 ? preco : 0;
    subtotal += q * p;
  }
  const iva = ivaPercent !== undefined && Number.isFinite(ivaPercent) && ivaPercent > 0
    ? subtotal * (ivaPercent / 100)
    : 0;
  return { subtotal: arredondar(subtotal), iva: arredondar(iva), total: arredondar(subtotal + iva) };
}

/** Agrupa despesas por categoria, preservando a ordem da primeira ocorrência. */
export function totaisDespesasPorCategoria(linhas: DespesaLinha[]): Array<{ categoria: string; total: number }> {
  const grupos = new Map<string, number>();
  for (const linha of linhas) {
    if (!Number.isFinite(linha.valor) || linha.valor <= 0) continue;
    const actual = grupos.get(linha.categoria) ?? 0;
    grupos.set(linha.categoria, actual + linha.valor);
  }
  return Array.from(grupos.entries(), ([categoria, total]) => ({ categoria, total: arredondar(total) }));
}

/** Nome de ficheiro seguro e descritivo para o PDF de cada documento. */
export function nomeFicheiroPdf(doc: { tipo: string; numero?: string }): string {
  const prefixo =
    doc.tipo === 'orcamento' ? 'Orcamento'
    : doc.tipo === 'proforma' ? 'Factura_proforma'
    : doc.tipo === 'recibo' ? 'Recibo'
    : 'Mapa_de_despesas';
  const hoje = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Africa/Luanda' }).format(new Date());
  const sufixo = doc.numero
    ? doc.numero.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
    : hoje;
  return `${prefixo}_${sufixo || hoje}.pdf`;
}
