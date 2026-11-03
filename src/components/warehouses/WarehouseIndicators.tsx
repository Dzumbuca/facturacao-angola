'use client';

type Props = {
  totalProducts: number;
  totalStock: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalValue: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(value || 0);
}

export function WarehouseIndicators({
  totalProducts,
  totalStock,
  lowStockProducts,
  outOfStockProducts,
  totalValue,
}: Props) {
  const cards = [
    {
      title: 'Total de produtos',
      value: totalProducts,
      color: 'text-blue-600',
    },
    {
      title: 'Stock total',
      value: totalStock,
      color: 'text-green-600',
    },
    {
      title: 'Stock baixo',
      value: lowStockProducts,
      color: 'text-amber-600',
    },
    {
      title: 'Sem stock',
      value: outOfStockProducts,
      color: 'text-red-600',
    },
    {
      title: 'Valor estimado do stock',
      value: formatCurrency(totalValue),
      color: 'text-emerald-600',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.title} className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <div className="p-6">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
