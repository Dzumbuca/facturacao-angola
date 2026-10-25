'use client';

import { useState } from 'react';

// Formatos de NIF em Angola (estrutura):
// · Colectivo (empresa): 10 dígitos
// · Singular (pessoa): 9 dígitos + 2 letras + 3 dígitos (validade da identificação)
// O validador verifica o FORMATO; a existência real confirma-se na AGT.
function validarNif(entrada: string): { valido: boolean; tipo: string; formatado: string } {
  const limpo = entrada.replace(/[\s.-]/g, '').toUpperCase();
  if (/^\d{10}$/.test(limpo)) {
    return { valido: true, tipo: 'Pessoa colectiva (empresa)', formatado: limpo };
  }
  if (/^\d{9}[A-Z]{2}\d{3}$/.test(limpo)) {
    return { valido: true, tipo: 'Pessoa singular (particular)', formatado: `${limpo.slice(0, 9)} ${limpo.slice(9, 11)} ${limpo.slice(11)}` };
  }
  if (/^\d{9}$/.test(limpo)) {
    return { valido: true, tipo: 'Formato antigo (9 dígitos)', formatado: limpo };
  }
  return { valido: false, tipo: '', formatado: limpo };
}

export function NifValidator() {
  const [value, setValue] = useState('');
  const resultado = value.trim() ? validarNif(value) : null;

  return <div className="space-y-5">
    <div>
      <label htmlFor="nif-input" className="app-label">NIF a validar</label>
      <input
        id="nif-input"
        className="app-input text-lg tabular-nums"
        placeholder="Ex.: 5417089352 ou 006584587LA041"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        autoComplete="off"
      />
    </div>

    {resultado && <div className={`rounded-xl border p-5 ${resultado.valido ? 'border-[#cbe8dc] bg-[#eff9f4]' : 'border-[#f0c9c9] bg-red-50'}`}>
      <p className={`text-lg font-bold ${resultado.valido ? 'text-[#227958]' : 'text-[#a83939]'}`}>
        {resultado.valido ? '✓ Formato válido' : '✗ Formato inválido'}
      </p>
      {resultado.valido && <p className="mt-1 text-sm text-[#4a5f76]">Tipo: <strong>{resultado.tipo}</strong></p>}
      {resultado.valido && <p className="mt-1 text-sm text-[#4a5f76]">Formatado: <strong className="tabular-nums">{resultado.formatado}</strong></p>}
      {!resultado.valido && <p className="mt-1 text-sm text-[#4a5f76]">Um NIF angolano tem 10 dígitos (empresa) ou 9 dígitos + 2 letras + 3 dígitos (particular). Verifica se copiaste correctamente.</p>}
    </div>}

    <div className="overflow-x-auto rounded-xl border border-[#e2e9f1] bg-white">
      <table className="data-table min-w-[520px]">
        <thead><tr><th>Tipo</th><th>Formato</th><th>Exemplo</th></tr></thead>
        <tbody>
          <tr><td>Empresa (colectivo)</td><td>10 dígitos</td><td className="tabular-nums">5417089352</td></tr>
          <tr><td>Particular (singular)</td><td>9 dígitos + 2 letras + 3 dígitos</td><td className="tabular-nums">006584587LA041</td></tr>
        </tbody>
      </table>
    </div>
  </div>;
}
