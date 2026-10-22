type Point = { date: string; value: number };

const money = (value: number) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA', maximumFractionDigits: 0 }).format(value);
const shortDate = (value: string) => {
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-AO', { timeZone: 'Africa/Luanda', day: '2-digit', month: 'short' }).format(date);
};

export function FinancialLineChart({ points, label, color }: { points: Point[]; label: string; color: 'blue' | 'green' }) {
  if (!points.length) return <div className="flex min-h-72 items-center justify-center rounded-sm bg-[#f6f8fb] px-6 text-center text-sm text-[#65758a]">Sem movimentos neste período. Quando existirem facturas ou recebimentos, a evolução aparece aqui.</div>;

  const width = 900; const height = 280; const left = 72; const right = 886; const top = 18; const bottom = 220;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length === 1 ? 0 : (right - left) / (points.length - 1);
  const coords = points.map((point, index) => ({ ...point, x: left + step * index, y: bottom - (point.value / max) * (bottom - top) }));
  const line = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L ${coords.at(-1)!.x} ${bottom} L ${coords[0].x} ${bottom} Z`;
  const axisMax = max;
  const lineColor = color === 'blue' ? '#021F87' : '#248468';
  const areaColor = color === 'blue' ? '#021F87' : '#248468';
  const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1])];

  return <div className="chart-reveal">
    <div className="min-w-0 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Gráfico de ${label.toLocaleLowerCase()} em kwanzas por período`} className="h-[270px] w-full min-w-[560px] overflow-visible">
        {[0, .5, 1].map((ratio) => {
          const y = bottom - ratio * (bottom - top);
          return <g key={ratio}>
            <line x1={left} x2={right} y1={y} y2={y} stroke="#e8edf3" strokeDasharray={ratio === 0 ? undefined : '3 5'} />
            <text x={left - 12} y={y + 4} textAnchor="end" className="fill-[#7b8998] text-[11px]">{new Intl.NumberFormat('pt-AO', { notation: 'compact', maximumFractionDigits: 1 }).format(axisMax * ratio)}</text>
          </g>;
        })}
        <path d={area} fill={areaColor} fillOpacity=".075" />
        <path d={line} fill="none" stroke={lineColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="4" fill="white" stroke={lineColor} strokeWidth="2.5"><title>{`${shortDate(point.date)} · ${money(point.value)}`}</title></circle>)}
        {tickIndexes.map((index) => <text key={points[index].date} x={coords[index].x} y={bottom + 29} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="fill-[#7b8998] text-[11px]">{shortDate(points[index].date)}</text>)}
      </svg>
    </div>
    <details className="mt-2 text-xs text-[#5e6d7d]">
      <summary className="w-fit cursor-pointer rounded-sm underline decoration-[#b5c0cd] underline-offset-4">Consultar valores em tabela</summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[360px] text-left"><caption className="sr-only">Dados do gráfico de {label.toLocaleLowerCase()}</caption><thead><tr><th className="py-2 font-semibold">Data</th><th className="py-2 text-right font-semibold">{label}</th></tr></thead><tbody>{points.map((point) => <tr key={point.date} className="border-t border-[#edf0f4]"><td className="py-2">{shortDate(point.date)}</td><td className="py-2 text-right tabular-nums">{money(point.value)}</td></tr>)}</tbody></table>
      </div>
    </details>
  </div>;
}
