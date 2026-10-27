// Gerador de PDFs para as ferramentas públicas: orçamentos, facturas proforma,
// recibos e mapas de despesas. Segue as convenções visuais de pdf-generator.ts
// (A4, pt-AO, paleta da marca). Recebe SEMPRE um payload já validado por
// validarDocumentoPdf — nunca dados crus.

import PDFDocument from 'pdfkit';
import type { DocumentoDespesas, DocumentoItens, DocumentoPayload, DocumentoRecibo } from './business-docs';
import { calcularTotaisItens, totaisDespesasPorCategoria } from './business-docs';

const PDF_BASE = () => new PDFDocument({ size: 'A4' });
type Doc = ReturnType<typeof PDF_BASE>;

const COLORS = {
  blue: '#021F87',
  ink: '#171C27',
  muted: '#647184',
  line: '#DCE2EA',
  pale: '#F3F6FA',
  paleBlue: '#EEF6FF',
  white: '#FFFFFF',
} as const;

const MARGIN = 44;
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const RODAPE_ALTURA = 64;
const LIMITE_Y = PAGE_H - RODAPE_ALTURA - 20;
const LINHA_ALTURA = 15;

function dinheiro(valor: number): string {
  return new Intl.NumberFormat('pt-AO', {
    style: 'currency', currency: 'AOA', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Number.isFinite(valor) ? valor : 0).replace(/\u00a0/g, ' ');
}

function numero(valor: number): string {
  return new Intl.NumberFormat('pt-AO', { maximumFractionDigits: 2 }).format(valor).replace(/\u00a0/g, ' ');
}

/** '2026-10-27' → '27/10/2026'; sem data → hoje em Luanda. */
function dataLegivel(iso: string | undefined): string {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return new Intl.DateTimeFormat('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Luanda' })
    .format(new Date()).replace(/\u00a0/g, ' ');
}

function tituloDocumento(tipo: DocumentoPayload['tipo']): string {
  switch (tipo) {
    case 'orcamento': return 'ORÇAMENTO';
    case 'proforma': return 'FACTURA PROFORMA';
    case 'recibo': return 'RECIBO';
    case 'despesas': return 'MAPA DE DESPESAS';
  }
}

function desenharRodape(pdf: Doc) {
  // Desenhar dentro da zona de margem desactiva a quebra automática de página
  // (sem isto, o próprio rodapé dispara pageAdded → recursão infinita).
  const margemOriginal = pdf.page.margins.bottom;
  pdf.page.margins.bottom = 0;
  const y = PAGE_H - RODAPE_ALTURA;
  pdf.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y).lineWidth(0.75).strokeColor(COLORS.line).stroke();
  pdf.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted)
    .text('Documento gerado gratuitamente com Machine Facturas · machinefaturas.shop', MARGIN, y + 8, { width: CONTENT_W(pdf), lineBreak: false });
  pdf.text(`Página ${pdf.bufferedPageRange().count}`, MARGIN, y + 8, { width: CONTENT_W(pdf), align: 'right', lineBreak: false });
  pdf.page.margins.bottom = margemOriginal;
}

function CONTENT_W(_pdf: Doc): number {
  return PAGE_W - MARGIN * 2;
}

