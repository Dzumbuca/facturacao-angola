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

function getTypeInfo(type: string) {
  if (type === 'IN') return { label: 'Entrada', className: 'bg-primary text-primary-foreground' };
  if (type === 'OUT') return { label: 'Saída', className: 'bg-destructive text-destructive-foreground' };
  return { label: 'Ajuste', className: 'bg-secondary text-secondary-foreground' };
}

export function StockMovementsHistory({ movements }: Props) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6">
        <h3 className="text-lg font-semibold leading-none tracking-tight">Histórico de movimentações</h3>
      </div>
      <div className="p-6 pt-0">
        {movements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma movimentação registada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Data</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Produto</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Tipo</th>
                  <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Quantidade</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Motivo</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Referência</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const typeInfo = getTypeInfo(movement.type);
                  return (
                    <tr key={movement.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-4 align-middle">{formatDateTime(movement.createdAt)}</td>
                      <td className="p-4 align-middle">
                        <div>
                          <p className="font-medium">{movement.product?.name || '-'}</p>
                          {movement.product?.codigo && (
                            <p className="text-xs text-muted-foreground">{movement.product.codigo}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent ${typeInfo.className}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="p-4 align-middle text-right">{movement.quantity}</td>
                      <td className="p-4 align-middle">{movement.reason || '-'}</td>
                      <td className="p-4 align-middle">{movement.reference || '-'}</td>
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
