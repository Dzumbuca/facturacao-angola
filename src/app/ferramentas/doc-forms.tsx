'use client';

import { useState } from 'react';
import { IVA_TAXAS, parseValor } from '@/lib/business-tools';
import { calcularTotaisItens, nomeFicheiroPdf } from '@/lib/business-docs';

// Formulários dos geradores de documentos. Partilham o descarregamento do PDF
// (POST /api/ferramentas/documento-pdf → blob → download) e os campos base.

export type EstadoDownload = 'parado' | 'a-gerar' | 'ok' | 'erro';

export function useDescarregarPdf() {
  const [estado, setEstado] = useState<EstadoDownload>('parado');
  const [erro, setErro] = useState<string | null>(null);

  async function descarregar(payload: unknown, doc: { tipo: string; numero?: string }): Promise<boolean> {
    setEstado('a-gerar');
    setErro(null);
    try {
      const resposta = await fetch('/api/ferramentas/documento-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => null)) as { error?: string } | null;
        setErro(dados?.error ?? 'Não foi possível gerar o PDF. Verifique os campos e tente novamente.');
        setEstado('erro');
        return false;
      }
      const blob = await resposta.blob();
      const url = URL.createObjectURL(blob);
      const ligacao = document.createElement('a');
      ligacao.href = url;
      ligacao.download = nomeFicheiroPdf(doc);
      document.body.appendChild(ligacao);
      ligacao.click();
      ligacao.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setEstado('ok');
      return true;
    } catch {
      setErro('Sem ligação ao servidor. Verifique a internet e tente novamente.');
      setEstado('erro');
      return false;
    }
  }

  return { estado, erro, descarregar };
}

export function Campo({ id, label, obrigatorio, erro, children }: {
  id: string;
  label: string;
  obrigatorio?: boolean;
  erro?: string | null;
  children: React.ReactNode;
}) {
  return <div>
    <label htmlFor={id} className="app-label">
      {label}
      {obrigatorio && <span className="text-[#c44747]"> *</span>}
    </label>
    {children}
    {erro && <p className="mt-1 text-xs font-semibold text-[#c44747]">{erro}</p>}
  </div>;
}

export const ERRO_TEXTO = 'Preencha este campo.';

type LinhaItem = { descricao: string; quantidade: string; preco: string };

const LINHA_VAZIA: LinhaItem = { descricao: '', quantidade: '', preco: '' };

const rotulo = (tipo: 'orcamento' | 'proforma') => tipo === 'proforma' ? 'Factura proforma' : 'Orçamento';