/** Cabeçalho comum: empresa à esquerda, título/número/data à direita. */
function desenharCabecalho(pdf: Doc, doc: DocumentoPayload) {
  const numeroDoc = 'numero' in doc ? doc.numero : undefined;
  const dadosEmpresa = [doc.empresa.nome, doc.empresa.nif ? `NIF: ${doc.empresa.nif}` : '', doc.empresa.contacto ?? ''].filter(Boolean);

  pdf.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(doc.empresa.nome, MARGIN, MARGIN, { width: 300 });
  pdf.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(dadosEmpresa.slice(1).join(' · '), MARGIN, pdf.y + 2, { width: 300 });

  const titulo = tituloDocumento(doc.tipo);
  pdf.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.blue).text(titulo, MARGIN + 300, MARGIN, { width: CONTENT_W(pdf) - 300, align: 'right' });
  let yDireita = pdf.y + 4;
  pdf.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
  if (numeroDoc) { pdf.text(`Nº ${numeroDoc}`, MARGIN + 300, yDireita, { width: CONTENT_W(pdf) - 300, align: 'right' }); yDireita = pdf.y + 2; }

  const datas: string[] = [];
  if (doc.tipo === 'despesas') {
    datas.push(`Período: ${dataLegivel((doc as DocumentoDespesas).periodoDe)} — ${dataLegivel((doc as DocumentoDespesas).periodoAte)}`);
  } else {
    datas.push(`Data: ${dataLegivel(doc.data)}`);
    if (doc.tipo === 'proforma' && (doc as DocumentoItens).validadeDias) {
      datas.push(`Validade: ${(doc as DocumentoItens).validadeDias} dias`);
    }
  }
  pdf.fontSize(9).fillColor(COLORS.muted).text(datas.join('  ·  '), MARGIN + 300, yDireita, { width: CONTENT_W(pdf) - 300, align: 'right' });

  const yLinha = Math.max(pdf.y, MARGIN + 52) + 10;
  pdf.moveTo(MARGIN, yLinha).lineTo(PAGE_W - MARGIN, yLinha).lineWidth(1).strokeColor(COLORS.blue).stroke();
  pdf.x = MARGIN;
  pdf.y = yLinha + 14;
}

function blocoParte(pdf: Doc, rotulo: string, nome: string, detalhes: string[], x: number, largura: number) {
  pdf.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.muted).text(rotulo.toUpperCase(), x, pdf.y, { width: largura, lineBreak: false });
  pdf.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text(nome, x, pdf.y + 12, { width: largura });
  if (detalhes.length > 0) {
    pdf.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text(detalhes.join(' · '), x, pdf.y + 2, { width: largura });
  }
  pdf.y = Math.max(pdf.y, pdf.y) + 6;
}

function garantirEspaco(pdf: Doc, necessario: number, redesenharCabecalhoTabela?: () => void) {
  if (pdf.y + necessario <= LIMITE_Y) return;
  pdf.addPage();
  redesenharCabecalhoTabela?.();
}

