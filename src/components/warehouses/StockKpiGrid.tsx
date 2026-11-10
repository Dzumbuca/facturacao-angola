'use client';

import { Card, CardContent } from '@/components/ui/card';

type Kpi = {
  label: string;
  value: string | number;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'muted';
};

const toneClasses: Record<NonNullable<Kpi['tone']>, string> = {
  blue: 'text-[#2878d0]',
  green: 'text-[#248468]',
  amber: 'text-[#8a5a10]',
  red: 'text-[#a83939]',
  muted: 'text-[#607286]',
};

export function StockKpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="min-w-0 p-3.5 sm:p-5">
          <CardContent className="min-w-0 p-0">
            <p className="truncate text-xs font-semibold text-[#69788c] sm:text-sm">{kpi.label}</p>
            <p className={`mt-1 break-words text-lg font-bold leading-tight tabular-nums sm:text-2xl ${toneClasses[kpi.tone ?? 'muted']}`}>{kpi.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}