export function OrcamentoProformaForm({ tipo }: { tipo: 'orcamento' | 'proforma' }) {
  const { estado, erro, descarregar } = useDescarregarPdf();
  const [numero, setNumero] = useState('');
  const [data, setData] = useState('');
  const [iva, setIva] = useState('0');
  const [validadeDias, setValidadeDias] = useState(tipo === 'proforma' ? '15' : '15');
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaNif, setEmpresaNif] = useState('');
  const [empresaContacto, setEmpresaContacto] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteNif, setClienteNif] = useState('');
  const [clienteContacto, setClienteContacto] = useState('');
  const [itens, setItens] = useState<LinhaItem[]>([{ ...LINHA_VAZIA }]);
  const [notas, setNotas] = useState('');

  const ivaPercent = Number(iva) || 0;
  const itensNumericos = itens.map((linha) => ({
    descricao: linha.descricao.trim(),
    quantidade: parseValor(linha.quantidade),
    preco: parseValor(linha.preco),
  }));
  const totais = calcularTotaisItens(itensNumericos, ivaPercent > 0 ? ivaPercent : undefined);

  const erros = {
    empresaNome: empresaNome.trim() === '' ? ERRO_TEXTO : null,
    clienteNome: clienteNome.trim() === '' ? ERRO_TEXTO : null,
    itens: itensNumericos.some((linha) => linha.descricao === '') ? 'Cada item precisa de descrição.'
      : itensNumericos.some((linha) => !Number.isFinite(linha.quantidade) || linha.quantidade <= 0) ? 'Cada item precisa de quantidade maior que zero.'
      : itensNumericos.some((linha) => !Number.isFinite(linha.preco) || linha.preco < 0) ? 'Preços não podem ser negativos.'
      : null,
  };
  const valido = !erros.empresaNome && !erros.clienteNome && !erros.itens;

  const atualizarLinha = (indice: number, campo: keyof LinhaItem, valor: string) => {
    setItens((actuais) => actuais.map((linha, i) => (i === indice ? { ...linha, [campo]: valor } : linha)));
  };

  const limpar = () => {
    setNumero(''); setData(''); setIva('0'); setEmpresaNome(''); setEmpresaNif(''); setEmpresaContacto('');
    setClienteNome(''); setClienteNif(''); setClienteContacto(''); setItens([{ ...LINHA_VAZIA }]); setNotas('');
  };

  const submeter = async () => {
    if (!valido) return;
    const ok = await descarregar({
      tipo,
      empresa: { nome: empresaNome.trim(), nif: empresaNif.trim() || undefined, contacto: empresaContacto.trim() || undefined },
      cliente: { nome: clienteNome.trim(), nif: clienteNif.trim() || undefined, contacto: clienteContacto.trim() || undefined },
      numero: numero.trim() || undefined,
      data: data || undefined,
      validadeDias: Number(validadeDias) || undefined,
      ivaPercent: ivaPercent > 0 ? ivaPercent : undefined,
      notas: notas.trim() || undefined,
      itens: itensNumericos.map((linha) => ({ descricao: linha.descricao, quantidade: linha.quantidade, preco: linha.preco })),
    }, { tipo, numero: numero.trim() || undefined });
  };

  return <div className="app-calculator space-y-5">
    <div className="grid gap-4 sm:grid-cols-3">
      <Campo id={`doc-numero-${tipo}`} label={`Nº do ${rotulo(tipo).toLowerCase()} (opcional)`}>
        <input id={`doc-numero-${tipo}`} className="app-input" placeholder="Ex.: ORC-2026-001" value={numero} onChange={(event) => setNumero(event.target.value)} />
      </Campo>
      <Campo id={`doc-data-${tipo}`} label="Data (opcional)">
        <input id={`doc-data-${tipo}`} type="date" className="app-input" value={data} onChange={(event) => setData(event.target.value)} />
      </Campo>
      <Campo id={`doc-iva-${tipo}`} label="IVA a destacar">
        <select id={`doc-iva-${tipo}`} className="app-input" value={iva} onChange={(event) => setIva(event.target.value)}>
          <option value="0">Sem IVA destacado</option>
          {IVA_TAXAS.filter((t) => t.valor > 0).map((taxa) => (
            <option key={taxa.valor} value={taxa.valor}>{taxa.etiqueta}</option>
          ))}
        </select>
      </Campo>
    </div>

    <fieldset className="rounded-xl border border-[#e2e9f1] p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-[#708195]">A sua empresa</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id={`doc-emp-nome-${tipo}`} label="Nome" obrigatorio erro={erros.empresaNome}>
          <input id={`doc-emp-nome-${tipo}`} className="app-input" placeholder="Ex.: Comércio Kiala Lda" value={empresaNome} onChange={(event) => setEmpresaNome(event.target.value)} aria-invalid={Boolean(erros.empresaNome) || undefined} />
        </Campo>
        <Campo id={`doc-emp-nif-${tipo}`} label="NIF (opcional)">
          <input id={`doc-emp-nif-${tipo}`} className="app-input" placeholder="Ex.: 5417000123" value={empresaNif} onChange={(event) => setEmpresaNif(event.target.value)} />
        </Campo>
        <Campo id={`doc-emp-contacto-${tipo}`} label="Contacto (opcional)">
          <input id={`doc-emp-contacto-${tipo}`} className="app-input" placeholder="Ex.: 923 000 000" value={empresaContacto} onChange={(event) => setEmpresaContacto(event.target.value)} />
        </Campo>
      </div>
    </fieldset>

    <fieldset className="rounded-xl border border-[#e2e9f1] p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-[#708195]">Cliente</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id={`doc-cli-nome-${tipo}`} label="Nome" obrigatorio erro={erros.clienteNome}>
          <input id={`doc-cli-nome-${tipo}`} className="app-input" placeholder="Ex.: Padaria Bom Jesus" value={clienteNome} onChange={(event) => setClienteNome(event.target.value)} aria-invalid={Boolean(erros.clienteNome) || undefined} />
        </Campo>
        <Campo id={`doc-cli-nif-${tipo}`} label="NIF (opcional)">
          <input id={`doc-cli-nif-${tipo}`} className="app-input" value={clienteNif} onChange={(event) => setClienteNif(event.target.value)} />
        </Campo>
        <Campo id={`doc-cli-contacto-${tipo}`} label="Contacto (opcional)">
          <input id={`doc-cli-contacto-${tipo}`} className="app-input" value={clienteContacto} onChange={(event) => setClienteContacto(event.target.value)} />
        </Campo>
      </div>
    </fieldset>

    <div>
      <div className="flex items-center justify-between">
        <span className="app-label mb-0">Itens <span className="text-[#c44747]">*</span></span>
        <button type="button" onClick={() => setItens((actuais) => [...actuais, { ...LINHA_VAZIA }])} className="rounded-lg border border-[#c9def2] bg-white px-3 py-1.5 text-xs font-bold text-[#2878d0] transition hover:bg-[#f0f6fc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
          + Adicionar item
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {itens.map((linha, indice) => <div key={indice} className="grid grid-cols-[1fr_64px_92px_32px] items-start gap-2 sm:grid-cols-[1fr_70px_100px_32px]">
          <input aria-label={`Descrição do item ${indice + 1}`} className="app-input" placeholder={`Item ${indice + 1} — descrição`} value={linha.descricao} onChange={(event) => atualizarLinha(indice, 'descricao', event.target.value)} />
          <input aria-label={`Quantidade do item ${indice + 1}`} inputMode="decimal" className="app-input tabular-nums" placeholder="Qtd." value={linha.quantidade} onChange={(event) => atualizarLinha(indice, 'quantidade', event.target.value)} />
          <input aria-label={`Preço unitário do item ${indice + 1}`} inputMode="decimal" className="app-input tabular-nums" placeholder="Preço" value={linha.preco} onChange={(event) => atualizarLinha(indice, 'preco', event.target.value)} />
          <button type="button" aria-label={`Remover item ${indice + 1}`} disabled={itens.length === 1} onClick={() => setItens((actuais) => actuais.filter((_, i) => i !== indice))} className="mt-1 rounded-lg px-2 py-1.5 text-sm font-bold text-[#a13d3d] transition hover:bg-[#fdf2f2] disabled:opacity-30">✕</button>
        </div>)}
      </div>
      {erros.itens && <p className="mt-1 text-xs font-semibold text-[#c44747]">{erros.itens}</p>}
    </div>

    {itensNumericos.some((linha) => linha.quantidade > 0 && linha.preco >= 0 && linha.descricao !== '') && <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#e2e9f1] bg-white p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#708195]">Subtotal</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#1c2d3f]">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totais.subtotal).replace(/\u00a0/g, ' ')}</p>
      </div>
      <div className="rounded-xl border border-[#c9def2] bg-[#eef6ff] p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2878d0]">IVA {ivaPercent > 0 ? `(${ivaPercent}%)` : ''}</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#2878d0]">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totais.iva).replace(/\u00a0/g, ' ')}</p>
      </div>
      <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Total</p>
        <p className="mt-1 text-lg font-bold tabular-nums text-[#227958]">{new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(totais.total).replace(/\u00a0/g, ' ')}</p>
      </div>
    </div>}

    <Campo id={`doc-notas-${tipo}`} label="Notas (opcional)">
      <textarea id={`doc-notas-${tipo}`} className="app-input min-h-20" placeholder="Ex.: Entrega em Luanda incluída. Pagamento a 50% na encomenda." value={notas} onChange={(event) => setNotas(event.target.value)} />
    </Campo>

    {tipo === 'proforma' && <Campo id={`doc-validade-${tipo}`} label="Validade da proforma">
      <select id={`doc-validade-${tipo}`} className="app-input" value={validadeDias} onChange={(event) => setValidadeDias(event.target.value)}>
        <option value="7">7 dias</option>
        <option value="15">15 dias</option>
        <option value="30">30 dias</option>
      </select>
    </Campo>}

    {erro && <p role="alert" className="rounded-xl border border-[#f0d3d3] bg-[#fdf2f2] p-4 text-sm font-semibold text-[#a13d3d]">{erro}</p>}
    {estado === 'ok' && <p role="status" className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-sm font-semibold text-[#227958]">PDF gerado e descarregado ✓</p>}

    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" onClick={limpar} className="rounded-lg border border-[#d5dfea] bg-white px-4 py-2 text-sm font-bold text-[#48627a] transition hover:border-[#c9def2] hover:text-[#2878d0]">Limpar</button>
      <button type="button" onClick={submeter} disabled={!valido || estado === 'a-gerar'} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2878d0] px-8 text-base font-bold text-white transition hover:bg-[#216bbd] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2878d0]">
        {estado === 'a-gerar' ? 'A gerar PDF…' : 'Descarregar PDF'}
      </button>
    </div>
  </div>;
}
