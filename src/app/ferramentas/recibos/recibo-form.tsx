'use client';

import { useState } from 'react';
import { formatKz, parseValor } from '@/lib/business-tools';
import { Campo, ERRO_TEXTO, useDescarregarPdf } from '../doc-forms';

const METODOS = ['Numerário', 'Transferência bancária', 'Multicaixa', 'Cheque', 'Outro'];

export function ReciboForm() {
  const { estado, erro, descarregar } = useDescarregarPdf();
  const [numero, setNumero] = useState('');
  const [data, setData] = useState('');
  const [metodo, setMetodo] = useState('Numerário');
  const [valor, setValor] = useState('');
  const [empresaNome, setEmpresaNome] = useState('');
  const [empresaNif, setEmpresaNif] = useState('');
  const [empresaContacto, setEmpresaContacto] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteNif, setClienteNif] = useState('');
  const [clienteContacto, setClienteContacto] = useState('');
  const [descricao, setDescricao] = useState('');

  const valorLido = parseValor(valor);
  const erros = {
    empresaNome: empresaNome.trim() === '' ? ERRO_TEXTO : null,
    clienteNome: clienteNome.trim() === '' ? ERRO_TEXTO : null,
    valor: valor.trim() === '' || !Number.isFinite(valorLido) || valorLido <= 0 ? 'Indique o valor recebido (maior que zero).' : null,
  };
  const valido = !erros.empresaNome && !erros.clienteNome && !erros.valor;

  const limpar = () => {
    setNumero(''); setData(''); setMetodo('Numerário'); setValor('');
    setEmpresaNome(''); setEmpresaNif(''); setEmpresaContacto('');
    setClienteNome(''); setClienteNif(''); setClienteContacto(''); setDescricao('');
  };

  const submeter = async () => {
    if (!valido) return;
    await descarregar({
      tipo: 'recibo',
      empresa: { nome: empresaNome.trim(), nif: empresaNif.trim() || undefined, contacto: empresaContacto.trim() || undefined },
      cliente: { nome: clienteNome.trim(), nif: clienteNif.trim() || undefined, contacto: clienteContacto.trim() || undefined },
      numero: numero.trim() || undefined,
      data: data || undefined,
      metodo,
      valor: valorLido,
      descricao: descricao.trim() || undefined,
    }, { tipo: 'recibo', numero: numero.trim() || undefined });
  };

  return <div className="app-calculator space-y-5">
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id="recibo-numero" label="Nº do recibo (opcional)">
        <input id="recibo-numero" className="app-input" placeholder="Ex.: REC-004" value={numero} onChange={(event) => setNumero(event.target.value)} />
      </Campo>
      <Campo id="recibo-data" label="Data (opcional)">
        <input id="recibo-data" type="date" className="app-input" value={data} onChange={(event) => setData(event.target.value)} />
      </Campo>
    </div>

    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id="recibo-valor" label="Valor recebido (Kz)" obrigatorio erro={valor.trim() !== '' && erros.valor ? erros.valor : null}>
        <input id="recibo-valor" inputMode="decimal" className="app-input tabular-nums text-lg" placeholder="Ex.: 25000" value={valor} onChange={(event) => setValor(event.target.value)} aria-invalid={valor.trim() !== '' && erros.valor ? true : undefined} />
      </Campo>
      <Campo id="recibo-metodo" label="Forma de pagamento">
        <select id="recibo-metodo" className="app-input" value={metodo} onChange={(event) => setMetodo(event.target.value)}>
          {METODOS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
        </select>
      </Campo>
    </div>

    {Number.isFinite(valorLido) && valorLido > 0 && <div className="rounded-xl border border-[#cbe8dc] bg-[#eff9f4] p-4 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#227958]">Recibo de</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-[#227958]">{formatKz(valorLido)}</p>
      {clienteNome.trim() !== '' && <p className="mt-1 text-xs text-[#708195]">recebido de {clienteNome.trim()}</p>}
    </div>}

    <fieldset className="rounded-xl border border-[#e2e9f1] p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-[#708195]">Emitido por</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="recibo-emp-nome" label="Nome" obrigatorio erro={empresaNome.trim() !== '' && erros.empresaNome ? erros.empresaNome : null}>
          <input id="recibo-emp-nome" className="app-input" placeholder="Ex.: Comércio Kiala Lda" value={empresaNome} onChange={(event) => setEmpresaNome(event.target.value)} />
        </Campo>
        <Campo id="recibo-emp-nif" label="NIF (opcional)">
          <input id="recibo-emp-nif" className="app-input" value={empresaNif} onChange={(event) => setEmpresaNif(event.target.value)} />
        </Campo>
        <Campo id="recibo-emp-contacto" label="Contacto (opcional)">
          <input id="recibo-emp-contacto" className="app-input" value={empresaContacto} onChange={(event) => setEmpresaContacto(event.target.value)} />
        </Campo>
      </div>
    </fieldset>

    <fieldset className="rounded-xl border border-[#e2e9f1] p-4">
      <legend className="px-1 text-xs font-bold uppercase tracking-[.12em] text-[#708195]">Recebido de</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo id="recibo-cli-nome" label="Nome" obrigatorio erro={clienteNome.trim() !== '' && erros.clienteNome ? erros.clienteNome : null}>
          <input id="recibo-cli-nome" className="app-input" placeholder="Ex.: Joana Mwangolé" value={clienteNome} onChange={(event) => setClienteNome(event.target.value)} />
        </Campo>
        <Campo id="recibo-cli-nif" label="NIF (opcional)">
          <input id="recibo-cli-nif" className="app-input" value={clienteNif} onChange={(event) => setClienteNif(event.target.value)} />
        </Campo>
        <Campo id="recibo-cli-contacto" label="Contacto (opcional)">
          <input id="recibo-cli-contacto" className="app-input" value={clienteContacto} onChange={(event) => setClienteContacto(event.target.value)} />
        </Campo>
      </div>
    </fieldset>

    <Campo id="recibo-descricao" label="Referente a (opcional)">
      <textarea id="recibo-descricao" className="app-input min-h-20" placeholder="Ex.: Pagamento da factura FT 2026/018" value={descricao} onChange={(event) => setDescricao(event.target.value)} />
    </Campo>

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
