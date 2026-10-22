type Row = { day: string | Date; count: number };
export function AdminTrendChart({ title, rows }: { title: string; rows: Row[] }) {
  const values = rows.map((row) => Number(row.count));
  const max = Math.max(1, ...values);
  const width = 640;
  const height = 180;
  const points = values.map((value, index) => `${values.length <= 1 ? 0 : (index / (values.length - 1)) * width},${height - 12 - (value / max) * (height - 24)}`).join(' ');
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="font-semibold">{title}</h2>
    {rows.length ? <div className="mt-4 overflow-hidden"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}: ${values.join(', ')}`} className="h-40 w-full"><line x1="0" y1={height - 12} x2={width} y2={height - 12} stroke="#dce2e9"/><polyline points={points} fill="none" stroke="#021f87" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /></svg><div className="flex justify-between text-xs text-slate-500"><span>{new Date(rows[0].day).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</span><span>{new Date(rows.at(-1)!.day).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</span></div></div> : <p className="mt-5 rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Sem registos neste período.</p>}
  </section>;
}