function tabelaItens(pdf: Doc, doc: DocumentoItens) {
  const colDesc = MARGIN;
  const larguraDesc = 240;
  const colQtd = colDesc + larguraDesc + 10;
  const larguraQtd = 55;
  const colPreco = colQtd + larguraQtd + 10;
  const larguraPreco = 90;
  const colTotal = colPreco + larguraPreco + 10;
  const larguraTotal = PAGE_W - MARGIN - colTotal;

  const cabecalhoTabela = () => {
    pdf.rect(MARGIN, pdf.y, CONTENT_W(pdf), 20).fill(COLORS.pale);
    const yTexto = pdf.y + 6;
    pdf.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.ink);
    pdf.text('DESCRIÇÃO', colDesc + 6, yTexto, { width: larguraDesc - 12, lineBreak: false });
    pdf.text('QTD', colQtd, yTexto, { width: larguraQtd, align: 'right', lineBreak: false });
    pdf.text('PREÇO UNIT.', colPreco, yTexto, { width: larguraPreco, align: 'right', lineBreak: false });
    pdf.text('TOTAL', colTotal, yTexto, { width: larguraTotal, align: 'right', lineBreak: false });
    pdf.y += 20;
  };

  cabecalhoTabela();
  pdf.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink);

  for (const item of doc.itens) {
    const alturaLinha = Math.max(LINHA_ALTURA + 8, pdf.heightOfString(item.descricao, { width: larguraDesc - 12 }) + 8);
    garantirEspaco(pdf, alturaLinha + 4, cabecalhoTabela);
    const yLinha = pdf.y;
    const textoDescricao = pdf.text(item.descricao, colDesc + 6, yLinha + 4, { width: larguraDesc - 12 });
    pdf.text(numero(item.quantidade), colQtd, yLinha + 4, { width: larguraQtd, align: 'right', lineBreak: false });
    pdf.text(dinheiro(item.preco), colPreco, yLinha + 4, { width: larguraPreco, align: 'right', lineBreak: false });
    pdf.text(dinheiro(item.quantidade * item.preco), colTotal, yLinha + 4, { width: larguraTotal, align: 'right', lineBreak: false });
    pdf.y = Math.max(textoDescricao.y ?? yLinha, yLinha + alturaLinha);
    pdf.moveTo(MARGIN, pdf.y).lineTo(PAGE_W - MARGIN, pdf.y).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    pdf.y += 0;
  }

  // Totais
  const totais = calcularTotaisItens(doc.itens, doc.ivaPercent);
  garantirEspaco(pdf, 96);
  const larguraCaixa = 230;
  const xCaixa = PAGE_W - MARGIN - larguraCaixa;
  const yCaixa = pdf.y + 12;
  pdf.rect(xCaixa, yCaixa, larguraCaixa, doc.ivaPercent ? 76 : 58).fill(COLORS.paleBlue);
  pdf.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink);
  let yTotal = yCaixa + 10;
  pdf.text('Subtotal', xCaixa + 12, yTotal, { width: larguraCaixa - 24, lineBreak: false });
  pdf.text(dinheiro(totais.subtotal), xCaixa + 12, yTotal, { width: larguraCaixa - 24, align: 'right', lineBreak: false });
  yTotal += LINHA_ALTURA;
  if (doc.ivaPercent) {
    pdf.text(`IVA (${numero(doc.ivaPercent)}%)`, xCaixa + 12, yTotal, { width: larguraCaixa - 24, lineBreak: false });
    pdf.text(dinheiro(totais.iva), xCaixa + 12, yTotal, { width: larguraCaixa - 24, align: 'right', lineBreak: false });
    yTotal += LINHA_ALTURA;
  }
  pdf.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.blue);
  pdf.text('TOTAL', xCaixa + 12, yTotal + 2, { width: larguraCaixa - 24, lineBreak: false });
  pdf.text(dinheiro(totais.total), xCaixa + 12, yTotal + 2, { width: larguraCaixa - 24, align: 'right', lineBreak: false });
  pdf.y = yCaixa + (doc.ivaPercent ? 76 : 58) + 16;
  pdf.x = MARGIN;

  if (doc.notas) {
    garantirEspaco(pdf, 60);
    pdf.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('NOTAS', MARGIN, pdf.y, { lineBreak: false });
    pdf.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(doc.notas, MARGIN, pdf.y + 4, { width: CONTENT_W(pdf) });
    pdf.y += 8;
  }

  const frase = doc.tipo === 'proforma'
    ? `Factura proforma — documento sem valor fiscal, não substitui a factura. Validade: ${doc.validadeDias ?? 15} dias.`
    : `Orçamento válido por ${doc.validadeDias ?? 15} dias. Preços em kwanzas, podendo ser revistos após o prazo.`;
  pdf.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.muted).text(frase, MARGIN, pdf.y + 4, { width: CONTENT_W(pdf) });
}

