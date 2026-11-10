import Link from 'next/link';

const modules = [
  { href: '/stock/compras', title: 'Compras e receções', desc: 'Ordens de compra e receção no armazém.' },
  { href: '/stock/recepcoes', title: 'Receções', desc: 'Histórico de receções por armazém.' },
  { href: '/stock/lotes', title: 'Lotes e validades', desc: 'Consulta e registo de lotes.' },
  { href: '/stock/reservas', title: 'Reservas de stock', desc: 'Criar, libertar e consumir reservas.' },
  { href: '/stock/ajustes', title: 'Ajustes de inventário', desc: 'Aumentos e reduções com motivo.' },
  { href: '/stock/devolucoes', title: 'Devoluções', desc: 'Registo de devoluções físicas.' },
  { href: '/stock/consultas', title: 'Movimentos e saldos', desc: 'Histórico e saldos por armazém.' },
];

export function StockOperationsNav() {
  return (
    <section aria-labelledby="stock-operations-title" className="rounded-xl border border-[#e2e9f1] bg-white p-4 sm:p-5">
      <div className="mb-3">
        <h2 id="stock-operations-title" className="text-base font-semibold text-[#1c2d3f]">Operações WMS</h2>
        <p className="mt-1 text-xs text-[#708195] sm:text-sm">Compras, lotes, reservas, ajustes, devoluções e consultas.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="flex min-h-12 flex-col justify-center rounded-lg border border-[#e2e9f1] px-3 py-2.5 transition hover:border-[#2878d0]/40 hover:bg-[#f7faff]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-[#1c2d3f] sm:text-sm">{module.title}</span>
              <span aria-hidden="true" className="text-[#9aa8b8]">›</span>
            </span>
            <span className="mt-0.5 hidden text-[11px] leading-snug text-[#708195] sm:block">{module.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
