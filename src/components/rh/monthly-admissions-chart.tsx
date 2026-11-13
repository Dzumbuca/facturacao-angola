'use client';

export type MonthAdmission = { month: string; fullDate: string; count: number };

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function MonthlyAdmissionsChart({ months }: { months: MonthAdmission[] }) {
  if (!months.length) return <div className="flex h-44 items-center justify-center rounded-[18px] border border-dashed border-[#dfe6ee] bg-[#fbfcfe] text-center text-xs text-[#8094a9]">Sem admissões registadas este ano.</div>;
  const max = Math.max(...months.map((m) => m.count), 1);
  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${months.length * 42} 160`} className="h-44 w-full min-w-0 overflow-visible" role="img" aria-label="Admissões por mês">
        {[0, 0.5, 1].map((ratio, index) => (
          <line key={index} x1={0} x2={months.length * 42} y1={150 - ratio * 130} y2={150 - ratio * 130} stroke="#e6ebf1" strokeDasharray={index === 0 ? undefined : '3 5'} />
        ))}
        {months.map((point, index) => {
          const height = (point.count / max) * 130;
          const x = index * 42 + 6;
          const y = 150 - height;
          return (
            <g key={point.fullDate}>
              <title>{new Date(point.fullDate).toLocaleDateString('pt-AO', { month: 'long' })} · {point.count} admissão/ões</title>
              <rect x={x} y={y} width={30} height={height} rx={4} fill="url(#barGrad)" />
              <text x={x + 15} y={158} textAnchor="middle" className="fill-[#7b8799] text-[11px] font-semibold">{MONTHS[new Date(point.fullDate).getMonth()]}</text>
              <text x={x + 15} y={y - 6} textAnchor="middle" className="fill-[#1c2d3f] text-[11px] font-bold">{point.count}</text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f64ff" />
            <stop offset="100%" stopColor="#021f87" />
          </linearGradient>
        </defs>
      </svg>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#7c8999]">Admissões por mês</p>
        <p className="text-[10px] font-medium uppercase tracking-[.1em] text-[#aab8cc]">{months.length} meses</p>
      </div>
    </div>
  );
}
