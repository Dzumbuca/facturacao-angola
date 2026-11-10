'use client';

import { Card, CardContent } from '@/components/ui/card';

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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <Card key={card.title} className="min-w-0 p-4 sm:p-5">
          <CardContent className="min-w-0 p-0">
            <p className="text-xs font-medium text-[#708195] sm:text-sm">{card.title}</p>
            <p className={`mt-1 break-words text-lg font-bold leading-tight tabular-nums sm:text-2xl ${card.color}`}>{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