function desenharRecibo(pdf: Doc, doc: DocumentoRecibo) {
  pdf.font('Helvetica').fontSize(10.5).fillColor(COLORS.ink);
  pdf.text('Recebemos de', MARGIN, pdf.y + 6, { continued: false });
  pdf.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(doc.cliente.nome, MARGIN, pdf.y + 4, { width: CONTENT_W(pdf) });
  if (doc.cliente.nif || doc.cliente.contacto) {
    pdf.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted).text([doc.cliente.nif ? `NIF: ${doc.cliente.nif}` : '', doc.cliente.contacto ?? ''].filter(Boolean).join(' · '), MARGIN, pdf.y + 2, { width: CONTENT_W(pdf) });
  }

  // Valor em destaque
  const yCaixa = pdf.y + 16;
  const larguraCaixa = 260;
  pdf.rect(MARGIN, yCaixa, larguraCaixa, 54).fill(COLORS.paleBlue);
  pdf.font('Helvetica').fontSize(7.5).fillColor(COLORS.muted).text('VALOR RECEBIDO', MARGIN + 12, yCaixa + 9, { lineBreak: false });
  pdf.font('Helvetica-Bold').fontSize(15).fillColor(COLORS.blue).text(dinheiro(doc.valor), MARGIN + 12, yCaixa + 22, { lineBreak: false });
  pdf.y = yCaixa + 54;

  const linhas: Array<[string, string]> = [
    ['Forma de pagamento', doc.metodo],
    ['Data', dataLegivel(doc.data)],
    ...(doc.numero ? [['Número', doc.numero] as [string, string]] : []),
  ];
  pdf.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink);
  for (const [rotulo, valorLinha] of linhas) {
    garantirEspaco(pdf, LINHA_ALTURA);
    pdf.text(rotulo, MARGIN, pdf.y + 6, { width: 150, lineBreak: false });
    pdf.font('Helvetica-Bold').text(valorLinha, MARGIN + 150, pdf.y, { width: CONTENT_W(pdf) - 150, lineBreak: false });
    pdf.font('Helvetica');
    pdf.y += LINHA_ALTURA;
  }

  if (doc.descricao) {
    garantirEspaco(pdf, 60);
    pdf.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('REFERENTE A', MARGIN, pdf.y + 10, { lineBreak: false });
    pdf.font('Helvetica').fontSize(9.5).fillColor(COLORS.ink).text(doc.descricao, MARGIN, pdf.y + 14, { width: CONTENT_W(pdf) });
  }

  const yAssinatura = Math.max(pdf.y + 60, LIMITE_Y - 70);
  pdf.moveTo(PAGE_W - MARGIN - 200, yAssinatura).lineTo(PAGE_W - MARGIN, yAssinatura).lineWidth(0.75).strokeColor(COLORS.line).stroke();
  pdf.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('Assinatura e carimbo', PAGE_W - MARGIN - 200, yAssinatura + 5, { width: 200, align: 'center', lineBreak: false });
  pdf.y = yAssinatura + 24;
}

function desenharDespesas(pdf: Doc, doc: DocumentoDespesas) {
  const colData = MARGIN;
  const larguraData = 70;
  const colCategoria = colData + larguraData + 8;
  const larguraCategoria = 110;
  const colDescricao = colCategoria + larguraCategoria + 8;
  const larguraDescricao = 195;
  const colValor = colDescricao + larguraDescricao + 8;
  const larguraValor = PAGE_W - MARGIN - colValor;

  const cabecalhoTabela = () => {
    pdf.rect(MARGIN, pdf.y, CONTENT_W(pdf), 20).fill(COLORS.pale);
    const yTexto = pdf.y + 6;
    pdf.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.ink);
    pdf.text('DATA', colData + 6, yTexto, { width: larguraData - 12, lineBreak: false });
    pdf.text('CATEGORIA', colCategoria, yTexto, { width: larguraCategoria, lineBreak: false });
    pdf.text('DESCRIÇÃO', colDescricao, yTexto, { width: larguraDescricao, lineBreak: false });
    pdf.text('VALOR', colValor, yTexto, { width: larguraValor, align: 'right', lineBreak: false });
    pdf.y += 20;
  };

  cabecalhoTabela();
  pdf.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
  let total = 0;
  for (const linha of doc.linhas) {
    const alturaLinha = Math.max(LINHA_ALTURA + 6, pdf.heightOfString(linha.descricao, { width: larguraDescricao }) + 6);
    garantirEspaco(pdf, alturaLinha + 4, cabecalhoTabela);
    const yLinha = pdf.y;
    const textoData = pdf.text(dataLegivel(linha.data), colData + 6, yLinha + 4, { width: larguraData - 12 });
    pdf.text(linha.categoria, colCategoria, yLinha + 4, { width: larguraCategoria, lineBreak: false });
    pdf.text(linha.descricao, colDescricao, yLinha + 4, { width: larguraDescricao, lineBreak: false });
    pdf.text(dinheiro(linha.valor), colValor, yLinha + 4, { width: larguraValor, align: 'right', lineBreak: false });
    total += linha.valor;
    pdf.y = Math.max(textoData.y ?? yLinha, yLinha + alturaLinha);
    pdf.moveTo(MARGIN, pdf.y).lineTo(PAGE_W - MARGIN, pdf.y).lineWidth(0.5).strokeColor(COLORS.line).stroke();
  }

  garantirEspaco(pdf, 60);
  const grupos = totaisDespesasPorCategoria(doc.linhas);
  const yResumo = pdf.y + 14;
  pdf.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.blue);
  pdf.text('TOTAL GERAL', MARGIN, yResumo, { width: 200, lineBreak: false });
  pdf.text(dinheiro(total), MARGIN, yResumo, { width: 260, align: 'right', lineBreak: false });
  pdf.y = yResumo + 20;

  if (grupos.length > 1) {
    pdf.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('RESUMO POR CATEGORIA', MARGIN, pdf.y + 6, { lineBreak: false });
    pdf.font('Helvetica').fontSize(9).fillColor(COLORS.ink);
    for (const grupo of grupos) {
      garantirEspaco(pdf, LINHA_ALTURA);
      pdf.text(`• ${grupo.categoria}`, MARGIN + 10, pdf.y + 4, { width: 160, lineBreak: false });
      pdf.text(dinheiro(grupo.total), MARGIN + 10, pdf.y + 4, { width: 250, align: 'right', lineBreak: false });
      pdf.y += LINHA_ALTURA;
    }
    pdf.y += 8;
  }
}

