import Link from 'next/link';
import { getAdminDashboard } from '@/lib/admin-data';
import { AdminTrendChart } from '@/components/admin-trend-chart';

type Params = Promise<Record<string, string | string[] | undefined>>;
const formatMoney = (value: number, currency: string) => new Intl.NumberFormat('pt-AO', { style: 'currency', currency }).format(value);

function Metric({ title, value, detail }: { title: string; value: string | number; detail?: string }) {
  return <article className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-sm text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>{detail && <p className="mt-2 text-xs text-slate-500">{detail}</p>}</article>;
}

export default async function AdminDashboard({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  let data;
  try { data = await getAdminDashboard({ period: params.period, from: params.from, to: params.to }); }
  catch { return <div><h1 className="text-2xl font-bold">Visão geral</h1><p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-red-800">Não foi possível carregar as métricas administrativas.</p></div>; }
  const periodChoices = ['7d', '30d', '90d'];
  const { counts, moneyByCurrency: money } = data;
  return <div>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-wider text-[#248468]">Plataforma</p><h1 className="mt-1 text-3xl font-bold">Visão geral</h1><p className="mt-2 text-slate-600">Indicadores operacionais agregados. Sem receita própria da plataforma.</p></div>
      <form method="get" className="flex flex-wrap items-end gap-2"><label><span className="app-label">Período</span><select className="app-input min-w-36" name="period" defaultValue={typeof params.period === 'string' ? params.period : '30d'}>{periodChoices.map((p) => <option value={p} key={p}>{p}</option>)}<option value="custom">Personalizado</option></select></label><label><span className="app-label">De</span><input className="app-input" type="date" name="from" defaultValue={typeof params.from === 'string' ? params.from : ''} /></label><label><span className="app-label">Até</span><input className="app-input" type="date" name="to" defaultValue={typeof params.to === 'string' ? params.to : ''} /></label><button className="rounded-lg bg-[#021f87] px-4 py-3 font-semibold text-white">Aplicar</button></form>
    </div>
    <p className="mt-4 text-sm text-slate-500">Período usado: {data.period.from} a {data.period.to} (Africa/Luanda)</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Metric title="Empresas" value={counts.tenants.total} detail={`${counts.tenants.active} activas · ${counts.tenants.suspended} suspensas`} />
      <Metric title="Utilizadores" value={counts.users.total} detail={`${counts.users.active} contas activas`} />
      <Metric title="Facturas emitidas no período" value={counts.invoices.period} />
      <Metric title="Empresas criadas no período" value={data.trends.tenants.reduce((sum: number, row: any) => sum + Number(row.count), 0)} detail="Novas empresas no intervalo seleccionado" />
    </div>
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">Valores operacionais por moeda</h2><div className="mt-4 overflow-x-auto"><table className="data-table min-w-[600px]"><thead><tr><th>Moeda</th><th>Volume facturado no período</th><th>Pagamentos confirmados no período</th><th>Saldo actual em dívida</th></tr></thead><tbody>{Array.from(new Set([...money.invoiced, ...money.received, ...money.outstanding].map((row: any) => row.currency))).map((currency: string) => <tr key={currency}><td>{currency}</td><td>{formatMoney(money.invoiced.find((v: any) => v.currency === currency)?.amount ?? 0, currency)}</td><td>{formatMoney(money.received.find((v: any) => v.currency === currency)?.amount ?? 0, currency)}</td><td>{formatMoney(money.outstanding.find((v: any) => v.currency === currency)?.amount ?? 0, currency)}</td></tr>)}</tbody></table>{!money.invoiced.length && !money.received.length && !money.outstanding.length && <p className="py-5 text-sm text-slate-500">Sem movimentos monetários registados.</p>}</div></section>
    <div className="mt-5 grid gap-4 lg:grid-cols-3"><AdminTrendChart title="Empresas criadas por dia" rows={data.trends.tenants} /><AdminTrendChart title="Utilizadores criados por dia" rows={data.trends.users} /><AdminTrendChart title="Facturas emitidas por dia" rows={data.trends.invoices} /></div>
    <section className="mt-5 rounded-xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b px-5 py-4"><h2 className="font-semibold">Facturas recentes do período</h2><Link className="text-sm font-semibold text-[#021f87]" href="/admin/documentos">Ver documentos</Link></div>{data.recentInvoices.length ? <div className="overflow-x-auto"><table className="data-table min-w-[600px]"><thead><tr><th>Número</th><th>Empresa</th><th>Emissão</th><th>Total</th></tr></thead><tbody>{data.recentInvoices.map((row: any) => <tr key={row.id}><td>{row.number}</td><td>{row.tenant.name}</td><td>{new Date(row.issuedAt).toLocaleDateString('pt-AO', { timeZone: 'Africa/Luanda' })}</td><td>{formatMoney(Number(row.total), row.currency)}</td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-slate-500">Não há facturas emitidas neste período.</p>}</section>
  </div>;
}
