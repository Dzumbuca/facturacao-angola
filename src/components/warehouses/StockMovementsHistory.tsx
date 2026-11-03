'use client';

type Movement = {
  id: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string | null;
  reference: string | null;
  createdAt: string;
  product: { name: string; codigo: string | null } | null;
};

type Props = {
  movements: Movement[];
};

function formatDateTime(date: string) {
  return new Date(date).toLocaleString('pt-PT');
}

function getMovementTypeInfo(type: string) {
  if (type === 'IN') return { label: 'Entrada', className: 'bg-[#eff4f8] text-[#2878d0] border border-[#cdddeb]' };
  if (type === 'OUT') return { label: 'Saída', className: 'bg-[#fdf3f3] text-[#a83939] border border-red-100' };
  return { label: 'Ajuste', className: 'bg-[#f0f4f8] text-[#64768a] border border-[#e7edf3]' };
}

export function StockMovementsHistory({ movements }: Props) {
  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <div className="border-b px-5 py-4 md:px-6">
        <h2 className="text-base font-bold text-[#1c2d3f]">Histórico de movimentações</h2>
      </div>
      <div className="p-5 md:p-6">
        {movements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d7e1eb] bg-[#f8fafc] px-5 py-12 text-center">
            <p className="font-semibold text-[#344a60]">Nenhuma movimentação registada.</p>
            <p className="mt-1 text-sm text-[#708195]">Registe entradas, saídas ou ajustes de stock para começar o histórico.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th className="text-right">Quantidade</th>
                  <th>Motivo</th>
                  <th>Referência</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const typeInfo = getMovementTypeInfo(movement.type);
                  return (
                    <tr key={movement.id} className="transition hover:bg-[#f8fafc]">
                      <td className="text-sm text-[#607286]">{formatDateTime(movement.createdAt)}</td>
                      <td className="text-sm font-medium text-[#263c52]">{movement.product?.name || '-'}</td>
                      <td className="text-sm">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent ${typeInfo.className}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="text-sm tabular-nums text-right font-medium">{movement.quantity}</td>
                      <td className="text-sm text-[#607286]">{movement.reason || '-'}</td>
                      <td className="text-sm text-[#607286]">{movement.reference || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
