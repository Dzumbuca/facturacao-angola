import Link from 'next/link';

const modules = [
  { href: '/stock/compras', title: 'Compras e receções', desc: 'Ordens de compra, detalhes, quantidades recebidas e registo de receção no armazém.', ready: true },
  { href: '/stock/recepcoes', title: 'Receções', desc: 'Histórico de receções de mercadorias por armazém e encomenda.', ready: true },
  { href: '/stock/lotes', title: 'Lotes e validades', desc: 'Consulta/registo de lotes, data de receção e validade (schema atual sem quantity/manufactureDate).', ready: true },
  { href: '/stock/reservas', title: 'Reservas de stock', desc: 'Criar, libertar e consumir reservas por produto/armazém (API real).', ready: true },
  { href: '/stock/ajustes', title: 'Ajustes de inventário', desc: 'Aumentos/reduções com motivo obrigatório e confirmação.', ready: true },
  { href: '/stock/devolucoes', title: 'Devoluções', desc: 'Registo de devoluções físicas suportadas pela API de stock.', ready: true },
  { href: '/stock/consultas', title: 'Movimentos e saldos', desc: 'Histórico de movimentos e saldos por produto/armazém (APIs reais).', ready: true },
];

export function StockOperationsNav() {
  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[#1c2d3f]">Operações WMS</h2>
          <p className="text-sm text-[#708195]">Operações ligadas a APIs reais. Campos não persistidos no schema atual são apresentados com limitação explícita.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((m) => (
          <Link key={m.title} href={m.href} className={`rounded-lg border p-3 transition hover:border-[#2878d0]/40 hover:bg-[#f7faff] ${m.ready ? '' : 'opacity-80'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-[#1c2d3f]">{m.title}</div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.ready ? 'bg-[#eff9f4] text-[#267256]' : 'bg-[#f3f6fa] text-[#607286]'}`}>{m.ready ? 'Disponível' : 'A integrar'}</span>
            </div>
            <p className="mt-1 text-sm text-[#708195]">{m.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