/** Gera o PDF (Buffer) de um documento já validado. */
export const gerarDocumentoPdf = async (doc: DocumentoPayload): Promise<Buffer> => {
  const pdf = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: RODAPE_ALTURA + 16 },
    info: {
      Title: `${tituloDocumento(doc.tipo)}${'numero' in doc && doc.numero ? ` ${doc.numero}` : ''} — ${doc.empresa.nome}`,
      Author: doc.empresa.nome,
      Creator: 'Machine Facturas (machinefaturas.shop)',
    },
  });

  const segmentos: Buffer[] = [];
  pdf.on('data', (segmento: Buffer) => segmentos.push(segmento));
  const concluido = new Promise<Buffer>((resolve, reject) => {
    pdf.on('end', () => resolve(Buffer.concat(segmentos)));
    pdf.on('error', reject);
  });
  pdf.on('pageAdded', () => desenharRodape(pdf));

  desenharCabecalho(pdf, doc);

  // Bloco empresa/cliente para documentos com contraparte
  if (doc.tipo === 'orcamento' || doc.tipo === 'proforma' || doc.tipo === 'recibo') {
    const docItens = doc as DocumentoItens;
    const metade = CONTENT_W(pdf) / 2 - 12;
    const yBloco = pdf.y;
    blocoParte(pdf, doc.tipo === 'recibo' ? 'Emitido por' : 'De', docItens.empresa.nome, [docItens.empresa.nif ? `NIF: ${docItens.empresa.nif}` : '', docItens.empresa.contacto ?? ''].filter(Boolean), MARGIN, metade);
    const yAposEmpresa = pdf.y;
    pdf.y = yBloco;
    blocoParte(pdf, doc.tipo === 'recibo' ? 'Recebido de' : 'Para', docItens.cliente.nome, [docItens.cliente.nif ? `NIF: ${docItens.cliente.nif}` : '', docItens.cliente.contacto ?? ''].filter(Boolean), MARGIN + metade + 24, metade);
    pdf.y = Math.max(yAposEmpresa, pdf.y) + 8;
  }

  if (doc.tipo === 'orcamento' || doc.tipo === 'proforma') {
    tabelaItens(pdf, doc as DocumentoItens);
  } else if (doc.tipo === 'recibo') {
    desenharRecibo(pdf, doc as DocumentoRecibo);
  } else {
    desenharDespesas(pdf, doc as DocumentoDespesas);
  }

  desenharRodape(pdf);
  pdf.end();
  return concluido;
};
