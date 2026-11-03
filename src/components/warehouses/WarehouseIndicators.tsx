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
      color: 'text-[#2878d0]',
    },
    {
      title: 'Stock total',
      value: totalStock,
      color: 'text-[#248468]',
    },
    {
      title: 'Stock baixo',
      value: lowStockProducts,
      color: 'text-[#8a5a10]',
    },
    {
      title: 'Sem stock',
      value: outOfStockProducts,
      color: 'text-[#a83939]',
    },
    {
      title: 'Valor estimado',
      value: formatCurrency(totalValue),
      color: 'text-[#248468]',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div key={card.title} className="rounded-lg border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
